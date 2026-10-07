/**
 * Canvas OAuth — the client secret and every token stay server-side.
 * Tokens live in private/{uid} (Firestore rules deny all client
 * access). Inactive until CANVAS_CLIENT_ID / CANVAS_CLIENT_SECRET are
 * set from a Developer Key issued by TTU's Canvas administrators.
 */
const { onCall } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const C = require('./common');

const { db, FieldValue, HttpsError } = C;
const CANVAS_CLIENT_SECRET = defineSecret('CANVAS_CLIENT_SECRET');
const CANVAS_CLIENT_ID = defineString('CANVAS_CLIENT_ID', { default: '' });
const DOMAINS = { ttu: 'texastech.instructure.com' };

async function tokenRequest(domain, body) {
  const resp = await fetch(`https://${domain}/login/oauth2/token`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!resp.ok) {
    console.error('Canvas token error', resp.status, await resp.text());
    throw new HttpsError('permission-denied', "Canvas didn't accept the sign-in. Please try again.");
  }
  return resp.json();
}

function ensureConfigured() {
  if (!CANVAS_CLIENT_ID.value()) throw new HttpsError('failed-precondition', 'Canvas sign-in is waiting on approval from the university.');
}

exports.canvasExchange = onCall(C.callOpts([CANVAS_CLIENT_SECRET]), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  ensureConfigured();
  const { code, redirectUri, schoolId } = request.data || {};
  const domain = DOMAINS[schoolId] || DOMAINS.ttu;
  if (!code || !redirectUri) throw new HttpsError('invalid-argument', 'Missing Canvas code.');
  const tok = await tokenRequest(domain, {
    grant_type: 'authorization_code', client_id: CANVAS_CLIENT_ID.value(), client_secret: CANVAS_CLIENT_SECRET.value(), redirect_uri: redirectUri, code,
  });
  await db.doc(`private/${uid}`).set({ canvas: {
    domain, accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt: Date.now() + (tok.expires_in || 3600) * 1000, canvasUserId: tok.user?.id || null,
  } }, { merge: true });
  await db.doc(`users/${uid}`).set({ canvasConnected: true }, { merge: true });
  return { ok: true };
});

async function accessToken(uid) {
  const ref = db.doc(`private/${uid}`);
  const s = await ref.get();
  const cv = s.exists && s.data().canvas;
  if (!cv) throw new HttpsError('failed-precondition', 'Canvas isn\'t connected.');
  if (Date.now() < cv.expiresAt - 60000) return cv;
  const tok = await tokenRequest(cv.domain, {
    grant_type: 'refresh_token', client_id: CANVAS_CLIENT_ID.value(), client_secret: CANVAS_CLIENT_SECRET.value(), refresh_token: cv.refreshToken,
  });
  const next = { ...cv, accessToken: tok.access_token, expiresAt: Date.now() + (tok.expires_in || 3600) * 1000 };
  await ref.set({ canvas: next }, { merge: true });
  return next;
}

async function canvasGet(cv, path) {
  const resp = await fetch(`https://${cv.domain}/api/v1/${path}`, { headers: { Authorization: `Bearer ${cv.accessToken}` } });
  if (!resp.ok) throw new HttpsError('internal', `Canvas returned ${resp.status}.`);
  return resp.json();
}

exports.canvasSync = onCall(C.callOpts([CANVAS_CLIENT_SECRET]), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  ensureConfigured();
  await C.takeQuota(uid, 'canvasSync', 30);
  const cv = await accessToken(uid);
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 35 * 86400000).toISOString();
  const [items, enrollments, courses] = await Promise.all([
    canvasGet(cv, `planner/items?start_date=${start}&end_date=${end}&per_page=100`),
    canvasGet(cv, 'users/self/enrollments?type[]=StudentEnrollment&state[]=active&per_page=50'),
    canvasGet(cv, 'courses?enrollment_state=active&per_page=50'),
  ]);
  const assignments = (items || [])
    .filter((i) => i.plannable && (i.plannable.due_at || i.plannable_date) && ['assignment', 'quiz', 'discussion_topic'].includes(i.plannable_type))
    .map((i) => ({
      id: `canvas-${i.plannable_type}-${i.plannable_id}`, title: i.plannable.title, course: i.context_name || '',
      due: i.plannable.due_at || i.plannable_date, url: i.html_url ? `https://${cv.domain}${i.html_url}` : null,
      done: !!(i.submissions && (i.submissions.submitted || i.submissions.graded)),
    }));
  const names = Object.fromEntries((courses || []).map((c) => [c.id, c.course_code || c.name]));
  const scores = (enrollments || []).map((e) => ({ name: names[e.course_id] || '', score: e.grades?.current_score ?? null })).filter((c) => c.name);
  await db.doc(`users/${uid}`).set({ canvasSyncedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { assignments, courses: scores };
});

exports.canvasDisconnect = onCall(C.callOpts([CANVAS_CLIENT_SECRET]), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const s = await db.doc(`private/${uid}`).get();
  const cv = s.exists && s.data().canvas;
  if (cv) await fetch(`https://${cv.domain}/login/oauth2/token`, { method: 'DELETE', headers: { Authorization: `Bearer ${cv.accessToken}` } }).catch(() => {});
  await db.doc(`private/${uid}`).set({ canvas: FieldValue.delete() }, { merge: true });
  await db.doc(`users/${uid}`).set({ canvasConnected: false }, { merge: true });
  return { ok: true };
});
