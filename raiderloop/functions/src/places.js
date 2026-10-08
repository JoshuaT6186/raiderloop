/**
 * Flight score: check-ins, stamps, building ratings, friend boards.
 * ------------------------------------------------------------
 * Every check-in is verified here, not on the phone: the place must
 * be on the list, you must be within ~150 m of it (one location read,
 * taken while the app is open), and games/events only count during
 * their time window. Daily and weekly caps stop anyone grinding
 * points. Rewards are cosmetic, so a determined GPS spoofer can only
 * cheat themselves; nothing valuable is attached to the score.
 *
 * Data:
 *   flight/{uid}        — score, stamps, caps, ratings I gave (owner-readable)
 *   placeRatings/{id}   — public averages, only once 5+ people rated
 *   ratingSums/{id}     — server-only running totals
 *   ratings/{id}_{uid}  — one rating per person per place (server-only)
 */
const { onCall } = require('firebase-functions/v2/https');
const C = require('./common');
const S = require('./socialCore');
const M = require('./meetupCore');
const {
  PLACES, RULES, P, placeById, levelFor, liveGameAt, checkPosition, applyPoints, stampPlace,
} = require('./placesCore');

const { db, FieldValue, HttpsError, clean } = C;

exports.checkIn = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  await C.takeQuota(uid, 'checkinTry', 40, "That's a lot of check-in attempts today. Try again tomorrow.");
  const now = Date.now();
  let place = null; let tier = null; let key = null; let label = null;

  if (d.eventId) {
    // Event check-in: the event must be in today's live feed, have a
    // real start time, be happening now, and be at a known building.
    const cache = await db.collection('cache').doc('events').get();
    const events = (cache.exists && cache.data().value) || [];
    const ev = events.find((e) => e.id === clean(d.eventId, 120));
    if (!ev || !ev.startsAt) throw new HttpsError('failed-precondition', "This event doesn't list a start time, so it can't be checked into.");
    const start = Date.parse(ev.startsAt);
    if (!(now >= start - RULES.eventWindow.beforeMin * 60000 && now <= start + RULES.eventWindow.afterMin * 60000)) {
      throw new HttpsError('failed-precondition', 'Event check-in opens 30 minutes before it starts and closes 3 hours after.');
    }
    const loc = String(ev.location || '').toLowerCase();
    place = PLACES.find((p) => loc && (loc.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(loc)));
    if (!place) throw new HttpsError('failed-precondition', "Flyer can't tell which building this event is in, so it can't be checked into.");
    tier = 'event'; key = `event:${ev.id}`; label = ev.title;
  } else {
    place = placeById(clean(d.placeId, 80));
    if (!place) throw new HttpsError('not-found', "That place isn't on the check-in list.");
    const game = liveGameAt(place.id, now);
    if (game) { tier = 'game'; key = `game:${game.kickoff}`; label = `vs. ${game.opponent}`; } else tier = place.tier;
  }
  checkPosition(place, d);
  const routine = Array.isArray(d.classBuildingIds) && d.classBuildingIds.includes(place.id);
  const result = await stampAt(uid, { place, tier, key, label, routine, now });
  return result;
});

/* Stamps a place inside a transaction, with the daily and weekly caps.
   Automatic check-ins (auto: true) never use up the daily limit on a
   visit that earns nothing, and stop quietly instead of erroring. */
async function stampAt(uid, { place, tier, key, label, routine, now, auto = false }) {
  const ref = db.doc(`flight/${uid}`);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const f = snap.exists ? snap.data() : {};
    const day = C.chicagoDay(now);
    const dayCount = f.ciDay === day ? (f.ciCount || 0) : 0;
    if (dayCount >= RULES.caps.checkInsPerDay) {
      if (auto) return { pts: 0, isNew: false, score: f.score || 0, capped: true, dayCapped: true };
      throw new HttpsError('resource-exhausted', `That's ${RULES.caps.checkInsPerDay} check-ins today. That's the limit, and tomorrow's a new page.`);
    }
    const { want, stamps, isNew } = stampPlace(f, place, { tier, key, routine, now });
    const { pts, patch } = applyPoints(f, want, now);
    const claimed = key ? { ...(f.claimed || {}), [key]: now } : (f.claimed || {});
    const counts = !auto || pts > 0 || isNew;
    tx.set(ref, { ...patch, ...(counts ? { ciDay: day, ciCount: dayCount + 1 } : {}), stamps, claimed, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { pts, isNew, score: patch.score, capped: pts < want };
  });
  const lvl = levelFor(result.score);
  let message;
  if (result.dayCapped) message = `That's ${RULES.caps.checkInsPerDay} check-ins today. Tomorrow's a new page.`;
  else if (routine && tier !== 'game' && tier !== 'event') message = `${place.name} is one of your class buildings, so it's on your map but earns no points.`;
  else if (result.pts > 0) message = `+${result.pts} at ${place.name}${label ? ` (${label})` : ''}`;
  else if (result.capped) message = "You've hit this week's point cap. The stamp still counts.";
  else message = `Already stamped ${place.name}${tier === 'rec' ? ' today' : ''}. Try somewhere new!`;
  return { ...result, title: lvl.title, next: lvl.next, placeId: place.id, placeName: place.name, tier, message };
}

