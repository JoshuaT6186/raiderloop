/**
 * AI + live-search functions. Every one requires a signed-in user
 * (guests are anonymous users), and the paid ones are rate-limited
 * per person and capped globally per day.
 */
const { onCall } = require('firebase-functions/v2/https');
const C = require('./common');

const { db, HttpsError, ANTHROPIC_API_KEY, TAVILY_API_KEY, HOUR } = C;
const BOTH = [ANTHROPIC_API_KEY, TAVILY_API_KEY];
const LIMITS = { pilotFree: 25, pilotPlus: 150, scans: 5, lookups: 80, photosFree: 5, photosPlus: 20 };

/* ---------------- Pilot ---------------- */
async function pilot(request) {
  const uid = C.requireAuth(request);
  const { question, context, history, image } = request.data || {};
  const hasImage = !!(image && typeof image.base64 === 'string' && image.base64.length > 100);
  const q = String(question || '').trim() || (hasImage ? 'Help me understand this.' : '');
  if (!q) throw new HttpsError('invalid-argument', 'Ask a question first.');
  if (q.length > 600) throw new HttpsError('invalid-argument', 'That question is a bit long — try a shorter one.');
  const plus = await C.isPlus(uid);
  if (hasImage) {
    if (image.base64.length > 6_600_000) throw new HttpsError('invalid-argument', 'That photo is too large — try again a little farther back.');
    await C.takeQuota(uid, 'pilotPhoto', plus ? LIMITS.photosPlus : LIMITS.photosFree,
      plus ? "That's today's photo questions — they reset at midnight." : `That's all ${LIMITS.photosFree} free photo questions for today — they reset at midnight, or Flyer Plus gives you ${LIMITS.photosPlus}.`);
  }
  await C.takeQuota(uid, 'pilot', plus ? LIMITS.pilotPlus : LIMITS.pilotFree,
    plus ? "You've reached today's question limit. It resets at midnight." : `That's all ${LIMITS.pilotFree} free questions for today — they reset at midnight, or Flyer Plus gives you ${LIMITS.pilotPlus} a day.`);

  const tutor = hasImage ? `

The student attached a photo (notes, a worksheet, a textbook page, a whiteboard, a problem). Act like a good tutor:
- Explain the idea and walk through the method step by step so they can do it themselves.
- For anything that looks like graded work (homework, a quiz, a take-home exam), do NOT just hand over final answers. Show how to approach it, work a similar example, or check their own attempt.
- If the photo is blurry or cut off, say what you can't read and ask for a clearer shot.
- If the photo isn't schoolwork, just answer helpfully about what's in it.
- You may use up to 8 short sentences or a short numbered list for steps.` : '';

  const system = `You are Pilot, the assistant inside Flyer — an independent, student-built campus app (not affiliated with or endorsed by any university). You help a Texas Tech University student in Lubbock, TX.

First answer from the real data in <context>. If the answer isn't there but is a real-world fact a live search could find (deadlines, office hours, current events, policies), call search_web instead of guessing. If neither gives a verified answer, say so plainly and point to where they can check. Never invent a building, room, time, event, phone number, deadline, or organization detail.

For anything about safety or an emergency, tell them to call 911 first.

Keep answers short: 1-3 sentences, friendly, plain text (no markdown headings).${tutor}

<context>
${String(context || '').slice(0, 24000)}
</context>`;

  const tools = [{
    name: 'search_web',
    description: 'Search the live web for current, real information not in the context — deadlines, current office holders, campus news, hours, or anything that could have changed recently.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'A short, specific search query.' } }, required: ['query'] },
  }];

  const prior = Array.isArray(history) ? history.slice(-6).filter((m) => m && m.text).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text).slice(0, 800) })) : [];
  // The API requires alternating roles starting with user.
  const msgs = [];
  for (const m of prior) { if (!msgs.length && m.role !== 'user') continue; if (msgs.length && msgs[msgs.length - 1].role === m.role) continue; msgs.push(m); }
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs.pop();
  const okTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  msgs.push({ role: 'user', content: hasImage ? [
    { type: 'image', source: { type: 'base64', media_type: okTypes.includes(image.mediaType) ? image.mediaType : 'image/jpeg', data: image.base64 } },
    { type: 'text', text: q },
  ] : q });

  const maxTokens = hasImage ? 900 : 450;
  let data = await C.callClaude({ system, messages: msgs, maxTokens, tools });
  const toolUse = (data.content || []).find((b) => b.type === 'tool_use');
  let sources = [];
  if (toolUse && toolUse.name === 'search_web') {
    const results = await C.tavilySearch({ query: `${toolUse.input.query} Texas Tech Lubbock`, maxResults: 4 });
    sources = (results.results || []).slice(0, 3).map((r) => ({ title: r.title, url: r.url }));
    const summary = (results.results || []).map((r) => `${r.title} (${r.url}): ${r.content}`.slice(0, 500)).join('\n\n') || 'No results found.';
    msgs.push({ role: 'assistant', content: data.content });
    msgs.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: summary }] });
    data = await C.callClaude({ system, messages: msgs, maxTokens, tools });
  }
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    || "I don't have verified information on that yet.";
  return { text, sources };
}

