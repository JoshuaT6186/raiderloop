/**
 * RaiderLoop Cloud Functions — real Claude + Tavily integration
 * -----------------------------------------------------------
 * Two secrets needed now, not one:
 *   ANTHROPIC_API_KEY  — console.anthropic.com
 *   TAVILY_API_KEY     — app.tavily.com (separate signup, has a
 *                        free tier; Tavily is a search API built
 *                        for AI/agent use — it returns real,
 *                        current web results AND real images
 *                        alongside them, not just text)
 *
 * SETUP (run once, in addition to what was already done for
 * askRed/parseSchedule):
 *   firebase functions:secrets:set TAVILY_API_KEY
 *   firebase deploy --only functions
 *
 * Functions in this file:
 *   askRed            — real AI chat, now with live web search as
 *                        a tool it can reach for when the app's own
 *                        data doesn't cover the question
 *   parseSchedule     — reads a schedule screenshot -> structured classes
 *   getEvents         — real, current campus events (replaces the
 *                        fabricated EVENTS array that was cut)
 *   getSportsSchedule — real full-season schedule for a given sport
 *   getDiningMenus    — real, current daily dining hall menus
 *   getCampusAlerts   — real current parking/facilities notices
 *   enrichOrg         — a real photo/social link for one student org
 *
 * CACHING — important, not optional: search + Claude calls cost
 * real money and take real seconds. Hitting Tavily/Claude fresh on
 * every single app open would be slow and needlessly expensive.
 * Every search-backed function below checks Firestore for a
 * recent cached result before searching again, and writes its
 * result back with a timestamp. Firestore is enabled by default
 * on a Blaze-plan Firebase project — nothing extra to turn on.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const TAVILY_API_KEY = defineSecret('TAVILY_API_KEY');
const MODEL = 'claude-sonnet-4-6';

async function callClaude({ apiKey, system, messages, maxTokens, tools }) {
  const body = { model: MODEL, max_tokens: maxTokens, system, messages };
  if (tools) body.tools = tools;
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new HttpsError('internal', `Claude API error (${resp.status}): ${errText}`);
  }
  return resp.json();
}

async function callClaudeText(args) {
  const data = await callClaude(args);
  return (data.content || []).map((b) => b.text || '').join('');
}

/* Tavily search — returns real web results and, when
   include_images is true, real image URLs pulled from those
   results. This is the piece plain web search doesn't give you
   for free: an image alongside a real, current answer. */
async function tavilySearch({ apiKey, query, includeImages = false, maxResults = 5 }) {
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      include_images: includeImages,
      max_results: maxResults,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new HttpsError('internal', `Tavily API error (${resp.status}): ${errText}`);
  }
  return resp.json();
}

/* Simple Firestore-backed cache with a time-to-live. Returns the
   cached value if it's fresher than maxAgeMs, otherwise null —
   callers search again and overwrite it on a null. This is what
   keeps a "real, live" feature from also being a "slow and
   expensive on every tap" feature. */
async function getCached(key, maxAgeMs) {
  const doc = await db.collection('cache').doc(key).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data.cachedAt || Date.now() - data.cachedAt > maxAgeMs) return null;
  return data.value;
}
async function setCached(key, value) {
  await db.collection('cache').doc(key).set({ value, cachedAt: Date.now() });
}

const HOUR = 60 * 60 * 1000;

/* ============================================================
   RECENCY GUARD — shared by every search-backed prompt
   ------------------------------------------------------------
   Tavily searches the live web, but "live" only means the page is
   reachable, NOT that its content is current. Real failures this
   caused: a 2024 Homecoming Parade shown as an upcoming event, and
   a RESOLVED March 2025 power-outage closure shown at the top of
   Home as if campus were closed right now. That second one is the
   reason this is a shared guard and not a one-off patch — a stale
   "campus is closed" notice can actually mislead someone, not just
   look dated.

   The model can't judge recency without being told how, so this
   gives it concrete, checkable rules: compare against today's real
   date (injected, since the model has no clock), and treat
   past-tense resolution language as disqualifying on its own. */
