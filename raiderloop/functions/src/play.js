/**
 * Play: Flight Score, stamps, scavenger hunts, leaderboards, event
 * check-ins, and hide and seek.
 *
 * Points are only ever given by the server (common.award), once per
 * thing, and reset each semester. Leaderboards are friends-only by
 * default; the campus board only shows people who turned it on.
 * Hide and seek never shares anyone's location with other players:
 * seekers only get "hot / warm / cool / cold" hints.
 */
const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const C = require('./common');
const { liveHunts } = require('./lib/hunts');

const { db, FieldValue, HttpsError, clean } = C;
const MIN = 60000;

const meters = (a, b) => {
  const R = 6371000; const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat); const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function myScore(uid) {
  const s = await db.doc(`scores/${uid}`).get();
  const v = s.exists ? s.data() : {};
  const season = C.seasonId();
  if (v.season !== season) return { season, points: 0, stamps: [], public: !!v.public };
  return { season, points: v.points || 0, stamps: v.stamps || [], public: !!v.public };
}

exports.getPlay = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const score = await myScore(uid);
  const ledger = await db.collection(`scores/${uid}/ledger`).where('season', '==', score.season).get();
  const keys = new Set(ledger.docs.map((d) => d.id));
  const hunts = liveHunts().map((h) => ({
    id: h.id, title: h.title, bonus: h.bonus, end: h.end,
    items: h.items.map((i) => ({ id: i.id, label: i.label, done: keys.has(`hunt:${score.season}:${h.id}:${i.id}`) })),
  }));
  const recent = ledger.docs.map((d) => ({ label: d.data().label || '', points: d.data().points || 0, at: d.data().at?.toMillis?.() || 0 }))
    .sort((a, b) => b.at - a.at).slice(0, 12);
  // Rank among friends.
  const friends = await C.friendIds(uid);
  const theirs = await Promise.all(friends.slice(0, 200).map((f) => db.doc(`scores/${f}`).get()));
  const ahead = theirs.filter((s) => s.exists && s.data().season === score.season && (s.data().points || 0) > score.points).length;
  // Keep my leaderboard name/avatar fresh if I'm on the campus board.
  if (score.public) {
    const me = await C.basicCard(uid);
    await db.doc(`scores/${uid}`).set({ name: C.firstAndInitial(me.name), avatar: me.avatar }, { merge: true });
  }
  return { ...score, hunts, recent, friendsRank: ahead + 1, friendsCount: friends.length + 1 };
});

exports.setLeaderboard = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const on = !!request.data?.public;
  const me = await C.basicCard(uid);
  const card = await db.doc(`cards/${uid}`).get();
  const orgs = card.exists ? (card.data().orgs || []).map((o) => o.name).slice(0, 8) : [];
  await db.doc(`scores/${uid}`).set({ public: on, name: C.firstAndInitial(me.name), avatar: me.avatar, orgs, season: (await myScore(uid)).season }, { merge: true });
  return { ok: true, public: on };
});

exports.getLeaderboard = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const scope = ['friends', 'campus', 'orgs'].includes(request.data?.scope) ? request.data.scope : 'friends';
  const season = C.seasonId();
  if (scope === 'friends') {
    const ids = [uid, ...(await C.friendIds(uid))].slice(0, 300);
    const rows = [];
    for (const id of ids) {
      const [s, card] = await Promise.all([db.doc(`scores/${id}`).get(), C.basicCard(id)]);
      const pts = s.exists && s.data().season === season ? s.data().points || 0 : 0;
      rows.push({ uid: id, name: id === uid ? 'You' : (card.name || '').split(' ')[0], avatar: card.avatar, points: pts, me: id === uid });
    }
    return { rows: rows.sort((a, b) => b.points - a.points).slice(0, 50) };
  }
  const q = await db.collection('scores').where('season', '==', season).where('public', '==', true).orderBy('points', 'desc').limit(scope === 'orgs' ? 500 : 25).get();
  if (scope === 'campus') return { rows: q.docs.map((d) => ({ uid: d.id, name: d.id === uid ? 'You' : d.data().name, avatar: d.data().avatar, points: d.data().points || 0, me: d.id === uid })) };
  const byOrg = {};
  q.docs.forEach((d) => (d.data().orgs || []).forEach((o) => { byOrg[o] = byOrg[o] || { name: o, points: 0, people: 0 }; byOrg[o].points += d.data().points || 0; byOrg[o].people += 1; }));
  return { rows: Object.values(byOrg).filter((o) => o.people >= 2).sort((a, b) => b.points - a.points).slice(0, 20) };
});

