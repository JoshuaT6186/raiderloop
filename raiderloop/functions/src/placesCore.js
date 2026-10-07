/**
 * Flight-score helpers shared by check-ins (places.js) and meetups
 * (chat.js). Not Cloud Functions themselves.
 */
const C = require('./common');
const PLACES_FILE = require('./shared/places.json');
const RULES = require('./shared/flight.json');
const FOOTBALL = require('./shared/football.json');

const { HttpsError } = C;
const PLACES = [...PLACES_FILE.places, ...(PLACES_FILE.extra || [])];
const placeById = (id) => PLACES.find((p) => p.id === id) || null;
const P = RULES.points;

function levelFor(score) {
  let lvl = RULES.levels[0];
  for (const l of RULES.levels) if (score >= l.min) lvl = l;
  const next = RULES.levels.find((l) => l.min > score) || null;
  return { title: lvl.title, next: next ? { title: next.title, min: next.min } : null };
}

/* Is there a home game at this venue right now? */
function liveGameAt(placeId, now = Date.now()) {
  if (!RULES.gameVenues.includes(placeId)) return null;
  return FOOTBALL.games.find((g) => {
    if (g.homeAway !== 'home' || g.buildingId !== placeId) return false;
    if (/T00:00:00$/.test(g.kickoff)) return false; // time not announced
    const k = C.chicagoMs(g.kickoff);
    return now >= k - RULES.gameWindow.beforeMin * 60000 && now <= k + RULES.gameWindow.afterMin * 60000;
  }) || null;
}

function checkPosition(place, d) {
  const lat = Number(d.lat); const lng = Number(d.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpsError('invalid-argument', 'Location is off — turn it on for Flyer to check in.');
  const acc = Math.min(Math.max(Number(d.accuracy) || 0, 0), RULES.maxAccuracyM);
  const dist = C.distanceM({ lat, lng }, place);
  if (dist == null || dist > RULES.radiusM + acc) {
    throw new HttpsError('failed-precondition', `You need to be at ${place.name} to check in (you're about ${Math.round(dist / 10) * 10} m away).`);
  }
  return dist;
}

/* Applies points inside a transaction with the daily/weekly caps.
   Returns the patch to write and how many points actually landed. */
function applyPoints(f, want, now = Date.now()) {
  const day = C.chicagoDay(now); const week = C.weekKey(now);
  const weekPts = f.week === week ? (f.weekPts || 0) : 0;
  const pts = Math.max(0, Math.min(want, RULES.caps.pointsPerWeek - weekPts));
  return {
    pts,
    patch: {
      score: (f.score || 0) + pts,
      week, weekPts: weekPts + pts,
      day, dayPts: (f.day === day ? (f.dayPts || 0) : 0) + pts,
    },
  };
}

/* Shared by check-ins and meetups. Records a stamp for `place` and
   returns { pts, isNew }. Must run inside a transaction. */
function stampPlace(f, place, { tier, key, routine, now = Date.now() }) {
  const day = C.chicagoDay(now);
  const stamps = { ...(f.stamps || {}) };
  const prev = stamps[place.id];
  const isNew = !prev;
  let want = 0;
  if (tier === 'game' || tier === 'event') {
    const claimed = (f.claimed || {})[key];
    want = claimed ? 0 : P[tier];
  } else if (routine) {
    want = 0;
  } else if (isNew) {
    want = P[tier] || 0;
  } else if (tier === 'rec' && prev.lastDay !== day) {
    want = P.repeatRec;
  }
  stamps[place.id] = {
    name: place.name, tier: prev?.tier === 'game' ? 'game' : tier, first: prev?.first || now, lastDay: day,
    visits: (prev?.visits || 0) + 1, routine: !!routine && !(tier === 'game' || tier === 'event'),
  };
  return { want, stamps, isNew };
}


module.exports = { PLACES, RULES, FOOTBALL, P, placeById, levelFor, liveGameAt, checkPosition, applyPoints, stampPlace };