exports.askPilot = onCall({ ...C.callOpts(BOTH), memory: '512MiB', timeoutSeconds: 90 }, pilot);
/* Old RaiderLoop builds call askRed — keep it working until they update. */
exports.askRed = onCall(C.callOpts(BOTH), pilot);

/* ---------------- Schedule scan ---------------- */
exports.parseSchedule = onCall({ ...C.callOpts([ANTHROPIC_API_KEY]), memory: '512MiB' }, async (request) => {
  const uid = C.requireAuth(request);
  const { imageBase64, mediaType } = request.data || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') throw new HttpsError('invalid-argument', 'No image was sent.');
  if (imageBase64.length > 7_000_000) throw new HttpsError('invalid-argument', 'That image is too large — try a regular screenshot.');
  const okTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  await C.takeQuota(uid, 'scan', LIMITS.scans, "You've scanned 5 schedules today — that's the daily limit. You can still add classes by hand.");

  const system = `Extract a class schedule from this screenshot of a university registration/schedule page.
Return ONLY a JSON array, nothing else. Each entry:
{ "title": string, "days": string[] (only "M","T","W","Th","F","Sa","Su"), "time": "9:00 AM", "endTime": "9:50 AM", "building": string (as written) }
If you can't confidently read a field, omit that entry. If the image isn't a schedule, return [].`;
  const text = await C.claudeText({
    system,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: okTypes.includes(mediaType) ? mediaType : 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: 'Extract the schedule as JSON.' },
    ] }],
    maxTokens: 1200,
  });
  return { classes: C.parseJsonArray(text).slice(0, 15) };
});

/* ---------------- Cached live lookups ---------------- */
const lookup = async (request) => {
  const uid = C.requireAuth(request);
  await C.takeQuota(uid, 'lookups', LIMITS.lookups);
};

exports.getEvents = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const { value, cached } = await C.cachedList('events', 3 * HOUR, 1 * HOUR, async () => {
    const results = await C.tavilySearch({ query: 'Texas Tech University campus events this week Lubbock', includeImages: true, maxResults: 8 });
    const images = (results.images || []).slice(0, 8);
    const text = await C.claudeText({
      system: `Extract real, distinct upcoming campus events from this search text about Texas Tech University. Return ONLY a JSON array. Each:
{ "title": string, "org": string, "date": string (as stated, e.g. "Today", "Oct 9"), "time": string (e.g. "7:00 PM" or ""), "endTime": string, "location": string, "desc": string (one sentence, your own words), "sourceUrl": string, "startsAt": ISO 8601 with ${C.chicagoOffset()} offset (Lubbock time) if date AND time are known, else "" }
Only include events with a real stated date. If none qualify, return [].
${C.recencyGuard()}

SEARCH RESULTS:
${C.resultsText(results)}`,
      messages: [{ role: 'user', content: 'Extract the events as JSON.' }], maxTokens: 1600,
    });
    return C.parseJsonArray(text).map((e, i) => ({ ...e, id: `ev-${(e.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24)}-${(e.date || '').replace(/\W/g, '')}`, img: images[i % (images.length || 1)] || null }));
  });
  return { events: value, cached };
});