function recencyGuard() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return `
TODAY'S REAL DATE IS ${today}. You have no clock of your own — use that date, and only that date, to judge whether something is current.

RECENCY RULES (apply before including ANY entry):
1. If an entry's date is before ${today}, DROP IT. A real page about a real past event is still a past event.
2. If you cannot determine a specific date for an entry, DROP IT. Never assume something undated is current.
3. Watch the year specifically. A date like "October 18" with no year, on a page from a previous year, is NOT this year — drop it.
4. DROP anything written in past tense or describing something already resolved. Phrases like "was closed", "remained closed", "has been restored", "was cancelled", "students gathered", "officials provided an update" all indicate a finished event being reported on, not something happening now.
5. When uncertain whether something is current, DROP IT. An empty result is correct and useful; a stale result presented as current is a real failure.`;
}




/* ============================================================
   ASK RED — real AI, grounded in real app data, with a real
   escape hatch to live search
   ------------------------------------------------------------
   Two sources of truth now, not one:
   1. `context` — the compact snapshot of real app data (schedule,
      buildings, orgs, weather) the client already assembles.
   2. A `search_ttu_web` TOOL Claude can call when the question is
      genuinely outside that snapshot — "what's the add/drop
      deadline," "who's the current SBP" — the kind of fact that
      would go stale in a written-once document, which is exactly
      why that idea got rejected earlier in favor of searching
      fresh at question-time instead of memorizing something that
      rots.

   This is a real two-round-trip tool-use exchange: ask Claude,
   check if it asked to use the tool, actually call Tavily if so,
   send the result back, get the real final answer. Not a keyword
   guess at when to search — Claude decides based on the question.
   ============================================================ */
exports.askRed = onCall({ secrets: [ANTHROPIC_API_KEY, TAVILY_API_KEY], cors: true }, async (request) => {
  const { question, context } = request.data || {};
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new HttpsError('invalid-argument', 'question is required');
  }

  const system = `You are Red, the assistant inside RaiderLoop, a Texas Tech University student app.

First, try to answer using the real data given to you below inside <context>. If the answer isn't there but is the kind of real-world fact a live web search could find (deadlines, current office holders, current TTU policies, current events), use the search_ttu_web tool rather than guessing or refusing. If neither the context nor a search turns up a real answer, say plainly you don't have verified information on it — never invent a building name, event time, class, or organization detail.

Keep answers short: 1-3 sentences, friendly, direct.

<context>
${context || 'No additional context was provided for this question.'}
</context>`;

  const tools = [{
    name: 'search_ttu_web',
    description: 'Search the live web for current, real information not covered by the app context above — deadlines, current office holders, current campus news, or anything else that could have changed recently.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'A short, specific search query.' } },
      required: ['query'],
    },
  }];

  const messages = [{ role: 'user', content: question }];
  let data = await callClaude({
    apiKey: ANTHROPIC_API_KEY.value(), system, messages, maxTokens: 400, tools,
  });
  const toolUse = (data.content || []).find((b) => b.type === 'tool_use');

  if (toolUse && toolUse.name === 'search_ttu_web') {
    const query = `${toolUse.input.query} Texas Tech University`;
    const results = await tavilySearch({ apiKey: TAVILY_API_KEY.value(), query, maxResults: 4 });
    const summary = (results.results || [])
      .map((r) => `${r.title}: ${r.content}`.slice(0, 400))
      .join('\n\n') || 'No results found.';

    messages.push({ role: 'assistant', content: data.content });
    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: summary }],
    });

    data = await callClaude({ apiKey: ANTHROPIC_API_KEY.value(), system, messages, maxTokens: 400, tools });
  }

  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    || "I don't have verified information on that yet.";

  return { text };
});

/* ============================================================
   PARSE SCHEDULE — real vision, structured output
   ------------------------------------------------------------
   Sends the screenshot to Claude with an explicit instruction to
   return ONLY JSON matching the app's real class shape (title,
   days as M/T/W/Th/F/Sa/Su codes, time, endTime, building name
   as written on screen). The client is responsible for matching
   that building name against the real 199-building list and
   letting the student confirm before saving — vision models can
   misread a screenshot, so this should never silently auto-save.
   ============================================================ */
