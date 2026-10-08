/**
 * Chat (friend DMs + flocks), photo messages, share cards, meetups,
 * push tokens, and the clean-up job.
 * ------------------------------------------------------------
 * Safety rules, enforced here because clients can't write directly:
 *   • DMs only between current friends who haven't blocked each other
 *   • flocks are invite-only, made from your friends, max 15 people
 *   • text is filtered for slurs/profanity; photos are checked by an
 *     AI safety filter before anyone can see them
 *   • every message disappears after 30 days
 *   • report/block on every message (reportContent in social.js)
 *   • meetups only at places on the public campus list
 */
const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const C = require('./common');
const S = require('./socialCore');
const K = require('./chatCore');
const F = require('./placesCore');
const M = require('./meetupCore');

const { db, FieldValue, HttpsError, clean, ANTHROPIC_API_KEY } = C;

async function chatFor(uid, chatId) {
  const snap = await db.doc(`chats/${clean(chatId, 80)}`).get();
  if (!snap.exists || !(snap.data().members || []).includes(uid)) throw new HttpsError('permission-denied', "You're not in that chat.");
  return { ref: snap.ref, data: snap.data(), id: snap.id };
}

/* ---------- Opening a DM ---------- */
exports.openDm = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const other = clean(request.data?.uid, 64);
  if (!other || other === uid) throw new HttpsError('invalid-argument', 'Pick a friend.');
  return { chatId: await K.ensureDm(uid, other) };
});

/* ---------- Cards ---------- */
const s = (v, n) => K.censorText(clean(v, n));
function cleanCard(card) {
  const c = card || {};
  switch (c.type) {
    case 'class': return {
      type: 'class', title: s(c.title, 40), days: (Array.isArray(c.days) ? c.days : []).map((d) => clean(d, 2)).slice(0, 7),
      time: clean(c.time, 10), endTime: clean(c.endTime, 10), place: s(c.place, 80), buildingId: clean(c.buildingId, 80) || null,
    };
    case 'place': return { type: 'place', placeId: clean(c.placeId, 80), name: s(c.name, 80) };
    case 'event': return {
      type: 'event', title: s(c.title, 100), date: clean(c.date, 30), time: clean(c.time, 12), location: s(c.location, 100),
      sourceUrl: /^https:\/\//.test(String(c.sourceUrl || '')) ? clean(c.sourceUrl, 300) : null,
    };
    case 'note': return { type: 'note', title: s(c.title, 60), body: s(c.body, 600) };
    default: throw new HttpsError('invalid-argument', "That card can't be shared.");
  }
}

/* ---------- Photo safety check ---------- */
async function photoIsSafe(buf, mediaType) {
  const text = await C.claudeText({
    model: C.FAST_MODEL,
    system: `You are a strict safety filter for photos sent between college students in a campus app. Reply with ONLY a JSON object {"allowed": boolean, "reason": string}.
Not allowed: nudity or sexual content; graphic violence, gore or injury; self-harm; weapons being brandished at people; drug use; hate symbols; photos of ID cards, credit cards, or documents showing private numbers.
Allowed: notes, whiteboards, textbooks, screenshots of schedules, food, places, buildings, people fully clothed, pets, memes without the above.`,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: buf.toString('base64') } },
      { type: 'text', text: 'Is this photo allowed?' },
    ] }],
    maxTokens: 120,
  });
  const v = C.parseJsonObject(text);
  return !!(v && v.allowed === true);
}