exports.getNews = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const { value, cached } = await C.cachedList('news', 3 * HOUR, 1 * HOUR, async () => {
    const results = await C.tavilySearch({ query: 'Texas Tech Daily Toreador Lubbock news today', includeImages: true, maxResults: 8 });
    const images = (results.images || []).slice(0, 8);
    const text = await C.claudeText({
      system: `Extract real, distinct news headlines about Texas Tech and Lubbock. Return ONLY a JSON array. Each:
{ "headline": string, "source": string (real outlet name — never invent), "official": boolean (true only for "The Daily Toreador"), "byline": string|null, "date": string, "excerpt": string (one sentence, your own words), "url": string }
Only real stories with a real source and date. If none, return [].
${C.recencyGuard()}
For news: a story from a previous year is not current. Recent stories (last few weeks) are fine — past tense is normal for news reporting.

SEARCH RESULTS:
${C.resultsText(results)}`,
      messages: [{ role: 'user', content: 'Extract the headlines as JSON.' }], maxTokens: 1600,
    });
    return C.parseJsonArray(text).map((n, i) => ({ ...n, art: images[i % (images.length || 1)] || null }));
  });
  return { news: value, cached };
});

exports.getSportsSchedule = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const sport = String((request.data || {}).sport || '').slice(0, 40);
  if (!sport) throw new HttpsError('invalid-argument', 'sport is required');
  const key = `sports_${sport.toLowerCase().replace(/[^a-z]/g, '')}`;
  const { value, cached } = await C.cachedList(key, 24 * HOUR, 6 * HOUR, async () => {
    const results = await C.tavilySearch({ query: `Texas Tech ${sport} 2026-27 schedule`, maxResults: 6 });
    const text = await C.claudeText({
      system: `Extract the real Texas Tech ${sport} schedule. Return ONLY a JSON array. Each: { "opponent": string, "date": string, "time": string, "homeAway": "home"|"away"|"neutral", "venue": string, "result": string|null }
Only games with a real stated date. If no real schedule is in the text, return [].

SEARCH RESULTS:
${C.resultsText(results)}`,
      messages: [{ role: 'user', content: 'Extract the schedule as JSON.' }], maxTokens: 1600,
    });
    return C.parseJsonArray(text);
  });
  return { schedule: value, cached };
});

exports.getDiningMenus = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const { value, cached } = await C.cachedList('dining_menus', 12 * HOUR, 6 * HOUR, async () => {
    const results = await C.tavilySearch({ query: 'Texas Tech dining hall menu today Lubbock hospitality services', maxResults: 6 });
    const text = await C.claudeText({
      system: `Extract real, current dining menu items for Texas Tech. Return ONLY a JSON array of { "hall": string, "items": string[] }. If the text has no real current menu, return [] — never guess typical food.

SEARCH RESULTS:
${C.resultsText(results)}`,
      messages: [{ role: 'user', content: 'Extract the menus as JSON.' }], maxTokens: 1200,
    });
    return C.parseJsonArray(text);
  });
  return { menus: value, cached };
});

exports.getCampusAlerts = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const { value, cached } = await C.cachedList('campus_alerts', 6 * HOUR, 3 * HOUR, async () => {
    const results = await C.tavilySearch({ query: 'Texas Tech University parking closure facilities notice Lubbock campus', maxResults: 5 });
    const text = await C.claudeText({
      system: `Extract real, currently-active campus alerts (closures, outages, construction) for Texas Tech. Return ONLY a JSON array of { "title": string, "body": string, "source": string, "date": string }.
${C.recencyGuard()}
A resolved incident is history, not an alert. An empty list is the expected result most days. Never invent a notice.

SEARCH RESULTS:
${C.resultsText(results)}`,
      messages: [{ role: 'user', content: 'Extract real alerts as JSON.' }], maxTokens: 800,
    });
    return C.parseJsonArray(text);
  });
  return { alerts: value, cached };
});

