/**
 * Connections: bring your own stuff into Flyer.
 *   • Calendar links (.ics): Canvas's own calendar feed, a Google or
 *     Outlook "secret address", or any class calendar. Read-only.
 *   • Microsoft (OneDrive files + Outlook calendar) and Google
 *     (Calendar): normal "Sign in with…" pages, read-only scopes.
 *   • Canva: sign in, then clip designs into Group Spaces.
 *   • Advanced: a Canvas access token you generate yourself. Off the
 *     main path on purpose; Canvas's calendar link is the easy way.
 * Every link, key and token stays in the iPhone Keychain on this
 * phone, except Canva (its sign-in has to finish on Flyer's server).
 * "Remove all connections" wipes them.
 */
import { SecureStore, AuthSession, WebBrowser, Crypto } from './native';
import { icsToPlanner } from './ics';
import { CONNECTORS, SCHOOLS, SHARE } from '../config';
import { api } from './firebase';

const INDEX = 'flyer.secretKeys';
const mem = {}; // fallback when the Keychain isn't available (tests, web)

async function readIndex() { try { return JSON.parse((SecureStore ? await SecureStore.getItemAsync(INDEX) : mem[INDEX]) || '[]'); } catch (e) { return []; } }
async function writeIndex(list) { const v = JSON.stringify([...new Set(list)]); if (SecureStore) await SecureStore.setItemAsync(INDEX, v); else mem[INDEX] = v; }

export async function setSecret(key, value) {
  if (SecureStore) await SecureStore.setItemAsync(key, value); else mem[key] = value;
  await writeIndex([...(await readIndex()), key]);
}
export async function getSecret(key) { try { return SecureStore ? await SecureStore.getItemAsync(key) : mem[key] || null; } catch (e) { return null; } }
export async function deleteSecret(key) {
  try { if (SecureStore) await SecureStore.deleteItemAsync(key); else delete mem[key]; } catch (e) { /* gone */ }
  await writeIndex((await readIndex()).filter((k) => k !== key));
}
export async function forgetAllSecrets() {
  const keys = await readIndex();
  for (const k of keys) { try { if (SecureStore) await SecureStore.deleteItemAsync(k); else delete mem[k]; } catch (e) { /* gone */ } }
  await writeIndex([]);
  api.canvaDisconnect({}).catch(() => {});
}