exports.parseSchedule = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { imageBase64, mediaType } = request.data || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'imageBase64 is required');
  }

  const system = `Extract a class schedule from this screenshot of a university registration/schedule page.

Return ONLY valid JSON — no prose, no markdown code fences, nothing but the array itself. Each entry:
{
  "title": string,           // course code/name as shown, e.g. "CS 1412"
  "days": string[],          // only use these exact codes: "M","T","W","Th","F","Sa","Su"
  "time": string,             // start time like "9:00 AM"
  "endTime": string,          // end time like "9:50 AM"
  "building": string          // building name exactly as written on screen
}

If you can't confidently read a field, omit that whole entry rather than guessing. If the image isn't a schedule at all, return an empty array.`;

  const text = await callClaudeText({
    apiKey: ANTHROPIC_API_KEY.value(),
    system,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: 'Extract the schedule as JSON, per the format specified.' },
      ],
    }],
    maxTokens: 1200,
  });

  let classes;
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    classes = JSON.parse(cleaned);
    if (!Array.isArray(classes)) throw new Error('not an array');
  } catch (e) {
    // Claude occasionally adds a stray sentence despite instructions
    // not to — try pulling just the [...] block out before giving up,
    // rather than failing on the first strict-parse attempt.
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        classes = JSON.parse(match[0]);
        if (!Array.isArray(classes)) throw new Error('not an array');
      } catch (e2) {
        throw new HttpsError('internal', `Model reply wasn't valid JSON: ${cleaned.slice(0, 200)}`);
      }
    } else {
      throw new HttpsError('internal', `Model reply wasn't valid JSON: ${cleaned.slice(0, 200)}`);
    }
  }

  return { classes };
});

/* ============================================================
   GET EVENTS — replaces the fabricated EVENTS array
   ------------------------------------------------------------
   Searches for real, current TTU campus events, then has Claude
   structure the messy web results into the app's real event
   shape. Cached for 3 hours — events don't need per-second
   freshness, and this keeps cost/latency sane.
   ============================================================ */
exports.getEvents = onCall({ secrets: [ANTHROPIC_API_KEY, TAVILY_API_KEY], cors: true }, async () => {
  const cacheKey = 'events';
  const cached = await getCached(cacheKey, 3 * HOUR);
  if (cached && cached.length) return { events: cached, cached: true };

  const results = await tavilySearch({
    apiKey: TAVILY_API_KEY.value(),
    query: 'Texas Tech University campus events this week Lubbock',
    includeImages: true,
    maxResults: 8,
  });
  const raw = (results.results || []).map((r) => `${r.title}\n${r.content}\nSource: ${r.url}`).join('\n\n---\n\n');
  const images = (results.images || []).slice(0, 8);

  const system = `Extract real, distinct campus events from this search-result text about Texas Tech University. Return ONLY a JSON array, no prose. Each entry:
{
  "title": string,
  "org": string,            // hosting organization if stated, else "Texas Tech"
  "date": string,            // as stated — a real date or day name, never invent one
  "time": string,            // as stated, else ""
  "location": string,        // building/venue name as stated, else ""
  "desc": string,            // one sentence, your own words, not copied verbatim
  "sourceUrl": string
}
Only include events with a real stated date — skip anything where you're inferring or guessing the date. If nothing qualifies, return [].
${recencyGuard()}

SEARCH RESULTS:
${raw}`;

  const text = await callClaudeText({ apiKey: ANTHROPIC_API_KEY.value(), system, messages: [{ role: 'user', content: 'Extract the events as JSON.' }], maxTokens: 1500 });
  let events;
  try {
    events = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!Array.isArray(events)) throw new Error('not array');
  } catch (e) {
    const m = text.match(/\[[\s\S]*\]/);
    events = m ? JSON.parse(m[0]) : [];
  }
  // Attach a real image to each event where one's available — not
  // matched precisely to content, just distributed from real
  // results of the same search, which beats a generic stock photo.
  events = events.map((e, i) => ({ ...e, img: images[i % (images.length || 1)] || null }));

  await setCached(cacheKey, events);
  return { events, cached: false };
});