/* A live event at this place right now, if the events feed has one
   with a real start time whose check-in window is open. */
async function liveEventAt(place, now) {
  const cache = await db.collection('cache').doc('events').get();
  const events = (cache.exists && cache.data().value) || [];
  const name = place.name.toLowerCase();
  return events.find((ev) => {
    if (!ev || !ev.startsAt || !ev.id) return false;
    const start = Date.parse(ev.startsAt);
    if (!(now >= start - RULES.eventWindow.beforeMin * 60000 && now <= start + RULES.eventWindow.afterMin * 60000)) return false;
    const loc = String(ev.location || '').toLowerCase();
    return loc && (loc.includes(name) || name.includes(loc));
  }) || null;
}

/* ---------- Automatic check-ins ----------
   The phone (with "Always" location on) notices you've spent a few
   minutes at a place on the list and sends that place plus one
   location reading. The server checks the distance and decides what it
   counts as: a game, a live event, the place itself, and any meetup
   you accepted there. */
exports.autoCheckIn = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  await C.takeQuota(uid, 'autoCheckin', 120, 'Too many automatic check-ins today.');
  const now = Date.now();
  const place = placeById(clean(d.placeId, 80));
  if (!place) throw new HttpsError('not-found', "That place isn't on the check-in list.");
  checkPosition(place, d);
  const routine = Array.isArray(d.classBuildingIds) && d.classBuildingIds.includes(place.id);

  let tier = place.tier; let key = null; let label = null;
  const game = liveGameAt(place.id, now);
  if (game) { tier = 'game'; key = `game:${game.kickoff}`; label = `vs. ${game.opponent}`; } else {
    const ev = await liveEventAt(place, now).catch(() => null);
    if (ev) {
      const f = (await db.doc(`flight/${uid}`).get()).data() || {};
      if (!(f.claimed || {})[`event:${ev.id}`]) { tier = 'event'; key = `event:${ev.id}`; label = ev.title; }
    }
  }
  const stamp = await stampAt(uid, { place, tier, key, label, routine, now, auto: true });

  // Any meetup I accepted at this place that's happening now.
  const meetups = [];
  const ms = await db.collection('meetups').where('members', 'array-contains', uid).get();
  for (const doc of ms.docs) {
    const m = doc.data();
    if (m.placeId !== place.id || (m.status || {})[uid] !== 'going' || (m.checkedIn || {})[uid] || !M.meetupOpen(m, now)) continue;
    try { meetups.push({ id: doc.id, ...(await M.arriveAtMeetup(uid, doc.id, place, now)) }); } catch (e) { /* canceled or closed meanwhile */ }
  }
  return { ...stamp, meetups };
});

exports.setFlightPrefs = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await db.doc(`flight/${uid}`).set({ showScore: !!request.data?.showScore }, { merge: true });
  return { ok: true };
});

/* Friend (or flock) leaderboard. Only people who turned on "Show my
   score to friends" appear, and only the total + title — never which
   places they've been. */
exports.getFlightBoard = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'board', 60);
  let ids;
  const friends = await S.friendIds(uid);
  const flockId = clean(request.data?.flockId, 80);
  if (flockId) {
    const chat = await db.doc(`chats/${flockId}`).get();
    if (!chat.exists || !(chat.data().members || []).includes(uid)) throw new HttpsError('permission-denied', "You're not in that flock.");
    ids = chat.data().members;
  } else {
    ids = [uid, ...friends];
  }
  const rows = await Promise.all(ids.slice(0, 60).map(async (id) => {
    const [f, card] = await Promise.all([db.doc(`flight/${id}`).get(), S.publicCard(id)]);
    const fd = f.exists ? f.data() : {};
    // "Show my score to friends" means friends — not everyone in a flock.
    if (id !== uid && (!fd.showScore || !friends.has(id))) return null;
    const score = fd.score || 0;
    return { uid: id, name: S.firstName(card.name), avatar: card.avatar, score, title: levelFor(score).title, me: id === uid };
  }));
  return { board: rows.filter(Boolean).sort((a, b) => b.score - a.score) };
});