/* ---------- Sending ---------- */
exports.sendMessage = onCall({ ...C.callOpts([ANTHROPIC_API_KEY]), memory: '512MiB' }, async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const chat = await chatFor(uid, d.chatId);
  if (chat.data.type === 'dm') {
    const other = chat.data.members.find((m) => m !== uid);
    if (!(await S.areFriends(uid, other)) || (await S.isBlocked(uid, other))) throw new HttpsError('permission-denied', 'You can only message friends.');
  }
  await C.takeQuota(uid, 'msg', 500, "You've sent a lot of messages today. The limit resets at midnight.");
  const msg = { from: uid };
  if (d.imagePath) {
    await C.takeQuota(uid, 'photo', 20, "That's 20 photos today. The limit resets at midnight.");
    const path = String(d.imagePath);
    if (!path.startsWith(`chatImages/${chat.id}/${uid}/`) || path.includes('..')) throw new HttpsError('invalid-argument', 'Bad photo.');
    const file = K.bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError('not-found', "The photo didn't finish uploading. Try again.");
    const [meta] = await file.getMetadata();
    if (Number(meta.size) > 4.5 * 1024 * 1024) { await file.delete().catch(() => {}); throw new HttpsError('invalid-argument', 'That photo is too big.'); }
    const [buf] = await file.download();
    const type = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(meta.contentType) ? meta.contentType : 'image/jpeg';
    let safe = false;
    try { safe = await photoIsSafe(buf, type); } catch (e) {
      await file.delete().catch(() => {});
      throw new HttpsError('unavailable', "Photos can't be checked right now, so they can't be sent. Try again later.");
    }
    if (!safe) { await file.delete().catch(() => {}); throw new HttpsError('failed-precondition', "That photo can't be sent on Flyer."); }
    msg.kind = 'image';
    msg.image = { path, w: Number(d.w) || null, h: Number(d.h) || null };
    msg.text = d.text ? s(d.text, 300) : null;
  } else if (d.card) {
    msg.kind = 'card';
    msg.card = cleanCard(d.card);
  } else {
    const text = s(d.text, 1000);
    if (!text) throw new HttpsError('invalid-argument', 'Type a message first.');
    msg.text = text;
  }
  const id = await K.postMessage(chat.id, msg);
  return { ok: true, id };
});

/* ---------- Flocks ---------- */
async function friendsOnly(uid, uids) {
  const friends = await S.friendIds(uid);
  const out = [];
  for (const u of [...new Set(uids.map((x) => clean(x, 64)))]) {
    if (u === uid || !friends.has(u)) continue;
    if (await S.isBlocked(uid, u)) continue;
    out.push(u);
  }
  return out;
}

exports.createFlock = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'flockCreate', 5, "That's 5 new flocks today. Try again tomorrow.");
  const name = s(request.data?.name, 40);
  if (name.length < 2) throw new HttpsError('invalid-argument', 'Give your flock a name.');
  const members = await friendsOnly(uid, Array.isArray(request.data?.members) ? request.data.members : []);
  if (!members.length) throw new HttpsError('invalid-argument', 'Add at least one friend.');
  if (members.length + 1 > K.FLOCK_MAX) throw new HttpsError('invalid-argument', `A flock holds up to ${K.FLOCK_MAX} people.`);
  const all = [uid, ...members];
  const cards = {};
  for (const u of all) { const c = await S.publicCard(u); cards[u] = { name: c.name, avatar: c.avatar }; }
  const ref = await db.collection('chats').add({
    type: 'flock', name, members: all, admins: [uid], memberCards: cards, createdBy: uid,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedMs: Date.now(), last: null,
  });
  await K.postMessage(ref.id, { kind: 'system', text: `${S.firstName(cards[uid].name) || 'Someone'} started ${name}` }, { push: false });
  await C.sendPush(members, { title: name, body: `${S.firstName(cards[uid].name) || 'A friend'} added you to a flock.`, data: { open: 'chat', chatId: ref.id } });
  return { chatId: ref.id };
});

async function flockAdmin(uid, chatId) {
  const chat = await chatFor(uid, chatId);
  if (chat.data.type !== 'flock') throw new HttpsError('invalid-argument', "That's not a flock.");
  if (!(chat.data.admins || []).includes(uid)) throw new HttpsError('permission-denied', 'Only the flock admin can do that.');
  return chat;
}

exports.addFlockMembers = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const chat = await flockAdmin(uid, request.data?.chatId);
  const add = (await friendsOnly(uid, request.data?.members || [])).filter((u) => !chat.data.members.includes(u));
  if (!add.length) return { ok: true };
  if (chat.data.members.length + add.length > K.FLOCK_MAX) throw new HttpsError('invalid-argument', `A flock holds up to ${K.FLOCK_MAX} people.`);
  const cards = {};
  for (const u of add) { const c = await S.publicCard(u); cards[u] = { name: c.name, avatar: c.avatar }; }
  await chat.ref.set({ members: FieldValue.arrayUnion(...add), memberCards: cards }, { merge: true });
  await K.postMessage(chat.id, { kind: 'system', text: `${add.map((u) => S.firstName(cards[u].name)).join(', ')} joined` }, { push: false });
  await C.sendPush(add, { title: chat.data.name, body: 'You were added to a flock.', data: { open: 'chat', chatId: chat.id } });
  return { ok: true };
});