/* ============================================================
   GET NEWS — real Daily Toreador / Lubbock headlines, real images
   ------------------------------------------------------------
   This is the one that should have been built alongside getEvents
   — it's the actual original reason Tavily came up tonight, and it
   got missed. Same pattern as getEvents: search, structure with
   Claude, attach real images from the same search's results. Note
   on image attribution: Tavily's `images` array isn't guaranteed
   to map 1:1 to a specific result, so images are distributed
   across the real headlines from the same search rather than
   claimed to be precisely matched to one article — same honest
   caveat as getEvents' image handling.
   ============================================================ */
exports.getNews = onCall({ secrets: [ANTHROPIC_API_KEY, TAVILY_API_KEY], cors: true }, async () => {
  const cacheKey = 'news';
  const cached = await getCached(cacheKey, 3 * HOUR);
  if (cached && cached.length) return { news: cached, cached: true };

  const results = await tavilySearch({
    apiKey: TAVILY_API_KEY.value(),
    query: 'Texas Tech Daily Toreador Lubbock news today',
    includeImages: true,
    maxResults: 8,
  });
  const raw = (results.results || []).map((r) => `${r.title}\n${r.content}\nSource: ${r.url}`).join('\n\n---\n\n');
  const images = (results.images || []).slice(0, 8);

  const system = `Extract real, distinct news headlines from this search-result text about Texas Tech and Lubbock. Return ONLY a JSON array, no prose. Each entry:
{
  "headline": string,
  "source": string,           // real outlet name as stated (e.g. "The Daily Toreador", "KCBD NewsChannel 11") — never invent one
  "official": boolean,         // true only if source is "The Daily Toreador" (TTU's own student paper)
  "byline": string | null,     // real author name if stated, else null
  "date": string,               // as stated — real date, never invent one
  "excerpt": string,            // one sentence in your own words, not copied from the article
  "url": string
}
Only include real stories with a real stated source and date. If nothing qualifies, return [].
${recencyGuard()}

For news specifically: a story published in a previous year is not current news. Recent stories (within the last few weeks) are fine — past-tense reporting is normal for news, so rule 4 above applies to whether the STORY is old, not to whether it describes something that already happened.

SEARCH RESULTS:
${raw}`;

  const text = await callClaudeText({ apiKey: ANTHROPIC_API_KEY.value(), system, messages: [{ role: 'user', content: 'Extract the headlines as JSON.' }], maxTokens: 1500 });
  let news;
  try {
    news = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!Array.isArray(news)) throw new Error('not array');
  } catch (e) {
    const m = text.match(/\[[\s\S]*\]/);
    news = m ? JSON.parse(m[0]) : [];
  }
  news = news.map((n, i) => ({ ...n, art: images[i % (images.length || 1)] || null }));

  await setCached(cacheKey, news);
  return { news, cached: false };
});

/* ============================================================
   GET SPORTS SCHEDULE — real, full-season
   ------------------------------------------------------------
   One sport per call. Cached for 24 hours — a season schedule
   almost never changes hour to hour, so this is deliberately a
   longer TTL than events.
   ============================================================ */