/* Check in at a Discover event you're actually at (within ~200 m, from
   30 minutes before it starts to 3 hours after). */
exports.checkIn = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const id = clean(request.data?.id, 20);
  const lat = Number(request.data?.lat); const lng = Number(request.data?.lng);
  const s = await db.doc(`publicPosts/${id}`).get();
  if (!s.exists || s.data().kind !== 'event') throw new HttpsError('not-found', 'Event not found.');
  const p = s.data();
  const start = Date.parse(p.when);
  if (!(Date.now() > start - 30 * MIN && Date.now() < start + 3 * 60 * MIN)) throw new HttpsError('failed-precondition', 'Check-in opens 30 minutes before the event starts.');
  if (!p.place || p.place.lat == null) throw new HttpsError('failed-precondition', "This event didn't pin a spot, so check-in isn't available.");
  if (!Number.isFinite(lat) || meters({ lat, lng }, p.place) > 200) throw new HttpsError('failed-precondition', "You don't seem to be at the event yet.");
  const got = await C.award(uid, `checkin:${id}`, 30, { label: `Went to ${p.title}` });
  if (got) {
    const season = C.seasonId();
    const led = await db.collection(`scores/${uid}/ledger`).where('season', '==', season).get();
    const n = led.docs.filter((d) => d.id.startsWith('checkin:')).length;
    if (n >= 5) await C.award(uid, `regular:${season}`, 50, { stamp: 'regular', label: 'Went to 5 events' });
  }
  return { ok: true, points: got ? 30 : 0 };
});

/* ================= Hide and seek ================= */
const BANDS = [[25, 'hot'], [75, 'warm'], [200, 'cool']];
const bandFor = (m) => (BANDS.find(([max]) => m <= max) || [0, 'cold'])[1];

async function gameFor(uid, id) {
  const ref = db.doc(`games/${clean(id, 20)}`);
  const s = await ref.get();
  if (!s.exists || !(s.data().players || []).includes(uid)) throw new HttpsError('not-found', 'Game not found.');
  return { ref, g: s.data() };
}

exports.gameCreate = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'game', 10);
  const d = request.data || {};
  const friends = new Set(await C.friendIds(uid));
  const invited = (d.invite || []).map((x) => clean(x, 64)).filter((x) => friends.has(x)).slice(0, 15);
  if (!invited.length) throw new HttpsError('invalid-argument', 'Invite at least one friend.');
  const lat = Number(d.center?.lat); const lng = Number(d.center?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpsError('invalid-argument', 'Missing the play area.');
  const me = await C.basicCard(uid);
  const id = C.shortId(10);
  await db.doc(`games/${id}`).set({
    host: uid, mode: 'hideseek', status: 'lobby', players: [uid], invited, cards: { [uid]: { name: (me.name || '').split(' ')[0], avatar: me.avatar } },
    roles: {}, found: {}, minutes: Math.min(60, Math.max(10, Number(d.minutes) || 20)), radius: Math.min(1200, Math.max(150, Number(d.radius) || 500)),
    center: { lat, lng }, createdAt: FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 3 * 3600000).toISOString(),
  });
  await C.pushTo(invited, { title: `${me.name.split(' ')[0]} started hide and seek`, body: 'Tap to join the game in Flyer.', data: { route: 'game', id }, category: 'play' });
  return { ok: true, id };
});