exports.removeFlockMember = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const chat = await flockAdmin(uid, request.data?.chatId);
  const who = clean(request.data?.uid, 64);
  if (!who || who === uid) throw new HttpsError('invalid-argument', 'Use Leave to leave your own flock.');
  await chat.ref.update({ members: FieldValue.arrayRemove(who), admins: FieldValue.arrayRemove(who) });
  return { ok: true };
});

async function leave(uid, chat) {
  const members = chat.data.members.filter((m) => m !== uid);
  if (!members.length) { await K.deleteChatDeep(chat.id); return; }
  let admins = (chat.data.admins || []).filter((a) => a !== uid);
  if (!admins.length) admins = [members[0]];
  await chat.ref.update({ members, admins });
  const me = S.firstName((chat.data.memberCards || {})[uid]?.name) || 'Someone';
  await K.postMessage(chat.id, { kind: 'system', text: `${me} left` }, { push: false });
}

exports.leaveFlock = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const chat = await chatFor(uid, request.data?.chatId);
  if (chat.data.type !== 'flock') throw new HttpsError('invalid-argument', "That's not a flock.");
  await leave(uid, chat);
  return { ok: true };
});

exports.renameFlock = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const chat = await flockAdmin(uid, request.data?.chatId);
  const name = s(request.data?.name, 40);
  if (name.length < 2) throw new HttpsError('invalid-argument', 'Give your flock a name.');
  await chat.ref.update({ name });
  return { ok: true };
});

exports.deleteFlock = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const chat = await flockAdmin(uid, request.data?.chatId);
  await K.deleteChatDeep(chat.id);
  return { ok: true };
});

/* ---------- Push tokens & muting ---------- */
exports.savePushToken = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const token = clean(request.data?.token, 200);
  if (!/^Expo(nent)?PushToken\[.+\]$/.test(token)) throw new HttpsError('invalid-argument', 'Bad token.');
  await db.doc(`pushTokens/${uid}`).set({ tokens: FieldValue.arrayUnion(token), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

exports.removePushToken = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const token = clean(request.data?.token, 200);
  if (token) await db.doc(`pushTokens/${uid}`).update({ tokens: FieldValue.arrayRemove(token) }).catch(() => {});
  return { ok: true };
});

exports.setChatMute = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const chat = await chatFor(uid, request.data?.chatId);
  await db.doc(`pushTokens/${uid}`).set({ muted: { [chat.id]: !!request.data?.muted } }, { merge: true });
  return { ok: true };
});

/* ---------- Meetups ---------- */

function parseAt(v) {
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) throw new HttpsError('invalid-argument', 'Pick a time.');
  if (ms < Date.now() - 5 * 60000) throw new HttpsError('invalid-argument', "That time already passed.");
  if (ms > Date.now() + 21 * 86400000) throw new HttpsError('invalid-argument', 'Pick a time in the next 3 weeks.');
  return ms;
}