exports.getSportsSchedule = onCall({ secrets: [ANTHROPIC_API_KEY, TAVILY_API_KEY], cors: true }, async (request) => {
  const { sport } = request.data || {};
  if (!sport || typeof sport !== 'string') throw new HttpsError('invalid-argument', 'sport is required (e.g. "football", "basketball")');

  const cacheKey = `sports_${sport.toLowerCase().replace(/[^a-z]/g, '')}`;
  const cached = await getCached(cacheKey, 24 * HOUR);
  if (cached && cached.length) return { schedule: cached, cached: true };

  const results = await tavilySearch({
    apiKey: TAVILY_API_KEY.value(),
    query: `Texas Tech ${sport} 2026 schedule`,
    maxResults: 6,
  });
  const raw = (results.results || []).map((r) => `${r.title}\n${r.content}\nSource: ${r.url}`).join('\n\n---\n\n');

  const system = `Extract the real Texas Tech ${sport} schedule from this search-result text. Return ONLY a JSON array, no prose. Each entry:
{
  "opponent": string,
  "date": string,       // as stated, real date
  "time": string,        // as stated, else ""
  "homeAway": "home" | "away" | "neutral",
  "venue": string        // as stated, else ""
}
Only include games with a real stated date. If you can't find a real schedule in this text, return [].

SEARCH RESULTS:
${raw}`;

  const text = await callClaudeText({ apiKey: ANTHROPIC_API_KEY.value(), system, messages: [{ role: 'user', content: 'Extract the schedule as JSON.' }], maxTokens: 1500 });
  let schedule;
  try {
    schedule = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!Array.isArray(schedule)) throw new Error('not array');
  } catch (e) {
    const m = text.match(/\[[\s\S]*\]/);
    schedule = m ? JSON.parse(m[0]) : [];
  }

  await setCached(cacheKey, schedule);
  return { schedule, cached: false };
});

/* ============================================================
   GET DINING MENUS — real, current, per dining hall
   ------------------------------------------------------------
   Cached for 12 hours — a daily menu is stable across a day but
   should refresh once it's genuinely a new day.
   ============================================================ */
exports.getDiningMenus = onCall({ secrets: [ANTHROPIC_API_KEY, TAVILY_API_KEY], cors: true }, async () => {
  const cacheKey = 'dining_menus';
  const cached = await getCached(cacheKey, 12 * HOUR);
  if (cached && cached.length) return { menus: cached, cached: true };

  const results = await tavilySearch({
    apiKey: TAVILY_API_KEY.value(),
    query: 'Texas Tech dining hall menu today Lubbock hospitality services',
    maxResults: 6,
  });
  const raw = (results.results || []).map((r) => `${r.title}\n${r.content}\nSource: ${r.url}`).join('\n\n---\n\n');

  const system = `Extract real, current dining hall menu items from this search-result text about Texas Tech dining. Return ONLY a JSON array, no prose. Each entry:
{
  "hall": string,           // dining hall/location name as stated
  "items": string[]          // real menu items as stated — do not invent food items
}
If the text doesn't contain real current menu items, return [] rather than guessing typical cafeteria food.

SEARCH RESULTS:
${raw}`;

  const text = await callClaudeText({ apiKey: ANTHROPIC_API_KEY.value(), system, messages: [{ role: 'user', content: 'Extract the menus as JSON.' }], maxTokens: 1200 });
  let menus;
  try {
    menus = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!Array.isArray(menus)) throw new Error('not array');
  } catch (e) {
    const m = text.match(/\[[\s\S]*\]/);
    menus = m ? JSON.parse(m[0]) : [];
  }

  await setCached(cacheKey, menus);
  return { menus, cached: false };
});

/* ============================================================
   GET CAMPUS ALERTS — real current parking/facilities notices
   ------------------------------------------------------------
   Cached for 6 hours. Returns [] rather than a fabricated
   placeholder when nothing real turns up — an empty alerts list
   is the correct, honest state most of the time.
   ============================================================ */