exports.gameJoin = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const ref = db.doc(`games/${clean(request.data?.id, 20)}`);
  const me = await C.basicCard(uid);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('not-found', 'That game ended.');
    const g = s.data();
    if (g.players.includes(uid)) return;
    if (!(g.invited || []).includes(uid)) throw new HttpsError('permission-denied', 'Ask the host to invite you.');
    if (g.status !== 'lobby') throw new HttpsError('failed-precondition', 'That game already started.');
    tx.update(ref, { players: FieldValue.arrayUnion(uid), invited: FieldValue.arrayRemove(uid), [`cards.${uid}`]: { name: (me.name || '').split(' ')[0], avatar: me.avatar } });
  });
  return { ok: true };
});

exports.gameStart = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const { ref, g } = await gameFor(uid, request.data?.id);
  if (g.host !== uid) throw new HttpsError('permission-denied', 'Only the host can start.');
  if (g.status !== 'lobby') return { ok: true };
  if (g.players.length < 2) throw new HttpsError('failed-precondition', 'Wait for at least one friend to join.');
  const seekers = (request.data?.seekers || [uid]).filter((x) => g.players.includes(x)).slice(0, Math.max(1, g.players.length - 1));
  const roles = {}; const codes = {};
  g.players.forEach((p) => { roles[p] = seekers.includes(p) ? 'seeker' : 'hider'; if (roles[p] === 'hider') codes[p] = C.shortId(6); });
  const now = Date.now();
  await ref.collection('secret').doc('codes').set(codes);
  await ref.update({ status: 'live', roles, startedAt: now, hideUntil: now + 3 * MIN, endsAt: now + g.minutes * MIN });
  await C.pushTo(g.players.filter((p) => p !== uid), { title: 'Hide and seek started', body: 'Hiders have 3 minutes. Seekers, count to 180!', data: { route: 'game', id: ref.id }, category: 'play' });
  return { ok: true };
});

exports.gameMyCode = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const { ref, g } = await gameFor(uid, request.data?.id);
  if (g.roles?.[uid] !== 'hider') return { code: null };
  const codes = (await ref.collection('secret').doc('codes').get()).data() || {};
  return { code: codes[uid] || null };
});

exports.gamePing = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const { ref, g } = await gameFor(uid, request.data?.id);
  if (g.status !== 'live') return { status: g.status };
  await C.takeQuota(uid, 'gamePing', 900);
  const lat = Number(request.data?.lat); const lng = Number(request.data?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpsError('invalid-argument', 'Bad location.');
  const out = meters({ lat, lng }, g.center) > g.radius;
  await ref.collection('locs').doc(uid).set({ lat, lng, at: Date.now() }, { merge: true });
  return { status: g.status, outOfBounds: out };
});

exports.gameHint = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const { ref, g } = await gameFor(uid, request.data?.id);
  if (g.status !== 'live' || g.roles?.[uid] !== 'seeker') throw new HttpsError('failed-precondition', 'Hints are for seekers during the game.');
  if (Date.now() < g.hideUntil) throw new HttpsError('failed-precondition', 'Hiders are still hiding. Keep counting!');
  const mineRef = ref.collection('locs').doc(uid);
  const mine = (await mineRef.get()).data();
  if (!mine || Date.now() - mine.at > 90000) throw new HttpsError('failed-precondition', 'Keep Flyer open for a few seconds so it knows where you are.');
  if (mine.lastHint && Date.now() - mine.lastHint < 20000) throw new HttpsError('resource-exhausted', 'One hint every 20 seconds.');
  await mineRef.update({ lastHint: Date.now() });
  const hiders = Object.keys(g.roles).filter((p) => g.roles[p] === 'hider' && !g.found?.[p]);
  const locs = await Promise.all(hiders.map((h) => ref.collection('locs').doc(h).get()));
  const dists = locs.filter((l) => l.exists && Date.now() - l.data().at < 5 * MIN).map((l) => meters(mine, l.data()));
  if (!dists.length) return { band: 'cold', left: hiders.length };
  return { band: bandFor(Math.min(...dists)), left: hiders.length };
});

