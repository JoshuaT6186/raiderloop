/**
 * Places Flyer finds for students, never added by users:
 *   • Student deals: stores in Lubbock that advertise a student or
 *     student-ID discount. Found weekly from the web (Tavily), read by
 *     the AI, and placed on the map. Each keeps its source link and
 *     says "found online, ask at the register".
 *   • Explore Lubbock: a hand-picked list of places students are
 *     usually pointed to, shown on the map in purple.
 * Map spots come from OpenStreetMap (Nominatim), one lookup per
 * second at most, cached forever in Firestore.
 */
const crypto = require('crypto');
const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const C = require('./common');

const { db, FieldValue, HOUR } = C;
const BOTH = [C.ANTHROPIC_API_KEY, C.TAVILY_API_KEY, ...C.backupAISecrets];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LUBBOCK_BOX = '-102.10,33.72,-101.70,33.45'; // left,top,right,bottom

/* ---------- Geocoding (OpenStreetMap) ---------- */
let lastGeo = 0;
async function geocode(q) {
  const key = crypto.createHash('sha1').update(String(q).toLowerCase()).digest('hex').slice(0, 24);
  const ref = db.doc(`geo/${key}`);
  const hit = await ref.get();
  if (hit.exists) return hit.data().lat != null ? { lat: hit.data().lat, lng: hit.data().lng } : null;
  const wait = 1100 - (Date.now() - lastGeo);
  if (wait > 0) await sleep(wait);
  lastGeo = Date.now();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&viewbox=${LUBBOCK_BOX}&bounded=1&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'user-agent': 'FlyerCampusApp/1.0 (Flyer campus app; https://raiderloop-98046.web.app)', accept: 'application/json' } });
    const j = r.ok ? await r.json() : [];
    const p = Array.isArray(j) && j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
    await ref.set({ q: String(q).slice(0, 200), lat: p ? p.lat : null, lng: p ? p.lng : null, at: FieldValue.serverTimestamp() });
    return p;
  } catch (e) {
    console.error('geocode failed', q, e.message);
    return null;
  }
}

/* ---------- Explore Lubbock ---------- */
const EXPLORE = [
  { id: 'buddy-holly-center', name: 'Buddy Holly Center', kind: 'Music + museum', why: "Lubbock's own rock and roll legend, in the Depot District.", q: 'Buddy Holly Center, Lubbock' },
  { id: 'depot-district', name: 'Depot District', kind: 'Nightlife + food', why: 'Live music, restaurants and coffee a short drive from campus.', q: 'Depot District, Lubbock' },
  { id: 'nrhc', name: 'National Ranching Heritage Center', kind: 'Museum', why: 'Historic ranch buildings on the edge of campus. Free.', q: 'National Ranching Heritage Center, Lubbock' },
  { id: 'museum-ttu', name: 'Museum of Texas Tech University', kind: 'Museum', why: 'Art, natural history and a planetarium, right on campus.', q: 'Museum of Texas Tech University, Lubbock' },
  { id: 'lubbock-lake', name: 'Lubbock Lake Landmark', kind: 'Outdoors', why: 'Trails through 12,000 years of history.', q: 'Lubbock Lake Landmark' },
  { id: 'prairie-dog-town', name: 'Prairie Dog Town', kind: 'Outdoors', why: 'A Lubbock classic inside Mackenzie Park. Free.', q: 'Prairie Dog Town, Mackenzie Park, Lubbock' },
  { id: 'mackenzie-park', name: 'Mackenzie Park', kind: 'Outdoors', why: 'Big park for picnics, disc golf and walks.', q: 'Mackenzie Park, Lubbock' },
  { id: 'science-spectrum', name: 'Science Spectrum', kind: 'Museum', why: 'Hands-on science museum with a dome theater.', q: 'Science Spectrum, Lubbock' },
  { id: 'silent-wings', name: 'Silent Wings Museum', kind: 'Museum', why: 'The story of the WWII glider pilots.', q: 'Silent Wings Museum, Lubbock' },
  { id: 'wind-power-center', name: 'American Windmill Museum', kind: 'Museum', why: 'A huge collection of windmills, very West Texas.', q: 'American Windmill Museum, Lubbock' },
  { id: 'cactus-theater', name: 'Cactus Theater', kind: 'Shows', why: 'Restored 1938 theater with live music on Buddy Holly Avenue.', q: 'Cactus Theater, Lubbock' },
  { id: 'arboretum', name: 'Lubbock Memorial Arboretum', kind: 'Outdoors', why: 'Quiet gardens to study or decompress.', q: 'Lubbock Memorial Arboretum' },
  { id: 'joyland', name: 'Joyland Amusement Park', kind: 'Fun', why: 'Seasonal rides and coasters in Mackenzie Park.', q: 'Joyland Amusement Park, Lubbock' },
  { id: 'broadway-festivals', name: 'Broadway Avenue murals', kind: 'Walk', why: 'Murals and old buildings between campus and downtown.', q: 'Broadway Avenue and Avenue Q, Lubbock' },
];