exports.enrichOrg = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const orgName = String((request.data || {}).orgName || '').slice(0, 120);
  if (!orgName) throw new HttpsError('invalid-argument', 'orgName is required');
  const key = `org_${orgName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
  const hit = await C.getCached(key, 7 * 24 * HOUR);
  if (hit) return { ...hit, cached: true };
  const results = await C.tavilySearch({ query: `"${orgName}" Texas Tech University Instagram OR TechConnect`, includeImages: true, maxResults: 5 });
  const text = await C.claudeText({
    system: `Given search results about a Texas Tech student organization called "${orgName}", return ONLY { "instagramUrl": string|null, "activeSignal": string|null }. Never invent a URL — null unless you're confident it's this specific org.

SEARCH RESULTS:
${C.resultsText(results)}`,
    messages: [{ role: 'user', content: 'Return the JSON object.' }], maxTokens: 300,
  });
  const parsed = C.parseJsonObject(text) || {};
  const value = { instagramUrl: parsed.instagramUrl || null, activeSignal: parsed.activeSignal || null, image: (results.images || [])[0] || null };
  await C.setCached(key, value);
  return { ...value, cached: false };
});

exports.getVenueImage = onCall(C.callOpts([TAVILY_API_KEY]), async (request) => {
  await lookup(request);
  const query = String((request.data || {}).query || '').slice(0, 160);
  if (!query) throw new HttpsError('invalid-argument', 'query is required');
  const key = `venue_img_${query.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
  const hit = await C.getCached(key, 30 * 24 * HOUR);
  if (hit) return { image: hit, cached: true };
  const results = await C.tavilySearch({ query, includeImages: true, maxResults: 5 });
  const image = (results.images || [])[0] || null;
  if (image) await C.setCached(key, image);
  return { image, cached: false };
});

const DINING_HALL_SEED = {
  'student union': ['Pizza Hut', 'Raider Pit BBQ', "Boar's Head Deli", 'SUB to Go', 'Chick-fil-A', 'The Break Acai Bowls & Smoothies'],
  stangel: ['The Market', 'Corner Market Retail Shop', 'Day Break Coffee Roasters', "Fazoli's"],
  murdough: ['The Market', 'Corner Market Retail Shop', 'Day Break Coffee Roasters', "Fazoli's"],
  talkington: ['The Commons', 'Einstein Bros Bagels'],
  wall: ['The Fresh Plate'], gates: ['The Fresh Plate'], sneed: ['Sneed East Dining'],
  murray: ["Sam's Place"], 'west village': ['Raider Exchange'], rawls: ['Chick-fil-A', 'Einstein Bros Bagels'], wiggins: ["Sam's Place West"],
};

exports.getDiningHallDetail = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const hallName = String((request.data || {}).hallName || '').slice(0, 80);
  if (!hallName) throw new HttpsError('invalid-argument', 'hallName is required');
  const key = `dining_detail_${hallName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
  const hit = await C.getCached(key, 7 * 24 * HOUR);
  if (hit) return { ...hit, cached: true };
  const seedKey = Object.keys(DINING_HALL_SEED).find((k) => hallName.toLowerCase().includes(k));
  let vendors = seedKey ? DINING_HALL_SEED[seedKey] : [];
  if (!vendors.length) {
    const results = await C.tavilySearch({ query: `Texas Tech ${hallName} dining hall restaurants vendors`, maxResults: 4 });
    const text = await C.claudeText({
      system: `List the real named vendors/stations INSIDE the Texas Tech dining location "${hallName}". Only list a vendor if the text explicitly ties it to "${hallName}". Single-vendor spots → []. Return ONLY a JSON array of strings.

SEARCH RESULTS:
${C.resultsText(results)}`,
      messages: [{ role: 'user', content: 'Return the JSON array.' }], maxTokens: 400,
    });
    vendors = C.parseJsonArray(text).filter((v) => typeof v === 'string');
  }
  const value = { vendors, isFoodCourt: vendors.length > 1 };
  await C.setCached(key, value);
  return { ...value, cached: false };
});

/* ---------------- Commuter parking ----------------
   TTU Transportation & Parking Services posts lot fullness several
   times a day ("C1- 100% full, C10- 70% full"). Only TODAY's posts
   count; anything older returns an empty list. Cached 40 minutes. */
exports.getParking = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const key = `parking_${C.today()}`;
  const hit = await C.getCached(key, 40 * 60000);
  if (hit) return { ...hit, cached: true };
  const d = new Date();
  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  const results = await C.tavilySearch({ query: `Texas Tech Transportation Parking Services "Parking Lot Availability" ${mmdd}`, maxResults: 6, depth: 'advanced' });
  const text = await C.claudeText({
    system: `From these search results, find Texas Tech Transportation & Parking Services' commuter "Parking Lot Availability" update posted TODAY (${mmdd}). Use only the most recent update from today.