async function finishGame(ref, g) {
  if (g.status === 'ended') return;
  await ref.update({ status: 'ended', endedAt: Date.now() });
  const survivors = Object.keys(g.roles || {}).filter((p) => g.roles[p] === 'hider' && !g.found?.[p]);
  for (const p of g.players) await C.award(p, `game:${ref.id}`, 10, { stamp: 'hide-seek', label: 'Played hide and seek' });
  for (const p of survivors) await C.award(p, `survive:${ref.id}`, 60, { label: 'Never found in hide and seek' });
  await C.pushTo(g.players, { title: 'Hide and seek is over', body: survivors.length ? `${survivors.length} hider${survivors.length === 1 ? '' : 's'} never got found.` : 'Every hider was found.', data: { route: 'game', id: ref.id }, category: 'play' });
  await ref.collection('locs').get().then((q) => { const b = db.batch(); q.docs.forEach((x) => b.delete(x.ref)); return q.size ? b.commit() : null; });
}

exports.gameFound = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const { ref, g } = await gameFor(uid, request.data?.id);
  if (g.status !== 'live' || g.roles?.[uid] !== 'seeker') throw new HttpsError('failed-precondition', 'Only seekers can tag during the game.');
  const code = clean(request.data?.code, 10).toUpperCase();
  const codes = (await ref.collection('secret').doc('codes').get()).data() || {};
  const hider = Object.keys(codes).find((k) => codes[k] === code);
  if (!hider) throw new HttpsError('not-found', "That code isn't from a hider in this game.");
  if (g.found?.[hider]) return { ok: true, already: true };
  await ref.update({ [`found.${hider}`]: { by: uid, at: Date.now() } });
  await C.award(uid, `seek:${ref.id}:${hider}`, 40, { label: 'Found a hider' });
  await C.pushTo([hider], { title: 'You were found!', body: `${(g.cards?.[uid]?.name) || 'A seeker'} tagged you.`, data: { route: 'game', id: ref.id }, category: 'play' });
  const after = (await ref.get()).data();
  const left = Object.keys(after.roles).filter((p) => after.roles[p] === 'hider' && !after.found?.[p]);
  if (!left.length) await finishGame(ref, after);
  return { ok: true, left: left.length, name: g.cards?.[hider]?.name || '' };
});

exports.gameEnd = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const { ref, g } = await gameFor(uid, request.data?.id);
  if (request.data?.leave && g.host !== uid) {
    await ref.update({ players: FieldValue.arrayRemove(uid), [`roles.${uid}`]: FieldValue.delete() });
    return { ok: true };
  }
  if (g.host !== uid) throw new HttpsError('permission-denied', 'Only the host can end the game.');
  if (g.status === 'lobby') { await ref.delete(); return { ok: true }; }
  await finishGame(ref, g);
  return { ok: true };
});

exports.gameClock = onSchedule('every 2 minutes', async () => {
  const live = await db.collection('games').where('status', '==', 'live').where('endsAt', '<', Date.now()).limit(50).get();
  for (const d of live.docs) await finishGame(d.ref, d.data());
  const old = await db.collection('games').where('expiresAt', '<', new Date().toISOString()).limit(100).get();
  for (const d of old.docs) {
    for (const sub of ['locs', 'secret']) { const q = await d.ref.collection(sub).get(); const b = db.batch(); q.docs.forEach((x) => b.delete(x.ref)); if (q.size) await b.commit(); }
    await d.ref.delete();
  }
});