exports.getCampusAlerts = onCall({ secrets: [ANTHROPIC_API_KEY, TAVILY_API_KEY], cors: true }, async () => {
  const cacheKey = 'campus_alerts';
  const cached = await getCached(cacheKey, 6 * HOUR);
  if (cached && cached.length) return { alerts: cached, cached: true };

  const results = await tavilySearch({
    apiKey: TAVILY_API_KEY.value(),
    query: 'Texas Tech University parking closure facilities notice Lubbock campus',
    maxResults: 5,
  });
  const raw = (results.results || []).map((r) => `${r.title}\n${r.content}\nSource: ${r.url}`).join('\n\n---\n\n');

  const system = `Extract real, currently-active campus alerts (parking closures, facility outages, construction notices) for Texas Tech from this search-result text. Return ONLY a JSON array, no prose. Each entry:
{ "title": string, "body": string, "source": string, "date": string }
${recencyGuard()}

An alert must describe something affecting campus RIGHT NOW or in the near future. A resolved incident, however real it was, is not an alert — it is history, and showing it as an alert would wrongly tell a student something is happening when it isn't.

If nothing in the text describes a real, currently-active alert, return [] — an empty list is the correct and expected result most days. Never invent a generic-sounding notice just to have something to show.

SEARCH RESULTS:
${raw}`;

  const text = await callClaudeText({ apiKey: ANTHROPIC_API_KEY.value(), system, messages: [{ role: 'user', content: 'Extract real alerts as JSON.' }], maxTokens: 800 });
  let alerts;
  try {
    alerts = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!Array.isArray(alerts)) throw new Error('not array');
  } catch (e) {
    const m = text.match(/\[[\s\S]*\]/);
    alerts = m ? JSON.parse(m[0]) : [];
  }

  await setCached(cacheKey, alerts);
  return { alerts, cached: false };
});

/* ============================================================
   ENRICH ORG — a real photo/social link for one org, on demand
   ------------------------------------------------------------
   Called lazily when a student actually opens an org's detail
   screen, not batch-run for all 25 up front — most orgs a given
   student looks at will be a small fraction of the list, so this
   avoids paying for enrichment nobody ever views. Cached for 7
   days per org since a club's social presence doesn't change fast.
   ============================================================ */
