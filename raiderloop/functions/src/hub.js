/**
 * Campus hub: live job openings, course catalog lookups, and student
 * deals (curated by you in Firestore, checked by students).
 *
 * Deals live in the `deals` collection, added by you in the Firebase
 * console, the same way sponsors work:
 *   { name, offer, category: "Food", where: "0.4 mi · 19th St",
 *     lat, lng, url, needsId: true, online: false, fine: "Dine-in only",
 *     schoolId: "ttu", active: true, startsAt, endsAt }
 * Student "still works" / "changed" taps update works, changed, and
 * lastConfirmedAt. Suggestions land in `dealSuggestions` for you to
 * review; nothing a student sends is ever shown without your check.
 */
const { onCall } = require('firebase-functions/v2/https');
const C = require('./common');

const { db, FieldValue, HttpsError, ANTHROPIC_API_KEY, TAVILY_API_KEY, HOUR } = C;
const BOTH = [ANTHROPIC_API_KEY, TAVILY_API_KEY];
const DAY = 24 * HOUR;
const clean = (s, n = 120) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

const lookup = async (request) => {
  const uid = C.requireAuth(request);
  await C.takeQuota(uid, 'lookups', 80);
  return uid;
};

/* ---------- Job openings ----------
   Only TTU's own job pages count as sources; every listing links to
   where the student actually applies. */
const JOB_SOURCES = ['depts.ttu.edu', 'ttu.studentemployment.ngwebsolutions.com', 'sjobs.brassring.com', 'texastech.com', 'techannounce.ttu.edu', 'apps.lib.ttu.edu'];

exports.getJobs = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const { value, cached } = await C.cachedList('jobs_ttu', 6 * HOUR, 2 * HOUR, async () => {
    const results = await C.tavilySearch({ query: 'Texas Tech University student jobs now hiring on campus student employment work-study', maxResults: 10 });
    const official = { ...results, results: (results.results || []).filter((r) => JOB_SOURCES.some((d) => (r.url || '').includes(d))) };
    if (!official.results.length) return [];
    const text = await C.claudeText({
      system: `Extract real, currently open student job postings at Texas Tech University from these official TTU pages. Return ONLY a JSON array. Each:
{ "title": string, "dept": string, "pay": string ("" if not stated), "hours": string ("" if not stated), "type": "On campus" | "Work-study" | "Off campus", "posted": string ("" if not stated), "url": string (the source page) }
Only include a posting if the page clearly says it is open or hiring. Do not invent pay or hours. Skip general pages that only explain how to look for jobs. If nothing qualifies, return [].
${C.recencyGuard()}

PAGES:
${C.resultsText(official)}`,
      messages: [{ role: 'user', content: 'Extract the open jobs as JSON.' }], maxTokens: 1400,
    });
    return C.parseJsonArray(text)
      .filter((j) => j && j.title && JOB_SOURCES.some((d) => String(j.url || '').includes(d)))
      .slice(0, 15)
      .map((j) => ({ title: clean(j.title, 90), dept: clean(j.dept, 80), pay: clean(j.pay, 40), hours: clean(j.hours, 40), type: ['On campus', 'Work-study', 'Off campus'].includes(j.type) ? j.type : 'On campus', posted: clean(j.posted, 30), url: clean(j.url, 400) }));
  });
  return { jobs: value, cached };
});

/* ---------- Course catalog ----------
   Looks a course up in catalog.ttu.edu and caches it for 30 days, so
   each course costs one search per month at most. */