async function buildExplore() {
  const out = [];
  for (const p of EXPLORE) {
    const g = await geocode(p.q);
    out.push({ id: p.id, name: p.name, kind: p.kind, why: p.why, lat: g ? g.lat : null, lng: g ? g.lng : null });
  }
  return out;
}

exports.getExplore = onCall(C.callOpts(), async (request) => {
  C.requireAuth(request);
  const hit = await C.getCached('explore_v1', 30 * 24 * HOUR);
  if (hit && hit.length) return { places: hit, cached: true };
  const places = await buildExplore();
  if (places.some((p) => p.lat != null)) await C.setCached('explore_v1', places);
  return { places, cached: false };
});

/* ---------- Student deals, found weekly ---------- */
const DEAL_QUERIES = [
  'Lubbock Texas student discount with student ID restaurant',
  'Lubbock TX Texas Tech student discount stores',
  'Lubbock college student discount coffee haircut movie',
];

async function findDeals() {
  const all = [];
  for (const query of DEAL_QUERIES) {
    try {
      const res = await C.tavilySearch({ query, maxResults: 6, depth: 'basic' });
      all.push(C.resultsText(res));
    } catch (e) { console.error('deal search', e.message); }
  }
  if (!all.length) return [];
  const text = await C.claudeText({
    system: `From these search results, list real businesses in Lubbock, Texas that clearly offer a student discount (student ID, college student, or Texas Tech student). Return ONLY a JSON array. Each:
{ "name": string, "offer": string (the discount as the source states it, short), "category": "Food"|"Coffee"|"Shopping"|"Fun"|"Services"|"Other", "address": string (street address in Lubbock if stated, else ""), "sourceUrl": string, "needsId": boolean }
Only include a business when the source text actually states a student discount. Never invent offers or addresses. If none qualify, return [].
${C.recencyGuard()}

SEARCH RESULTS:
${all.join('\n\n').slice(0, 30000)}`,
    messages: [{ role: 'user', content: 'Return the JSON array.' }], maxTokens: 2500,
  });
  return C.parseJsonArray(text).filter((d) => d && d.name && d.offer).slice(0, 30);
}

async function refreshDeals() {
  const found = await findDeals();
  let saved = 0;
  for (const d of found) {
    const id = `auto-${String(d.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`;
    const ref = db.doc(`deals/${id}`);
    const cur = await ref.get();
    if (cur.exists && cur.data().source && cur.data().source !== 'auto') continue; // never overwrite deals you added by hand
    const g = await geocode(d.address ? `${d.address}, Lubbock, TX` : `${d.name}, Lubbock, TX`);
    await ref.set({
      schoolId: 'ttu', active: true, source: 'auto', name: C.clean(d.name, 80), offer: C.clean(d.offer, 200),
      category: ['Food', 'Coffee', 'Shopping', 'Fun', 'Services', 'Other'].includes(d.category) ? d.category : 'Other',
      where: C.clean(d.address, 120), url: C.cleanUrl ? C.cleanUrl(d.sourceUrl) : String(d.sourceUrl || '').slice(0, 300),
      needsId: d.needsId !== false, online: false, fine: 'Found online. Ask at the register to confirm.',
      lat: g ? g.lat : null, lng: g ? g.lng : null, foundAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    saved += 1;
  }
  await C.setCached('deals_refreshed', { at: Date.now(), saved });
  return saved;
}

exports.refreshDealsWeekly = onSchedule({ schedule: 'every monday 09:00', timeZone: 'America/Chicago', secrets: BOTH, timeoutSeconds: 540, memory: '512MiB' }, async () => {
  try { await refreshDeals(); } catch (e) { console.error('refreshDeals', e.message); }
  try { const p = await buildExplore(); if (p.some((x) => x.lat != null)) await C.setCached('explore_v1', p); } catch (e) { console.error('explore', e.message); }
});

/* The first person to open Deals when the list is empty starts a
   search (at most once a day), so a new install isn't empty for a week. */
exports.dealsKickoff = onCall({ ...C.callOpts(BOTH), timeoutSeconds: 300 }, async (request) => {
  C.requireAuth(request);
  const last = await C.getCached('deals_refreshed', 24 * HOUR);
  if (last) return { ok: true, skipped: true };
  await C.setCached('deals_refreshed', { at: Date.now(), saved: 0, running: true });
  const saved = await refreshDeals();
  return { ok: true, saved };
});