exports.enrichOrg = onCall({ secrets: [ANTHROPIC_API_KEY, TAVILY_API_KEY], cors: true }, async (request) => {
  const { orgName } = request.data || {};
  if (!orgName || typeof orgName !== 'string') throw new HttpsError('invalid-argument', 'orgName is required');

  const cacheKey = `org_${orgName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
  const cached = await getCached(cacheKey, 7 * 24 * HOUR);
  if (cached) return { ...cached, cached: true };

  const results = await tavilySearch({
    apiKey: TAVILY_API_KEY.value(),
    query: `"${orgName}" Texas Tech University Instagram OR TechConnect`,
    includeImages: true,
    maxResults: 5,
  });
  const raw = (results.results || []).map((r) => `${r.title}\n${r.content}\nSource: ${r.url}`).join('\n\n---\n\n');
  const image = (results.images || [])[0] || null;

  const system = `Given these search results about a Texas Tech student organization called "${orgName}", identify:
{
  "instagramUrl": string | null,   // their real Instagram profile URL if found, else null
  "activeSignal": string | null     // a short, honest note on whether they appear currently active (e.g. "posted recently" / "no recent activity found"), else null if unclear
}
Return ONLY that JSON object, no prose. Never invent a URL — null if you're not confident it's real and belongs to this specific org.

SEARCH RESULTS:
${raw}`;

  const text = await callClaudeText({ apiKey: ANTHROPIC_API_KEY.value(), system, messages: [{ role: 'user', content: 'Return the JSON object.' }], maxTokens: 300 });
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (e) {
    parsed = { instagramUrl: null, activeSignal: null };
  }

  const value = { instagramUrl: parsed.instagramUrl || null, activeSignal: parsed.activeSignal || null, image };
  await setCached(cacheKey, value);
  return { ...value, cached: false };
});

/* ============================================================
   GET VENUE IMAGE — a real photo, kept separate from verified facts
   ------------------------------------------------------------
   Featured and the Sports tile show hand-verified facts (opponent,
   date, time — confirmed from multiple sources, not searched at
   request time). This function does NOT touch those facts — it
   only finds a real photo to pair with them, on a long cache (30
   days, a stadium doesn't change appearance week to week), so a
   search hiccup here can never put a wrong fact in front of a
   student, only occasionally a generic photo.
   ============================================================ */
exports.getVenueImage = onCall({ secrets: [TAVILY_API_KEY], cors: true }, async (request) => {
  const { query } = request.data || {};
  if (!query || typeof query !== 'string') throw new HttpsError('invalid-argument', 'query is required');

  const cacheKey = `venue_img_${query.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
  const cached = await getCached(cacheKey, 30 * 24 * HOUR);
  if (cached) return { image: cached, cached: true };

  const results = await tavilySearch({ apiKey: TAVILY_API_KEY.value(), query, includeImages: true, maxResults: 5 });
  const image = (results.images || [])[0] || null;
  if (image) await setCached(cacheKey, image);
  return { image, cached: false };
});

/* ============================================================
   GET DINING HALL DETAIL — real vendor list + hours, on demand
   ------------------------------------------------------------
   Lazy: only called when a student actually taps into a specific
   hall, not loaded in bulk for every dining entry up front. Seeded
   with real, verified vendor data (not searched fresh each time)
   since which restaurants live in which hall doesn't change often;
   Tavily fills in anything the seed doesn't cover. Cached 7 days.
   ============================================================ */
const DINING_HALL_SEED = {
  'student union': ['Pizza Hut', 'Raider Pit BBQ', "Boar's Head Deli", 'SUB to Go', 'Chick-fil-A', 'The Break Acai Bowls & Smoothies'],
  'stangel': ['The Market', 'Corner Market Retail Shop', 'Day Break Coffee Roasters', "Fazoli's"],
  'murdough': ['The Market', 'Corner Market Retail Shop', 'Day Break Coffee Roasters', "Fazoli's"],
  'talkington': ['The Commons', 'Einstein Bros Bagels'],
  'wall': ['The Fresh Plate'],
  'gates': ['The Fresh Plate'],
  'sneed': ['Sneed East Dining'],
  'murray': ["Sam's Place"],
  'west village': ['Raider Exchange'],
  'rawls': ['Chick-fil-A', 'Einstein Bros Bagels'],
  'wiggins': ["Sam's Place West"],
};

exports.getDiningHallDetail = onCall({ secrets: [ANTHROPIC_API_KEY, TAVILY_API_KEY], cors: true }, async (request) => {
  const { hallName } = request.data || {};
  if (!hallName || typeof hallName !== 'string') throw new HttpsError('invalid-argument', 'hallName is required');

  const cacheKey = `dining_detail_${hallName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
  const cached = await getCached(cacheKey, 7 * 24 * HOUR);
  if (cached && cached.vendors && cached.vendors.length) return { ...cached, cached: true };

  const hallLower = hallName.toLowerCase();
  const seedKey = Object.keys(DINING_HALL_SEED).find((k) => hallLower.includes(k));
  let vendors = seedKey ? DINING_HALL_SEED[seedKey] : [];

  // Seed data covers the known food-court-style halls. For anything
  // not in the seed, try a real search rather than assume it's a
  // single-vendor spot with nothing to show.
  if (!vendors.length) {
    const results = await tavilySearch({
      apiKey: TAVILY_API_KEY.value(), query: `Texas Tech ${hallName} dining hall restaurants vendors`, maxResults: 4,
    });
    const raw = (results.results || []).map((r) => `${r.title}\n${r.content}`).join('\n\n---\n\n');
    const system = `From this search text, list the real named restaurants/vendors/stations located INSIDE the Texas Tech dining location called "${hallName}".

CRITICAL — this search may return results about OTHER dining locations on campus. A real vendor name from a different building is still wrong here. Only list a vendor if the text explicitly and specifically ties it to "${hallName}" itself. If the results are mostly about other locations, or you're matching on general campus-dining content rather than this exact place, return [].

Many locations are single-vendor spots (a standalone chain restaurant) with nothing "inside" them — for those, [] is the correct answer, not a guess at what a food court might contain.

Return ONLY a JSON array of strings (vendor names).

SEARCH RESULTS:
${raw}`;
    const text = await callClaudeText({ apiKey: ANTHROPIC_API_KEY.value(), system, messages: [{ role: 'user', content: 'Return the JSON array.' }], maxTokens: 400 });
    try {
      vendors = JSON.parse(text.replace(/```json|```/g, '').trim());
      if (!Array.isArray(vendors)) vendors = [];
    } catch (e) {
      vendors = [];
    }
  }

  const value = { vendors, isFoodCourt: vendors.length > 1 };
  await setCached(cacheKey, value);
  return { ...value, cached: false };
});