Return ONLY { "postedAt": string (e.g. "2:00 p.m."), "lots": [ { "lot": "C1", "percentFull": number } ] }.
If there is no update dated exactly ${mmdd}, return { "postedAt": null, "lots": [] }. Never reuse numbers from another day.

SEARCH RESULTS:
${C.resultsText(results)}`,
    messages: [{ role: 'user', content: 'Return the JSON object.' }], maxTokens: 500,
  });
  const p = C.parseJsonObject(text) || {};
  const lots = Array.isArray(p.lots) ? p.lots.filter((l) => /^C\d+$/.test(l.lot) && Number.isFinite(l.percentFull)).map((l) => ({ lot: l.lot, percentFull: Math.max(0, Math.min(100, Math.round(l.percentFull))) })) : [];
  const value = { postedAt: lots.length ? (p.postedAt || null) : null, lots };
  await C.setCached(key, value);
  return { ...value, cached: false };
});

/* ---------------- Finals grid ----------------
   Reads the university's own "Final Examination Schedule by Exam
   Time" page for the requested term. Returns grid: [] until that
   page exists for the term — the app then shows the official link
   instead of guessing. */
const TERMS = { 'fall-2026': { label: 'Fall 2026', query: 'Texas Tech "Final Examination Schedule by Exam Time" Fall 2026' } };

exports.getFinals = onCall(C.callOpts(BOTH), async (request) => {
  await lookup(request);
  const term = TERMS[(request.data || {}).term] || TERMS['fall-2026'];
  const key = `finals_${term.label.replace(/\W/g, '')}`;
  const hit = await C.getCached(key, 24 * HOUR);
  if (hit && hit.grid && hit.grid.length) return { ...hit, cached: true };
  const neg = await C.getCached(`${key}__empty`, 12 * HOUR);
  if (neg) return { grid: [], sourceUrl: null, cached: true };

  const results = await C.tavilySearch({ query: term.query, maxResults: 6 });
  const page = (results.results || []).find((r) => /depts\.ttu\.edu\/officialpublications\/class_schedule/i.test(r.url)
    && new RegExp(term.label.replace(' ', '\\s*'), 'i').test(`${r.title} ${r.content}`) && /exam time|class time/i.test(r.title));
  if (!page) { await C.setCached(`${key}__empty`, true); return { grid: [], sourceUrl: null, cached: false }; }
  const ex = await C.tavilyExtract([page.url]);
  const raw = ((ex.results || [])[0] || {}).raw_content || page.content;
  const text = await C.claudeText({
    system: `This is Texas Tech's official ${term.label} final exam schedule organized by class meeting time. Convert it to ONLY a JSON array:
[{ "days": ["M","W","F"], "classStart": "9:00 AM", "examDate": "Mon, Dec 7", "examTime": "10:30 AM–1:00 PM" }]
Use day codes M,T,W,Th,F,Sa,Su. One entry per class-time row. If the page is not the ${term.label} schedule, return [].

PAGE:
${String(raw).slice(0, 30000)}`,
    messages: [{ role: 'user', content: 'Return the JSON array.' }], maxTokens: 3000,
  });
  const grid = C.parseJsonArray(text).filter((r) => Array.isArray(r.days) && r.classStart && r.examDate);
  const value = { grid, sourceUrl: page.url };
  if (grid.length) await C.setCached(key, value); else await C.setCached(`${key}__empty`, true);
  return { ...value, cached: false };
});

/* ---------------- Usage readout ---------------- */
exports.getUsage = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const s = await db.collection('usage').doc(`${uid}_${C.today()}`).get();
  const plus = await C.isPlus(uid);
  return { pilot: (s.exists && s.data().pilot) || 0, pilotLimit: plus ? LIMITS.pilotPlus : LIMITS.pilotFree, plus };
});