/* ---------- Calendar links ---------- */
export function normalizeFeedUrl(url) {
  const s = String(url || '').trim();
  if (/^webcals?:\/\//i.test(s)) return s.replace(/^webcals?:\/\//i, 'https://');
  if (/^https:\/\//i.test(s)) return s;
  return null;
}
export async function fetchFeed(url) {
  const r = await fetch(url, { headers: { Accept: 'text/calendar, text/plain, */*' } });
  if (!r.ok) throw new Error(`That calendar link returned ${r.status}. Check you copied the whole link.`);
  const text = await r.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That link isn't a calendar feed (.ics).");
  return icsToPlanner(text);
}
export async function addFeed({ name, url, kind }) {
  const u = normalizeFeedUrl(url);
  if (!u) throw new Error('Paste the link that starts with https:// or webcal://');
  const data = await fetchFeed(u);
  const id = `f${Date.now().toString(36)}`;
  await setSecret(`flyer.feed.${id}`, u);
  return { feed: { id, name: name || (u.includes('instructure.com') ? 'Canvas calendar' : 'Calendar'), kind: kind || (u.includes('instructure.com') ? 'canvas' : 'calendar'), lastSync: new Date().toISOString(), count: data.assignments.length + data.events.length }, data };
}
export async function syncFeed(feed) {
  const u = await getSecret(`flyer.feed.${feed.id}`);
  if (!u) throw new Error('That calendar link is missing on this phone. Add it again.');
  return fetchFeed(u);
}

/* ---------- Canvas access token (advanced) ---------- */
const canvasDomain = (schoolId) => (SCHOOLS.find((s) => s.id === schoolId) || SCHOOLS[0]).canvasDomain;
async function canvasGet(schoolId, token, path) {
  const r = await fetch(`https://${canvasDomain(schoolId)}/api/v1/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) throw new Error('Canvas said that token is invalid or expired.');
  if (!r.ok) throw new Error(`Canvas returned ${r.status}.`);
  return r.json();
}
export async function setCanvasToken(token, schoolId = 'ttu') {
  const t = String(token || '').trim();
  if (t.length < 20) throw new Error("That doesn't look like a Canvas token.");
  const me = await canvasGet(schoolId, t, 'users/self');
  await setSecret('flyer.canvasToken', t);
  return me && me.name ? me.name : 'Connected';
}
export async function syncCanvasToken(schoolId = 'ttu') {
  const t = await getSecret('flyer.canvasToken');
  if (!t) throw new Error('No Canvas token on this phone.');
  const start = new Date().toISOString(); const end = new Date(Date.now() + 35 * 86400000).toISOString();
  const [items, enrollments, courses] = await Promise.all([
    canvasGet(schoolId, t, `planner/items?start_date=${start}&end_date=${end}&per_page=100`),
    canvasGet(schoolId, t, 'users/self/enrollments?type[]=StudentEnrollment&state[]=active&per_page=50'),
    canvasGet(schoolId, t, 'courses?enrollment_state=active&per_page=50'),
  ]);
  const domain = canvasDomain(schoolId);
  const assignments = (items || []).filter((i) => i.plannable && (i.plannable.due_at || i.plannable_date) && ['assignment', 'quiz', 'discussion_topic'].includes(i.plannable_type))
    .map((i) => ({ id: `canvas-${i.plannable_type}-${i.plannable_id}`, title: i.plannable.title, course: i.context_name || '', due: i.plannable.due_at || i.plannable_date, url: i.html_url ? `https://${domain}${i.html_url}` : null, done: !!(i.submissions && (i.submissions.submitted || i.submissions.graded)) }));
  const names = Object.fromEntries((courses || []).map((c) => [c.id, c.course_code || c.name]));
  const scores = (enrollments || []).map((e) => ({ name: names[e.course_id] || '', score: e.grades?.current_score ?? null })).filter((c) => c.name);
  return { assignments, courses: scores };
}

/* ---------- OAuth (Microsoft, Google) ---------- */
const PROVIDERS = {
  microsoft: {
    clientId: () => CONNECTORS.microsoftClientId,
    discovery: { authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token' },
    scopes: ['openid', 'offline_access', 'User.Read', 'Files.Read', 'Calendars.Read'],
    redirect: () => 'msauth.com.joshuat8808.flyer://auth',
  },
  google: {
    clientId: () => CONNECTORS.googleIosClientId,
    discovery: { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth', tokenEndpoint: 'https://oauth2.googleapis.com/token' },
    scopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'],
    redirect: () => `com.googleusercontent.apps.${String(CONNECTORS.googleIosClientId).replace('.apps.googleusercontent.com', '')}:/oauthredirect`,
  },
};
export const providerReady = (p) => !!(PROVIDERS[p] && PROVIDERS[p].clientId() && AuthSession && AuthSession.AuthRequest);

export async function connectProvider(p) {
  const cfg = PROVIDERS[p];
  if (!providerReady(p)) throw new Error(`${p === 'microsoft' ? 'Microsoft' : 'Google'} sign-in isn't set up in this version of Flyer yet.`);
  const redirectUri = cfg.redirect();
  const request = new AuthSession.AuthRequest({ clientId: cfg.clientId(), scopes: cfg.scopes, redirectUri, usePKCE: true, extraParams: p === 'google' ? { access_type: 'offline', prompt: 'consent' } : {} });
  await request.makeAuthUrlAsync(cfg.discovery);
  const res = await request.promptAsync(cfg.discovery);
  if (res.type !== 'success') throw new Error('Sign-in was cancelled.');
  const tok = await AuthSession.exchangeCodeAsync({ clientId: cfg.clientId(), code: res.params.code, redirectUri, extraParams: { code_verifier: request.codeVerifier } }, cfg.discovery);
  await setSecret(`flyer.oauth.${p}`, JSON.stringify({ access: tok.accessToken, refresh: tok.refreshToken, exp: Date.now() + (tok.expiresIn || 3600) * 1000 }));
  return true;
}
async function providerToken(p) {
  const raw = await getSecret(`flyer.oauth.${p}`);
  if (!raw) throw new Error('Connect first.');
  const t = JSON.parse(raw);
  if (Date.now() < t.exp - 60000) return t.access;
  const cfg = PROVIDERS[p];
  const fresh = await AuthSession.refreshAsync({ clientId: cfg.clientId(), refreshToken: t.refresh }, cfg.discovery);
  await setSecret(`flyer.oauth.${p}`, JSON.stringify({ access: fresh.accessToken, refresh: fresh.refreshToken || t.refresh, exp: Date.now() + (fresh.expiresIn || 3600) * 1000 }));
  return fresh.accessToken;
}
export async function disconnectProvider(p) { await deleteSecret(`flyer.oauth.${p}`); }

export async function oneDriveRecent() {
  const t = await providerToken('microsoft');
  const r = await fetch('https://graph.microsoft.com/v1.0/me/drive/recent?$top=40', { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error("Couldn't load your OneDrive files.");
  const j = await r.json();
  return (j.value || []).filter((f) => f.webUrl).map((f) => ({ id: f.id, title: f.name, url: f.webUrl, kind: /\.pptx?$/i.test(f.name) ? 'PowerPoint' : /\.docx?$/i.test(f.name) ? 'Word' : /\.xlsx?$/i.test(f.name) ? 'Excel' : 'OneDrive' }));
}

const range = (days) => ({ from: new Date(), to: new Date(Date.now() + days * 86400000) });
export async function providerEvents(p, days = 14) {
  const t = await providerToken(p);
  const { from, to } = range(days);
  if (p === 'microsoft') {
    const r = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}&$top=100&$orderby=start/dateTime`, { headers: { Authorization: `Bearer ${t}`, Prefer: 'outlook.timezone="UTC"' } });
    if (!r.ok) throw new Error("Couldn't load your Outlook calendar.");
    const j = await r.json();
    return (j.value || []).map((e) => ({ id: `ms-${e.id}`.slice(0, 80), title: e.subject || 'Event', startsAt: new Date(`${e.start.dateTime}Z`).toISOString(), allDay: !!e.isAllDay, location: e.location?.displayName || '', url: e.webLink || '' }));
  }
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${from.toISOString()}&timeMax=${to.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=100`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error("Couldn't load your Google Calendar.");
  const j = await r.json();
  return (j.items || []).map((e) => ({ id: `g-${e.id}`.slice(0, 80), title: e.summary || 'Event', startsAt: new Date(e.start.dateTime || `${e.start.date}T00:00:00`).toISOString(), allDay: !e.start.dateTime, location: e.location || '', url: e.htmlLink || '' }));
}

/* ---------- Canva (server finishes the sign-in) ---------- */
const b64url = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const canvaReady = () => !!(CONNECTORS.canvaClientId && WebBrowser && Crypto);
export async function connectCanva() {
  if (!canvaReady()) throw new Error("Canva isn't set up in this version of Flyer yet.");
  const bytes = Crypto.getRandomBytes(48);
  const verifier = b64url(btoa(String.fromCharCode(...bytes)));
  const challenge = b64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  const state = Math.random().toString(36).slice(2);
  const redirectUri = `${SHARE.base}/oauth/canva`;
  const url = `https://www.canva.com/api/oauth/authorize?code_challenge=${challenge}&code_challenge_method=s256&scope=${encodeURIComponent('design:meta:read')}&response_type=code&client_id=${encodeURIComponent(CONNECTORS.canvaClientId)}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  const res = await WebBrowser.openAuthSessionAsync(url, 'flyer://oauth/canva');
  if (res.type !== 'success' || !res.url) throw new Error('Canva sign-in was cancelled.');
  const q = Object.fromEntries((res.url.split('?')[1] || '').split('&').filter(Boolean).map((kv) => kv.split('=').map(decodeURIComponent)));
  if (q.state !== state || !q.code) throw new Error('Canva sign-in failed a security check. Try again.');
  await api.canvaExchange({ code: q.code, verifier, redirectUri });
  return true;
}
export async function canvaDesigns() {
  const r = await api.canvaDesigns({});
  return r.data.designs || [];
}