exports.getCourse = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const m = String(request.data?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').trim().match(/^([A-Z]{2,5})\s*(\d{4})$/);
  if (!m) throw new HttpsError('invalid-argument', 'Use a course code like MATH 1314.');
  const code = `${m[1]} ${m[2]}`;
  const key = `course_ttu_${m[1]}${m[2]}`;
  const hit = await C.getCached(key, 30 * DAY);
  if (hit) return { course: hit, cached: true };
  const miss = await C.getCached(`${key}__miss`, 1 * DAY);
  if (miss) return { course: { found: false, code }, cached: true };

  const results = await C.tavilySearch({ query: `"${code}" Texas Tech catalog course description site:catalog.ttu.edu`, maxResults: 5 });
  const catalog = { ...results, results: (results.results || []).filter((r) => (r.url || '').includes('catalog.ttu.edu')) };
  let course = { found: false, code };
  if (catalog.results.length) {
    const text = await C.claudeText({
      system: `From these Texas Tech University catalog pages, find the course ${code}. Return ONLY a JSON object:
{ "found": boolean, "code": "${code}", "title": string, "hours": string (credit hours as a number string, e.g. "3"), "description": string (the catalog's description, trimmed to 2-3 sentences, keep its meaning), "prerequisites": string ("" if none stated), "core": string (core curriculum area if stated, else ""), "url": string (the page it came from) }
Only use text that is clearly about ${code}. If ${code} is not on these pages, return {"found": false, "code": "${code}"}. Never guess.

PAGES:
${C.resultsText(catalog)}`,
      messages: [{ role: 'user', content: 'Return the course as JSON.' }], maxTokens: 700,
    });
    const o = C.parseJsonObject(text);
    if (o && o.found && o.title) {
      course = {
        found: true, code, title: clean(o.title, 100), hours: clean(o.hours, 6).replace(/[^0-9:-]/g, ''), description: clean(o.description, 700),
        prerequisites: clean(o.prerequisites, 300), core: clean(o.core, 120), url: String(o.url || '').includes('catalog.ttu.edu') ? clean(o.url, 400) : '',
      };
    }
  }
  if (course.found) await C.setCached(key, course);
  else await C.setCached(`${key}__miss`, true);
  return { course, cached: false };
});

/* ---------- Deals ---------- */
exports.getDeals = onCall(C.callOpts(), async (request) => {
  C.requireAuth(request);
  const now = new Date().toISOString();
  const q = await db.collection('deals').where('schoolId', '==', 'ttu').where('active', '==', true).limit(100).get();
  const deals = q.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => (!d.startsAt || d.startsAt <= now) && (!d.endsAt || d.endsAt >= now))
    .map((d) => ({
      id: d.id, name: d.name, offer: d.offer, category: d.category || '', where: d.where || '', fine: d.fine || '',
      lat: typeof d.lat === 'number' ? d.lat : null, lng: typeof d.lng === 'number' ? d.lng : null,
      url: d.url || '', needsId: d.needsId !== false, online: !!d.online,
      works: d.works || 0, changed: d.changed || 0,
      lastConfirmedAt: d.lastConfirmedAt && d.lastConfirmedAt.toDate ? d.lastConfirmedAt.toDate().toISOString() : (d.lastConfirmedAt || null),
    }))
    .sort((a, b) => (b.works - b.changed) - (a.works - a.changed));
  return { deals };
});

/* One vote per person per deal; changing your vote moves it. */
exports.voteDeal = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  await C.takeQuota(uid, 'dealVotes', 30, "That's a lot of votes for one day. Try again tomorrow.");
  const id = clean(request.data?.id, 80);
  const vote = request.data?.vote === 'works' ? 'works' : request.data?.vote === 'changed' ? 'changed' : null;
  if (!id || !vote) throw new HttpsError('invalid-argument', 'Pick still works or changed.');
  const ref = db.collection('deals').doc(id);
  const vref = ref.collection('votes').doc(uid);
  await db.runTransaction(async (tx) => {
    const [deal, prev] = await Promise.all([tx.get(ref), tx.get(vref)]);
    if (!deal.exists) throw new HttpsError('not-found', 'That deal is gone.');
    const before = prev.exists ? prev.data().vote : null;
    if (before === vote) return;
    const patch = { [vote]: FieldValue.increment(1) };
    if (before) patch[before] = FieldValue.increment(-1);
    if (vote === 'works') patch.lastConfirmedAt = FieldValue.serverTimestamp();
    tx.set(ref, patch, { merge: true });
    tx.set(vref, { vote, at: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});

exports.suggestDeal = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const name = clean(request.data?.name, 80);
  const offer = clean(request.data?.offer, 200);
  if (name.length < 2 || offer.length < 4) throw new HttpsError('invalid-argument', 'Add the place and the deal.');
  await C.takeQuota(uid, 'dealSuggest', 5, "Thanks! That's plenty of suggestions for today.");
  await db.collection('dealSuggestions').add({ name, offer, uid, schoolId: 'ttu', status: 'new', at: FieldValue.serverTimestamp() });
  return { ok: true };
});