/* ---------- Ratings ---------- */
const CATS = { study: ['quiet', 'seating', 'outlets'], food: ['taste', 'value', 'wait'] };
const MIN_RATINGS = 5;

function publicView(sums) {
  const out = {};
  for (const [cat, fields] of Object.entries(CATS)) {
    const s = (sums && sums[cat]) || {};
    const n = s.n || 0;
    if (n < MIN_RATINGS) { out[cat] = { n, ready: false }; continue; }
    const v = { n, ready: true };
    let tot = 0;
    for (const k of fields) { v[k] = Math.round(((s[k] || 0) / n) * 10) / 10; tot += v[k]; }
    v.overall = Math.round((tot / fields.length) * 10) / 10;
    out[cat] = v;
  }
  return out;
}

exports.rateBuilding = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'rate', 30);
  const d = request.data || {};
  const place = placeById(clean(d.placeId, 80));
  if (!place) throw new HttpsError('not-found', "That place can't be rated.");
  const cat = CATS[d.category] ? d.category : null;
  if (!cat) throw new HttpsError('invalid-argument', 'Pick study or food.');
  if (cat === 'food' && place.tier !== 'dining') throw new HttpsError('invalid-argument', 'Food ratings are for dining spots.');
  const scores = {};
  for (const k of CATS[cat]) {
    const v = Math.round(Number(d.scores && d.scores[k]));
    if (!(v >= 1 && v <= 5)) throw new HttpsError('invalid-argument', 'Give every row 1 to 5 stars.');
    scores[k] = v;
  }
  const flightRef = db.doc(`flight/${uid}`);
  const mineRef = db.doc(`ratings/${place.id}_${uid}`);
  const sumsRef = db.doc(`ratingSums/${place.id}`);
  const pubRef = db.doc(`placeRatings/${place.id}`);
  const res = await db.runTransaction(async (tx) => {
    const [fs, ms, ss] = await Promise.all([tx.get(flightRef), tx.get(mineRef), tx.get(sumsRef)]);
    const f = fs.exists ? fs.data() : {};
    if (!(f.stamps || {})[place.id]) throw new HttpsError('failed-precondition', `Check in at ${place.name} first. Only people who've been there can rate it.`);
    const sums = ss.exists ? ss.data() : {};
    const c = { ...(sums[cat] || {}) };
    const prev = ms.exists ? (ms.data()[cat] || null) : null;
    for (const k of CATS[cat]) c[k] = (c[k] || 0) - (prev ? prev[k] : 0) + scores[k];
    if (!prev) c.n = (c.n || 0) + 1;
    const nextSums = { ...sums, [cat]: c };
    tx.set(sumsRef, nextSums);
    tx.set(pubRef, { ...publicView(nextSums), name: place.name, updatedAt: FieldValue.serverTimestamp() });
    tx.set(mineRef, { uid, placeId: place.id, [cat]: scores, at: FieldValue.serverTimestamp() }, { merge: true });
    const firstEver = !ms.exists;
    const { pts, patch } = applyPoints(f, firstEver ? P.rating : 0);
    tx.set(flightRef, { ...patch, rated: { ...(f.rated || {}), [`${place.id}:${cat}`]: scores } }, { merge: true });
    return { pts, n: c.n };
  });
  return { ok: true, points: res.pts, n: res.n, shown: res.n >= MIN_RATINGS, minRatings: MIN_RATINGS };
});

/* Best-rated places for Pilot and the "Best study spots" list. */
exports.getTopRated = onCall(C.callOpts(), async (request) => {
  C.requireAuth(request);
  const cat = CATS[request.data?.category] ? request.data.category : 'study';
  const hit = await C.getCached(`top_${cat}`, 10 * 60000);
  if (hit) return { places: hit };
  const snap = await db.collection('placeRatings').get();
  const places = snap.docs.map((x) => ({ id: x.id, name: x.data().name, ...(x.data()[cat] || {}) }))
    .filter((p) => p.ready).sort((a, b) => b.overall - a.overall || b.n - a.n).slice(0, 8);
  await C.setCached(`top_${cat}`, places);
  return { places };
});