exports.createMeetup = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'meetup', 12, "That's a lot of meetup cards today. Try again tomorrow.");
  const d = request.data || {};
  const place = F.placeById(clean(d.placeId, 80));
  if (!place) throw new HttpsError('invalid-argument', 'Pick a place from the campus list. Meetups are always somewhere public.');
  const atMs = parseAt(d.at);
  let invited; let chatId = null; let flockId = null;
  if (d.flockId) {
    const chat = await chatFor(uid, d.flockId);
    if (chat.data.type !== 'flock') throw new HttpsError('invalid-argument', "That's not a flock.");
    invited = chat.data.members.filter((m) => m !== uid);
    chatId = chat.id; flockId = chat.id;
  } else {
    invited = await friendsOnly(uid, Array.isArray(d.to) ? d.to.slice(0, 10) : []);
    if (!invited.length) throw new HttpsError('invalid-argument', 'Pick at least one friend.');
    if (invited.length === 1) chatId = await K.ensureDm(uid, invited[0]);
  }
  const me = await S.publicCard(uid);
  const status = { [uid]: 'going' };
  invited.forEach((u) => { status[u] = 'invited'; });
  const ref = await db.collection('meetups').add({
    from: uid, fromName: S.firstName(me.name), members: [uid, ...invited], placeId: place.id, placeName: place.name,
    atMs, note: s(d.note, 140) || null, status, checkedIn: {}, awarded: {}, chatId, flockId, createdAt: FieldValue.serverTimestamp(),
  });
  if (chatId) await K.postMessage(chatId, { from: uid, kind: 'card', card: { type: 'meetup', meetupId: ref.id, placeId: place.id, placeName: place.name, atMs, note: s(d.note, 140) || null } }, { push: false });
  const when = new Date(atMs).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit' });
  await C.sendPush(invited, { title: 'Meetup invite', body: `${S.firstName(me.name) || 'A friend'}: ${place.name}, ${when}`, data: { open: 'meetup', meetupId: ref.id } });
  return { meetupId: ref.id };
});

async function meetupFor(uid, id) {
  const snap = await db.doc(`meetups/${clean(id, 80)}`).get();
  if (!snap.exists || !(snap.data().members || []).includes(uid)) throw new HttpsError('not-found', 'That meetup is gone.');
  return snap;
}

exports.respondMeetup = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const snap = await meetupFor(uid, d.id);
  const m = snap.data();
  const me = S.firstName((await S.publicCard(uid)).name) || 'A friend';
  if (d.answer === 'reschedule') {
    const atMs = parseAt(d.at);
    const status = {};
    m.members.forEach((u) => { status[u] = u === uid ? 'going' : 'invited'; });
    await snap.ref.update({ atMs, status, checkedIn: {}, rescheduledBy: uid });
    const when = new Date(atMs).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit' });
    await C.sendPush(m.members.filter((u) => u !== uid), { title: 'New meetup time', body: `${me} suggested ${when} at ${m.placeName}`, data: { open: 'meetup', meetupId: snap.id } });
    return { ok: true };
  }
  const answer = d.answer === 'going' ? 'going' : 'declined';
  await snap.ref.update({ [`status.${uid}`]: answer });
  // Declining is silent. Saying yes lets the organizer know.
  if (answer === 'going' && m.from !== uid) await C.sendPush([m.from], { title: 'Meetup', body: `${me} is in for ${m.placeName}`, data: { open: 'meetup', meetupId: snap.id } });
  return { ok: true };
});

exports.cancelMeetup = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const snap = await meetupFor(uid, request.data?.id);
  const m = snap.data();
  if (m.from !== uid) {
    await snap.ref.update({ [`status.${uid}`]: 'declined' });
    return { ok: true };
  }
  await snap.ref.delete();
  await C.sendPush(m.members.filter((u) => u !== uid && m.status[u] !== 'declined'), { title: 'Meetup canceled', body: `${m.placeName} is off.`, data: { open: 'home' } });
  return { ok: true };
});

/* Older app builds call this when someone taps "I'm here"; newer ones
   check in automatically through autoCheckIn (places.js). The server
   checks each person's position once. When two or more have checked
   in, everyone who checked in gets the bonus. */
exports.meetupCheckIn = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const pre = await meetupFor(uid, d.id);
  const place = F.placeById(pre.data().placeId);
  if (!place) throw new HttpsError('not-found', 'That place is no longer on the list.');
  F.checkPosition(place, d);
  const r = await M.arriveAtMeetup(uid, pre.id, place, Date.now());
  return { ok: true, ...r };
});

/* ---------- Clean-up: expired messages, photos, old meetups ---------- */
exports.cleanupChats = onSchedule('every 6 hours', async () => {
  const now = new Date();
  await S.deleteQuery(db.collectionGroup('messages').where('expiresAt', '<=', now), async (d) => {
    const img = d.data().image;
    if (img && img.path) await K.bucket().file(img.path).delete().catch(() => {});
  });
  await S.deleteQuery(db.collection('meetups').where('atMs', '<', Date.now() - 2 * 86400000));
});
