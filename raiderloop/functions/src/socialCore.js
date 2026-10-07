/**
 * Shared social helpers (not Cloud Functions themselves), used by the
 * friends, chat, meetup, schedule and account modules so every rule
 * about who-can-see-whom lives in one place.
 */
const C = require('./common');

const { db, FieldValue } = C;

/* A school email that has been verified through Firebase Auth. Used
   to keep class rosters to real students. */
const SCHOOL_DOMAINS = { ttu: ['ttu.edu'] };
function verifiedSchoolEmail(request, schoolId = 'ttu') {
  const tok = (request.auth && request.auth.token) || {};
  const email = String(tok.email || '').toLowerCase();
  if (!tok.email_verified || !email) return null;
  const ok = (SCHOOL_DOMAINS[schoolId] || []).some((d) => email.endsWith(`@${d}`));
  return ok ? email : null;
}

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

async function publicCard(uid) {
  const s = await db.collection('users').doc(uid).get();
  const d = s.exists ? s.data() : {};
  return { name: d.name || '', handle: d.handle || '', avatar: d.avatar || {} };
}

async function isBlocked(a, b) {
  const [x, y] = await Promise.all([
    db.doc(`users/${a}/blocked/${b}`).get(), db.doc(`users/${b}/blocked/${a}`).get(),
  ]);
  return x.exists || y.exists;
}

async function areFriends(a, b) {
  return (await db.doc(`users/${a}/friends/${b}`).get()).exists;
}

async function friendIds(uid) {
  const s = await db.collection(`users/${uid}/friends`).get();
  return new Set(s.docs.map((d) => d.id));
}

async function makeFriends(a, b) {
  const [ca, cb] = await Promise.all([publicCard(a), publicCard(b)]);
  const batch = db.batch();
  batch.set(db.doc(`users/${a}/friends/${b}`), { ...cb, since: FieldValue.serverTimestamp() });
  batch.set(db.doc(`users/${b}/friends/${a}`), { ...ca, since: FieldValue.serverTimestamp() });
  batch.delete(db.doc(`users/${a}/requests/${b}`));
  batch.delete(db.doc(`users/${b}/requests/${a}`));
  await batch.commit();
}

/* Unfriending (or blocking) quietly removes every kind of access the
   two people had to each other: live location, schedule, nearby
   alerts. Chats between them stop accepting messages because sending
   a DM checks friendship. */
async function unfriend(a, b) {
  const batch = db.batch();
  batch.delete(db.doc(`users/${a}/friends/${b}`));
  batch.delete(db.doc(`users/${b}/friends/${a}`));
  await batch.commit();
  const pull = (path, field, who) => db.doc(path).update({ [field]: FieldValue.arrayRemove(who) }).catch(() => {});
  await Promise.all([
    pull(`locations/${a}`, 'allowed', b), pull(`locations/${b}`, 'allowed', a),
    pull(`schedules/${a}`, 'readers', b), pull(`schedules/${b}`, 'readers', a),
    pull(`schedulesFull/${a}`, 'readers', b), pull(`schedulesFull/${b}`, 'readers', a),
    pull(`nearby/${a}`, 'allow', b), pull(`nearby/${b}`, 'allow', a),
  ]);
}

async function deleteQuery(q, onDoc) {
  // Deletes everything a query matches, in pages of 300.
  for (;;) {
    const snap = await q.limit(300).get();
    if (snap.empty) return;
    const batch = db.batch();
    for (const d of snap.docs) { if (onDoc) await onDoc(d); batch.delete(d.ref); }
    await batch.commit();
    if (snap.size < 300) return;
  }
}

module.exports = {
  verifiedSchoolEmail, firstName, publicCard, isBlocked, areFriends, friendIds, makeFriends, unfriend, deleteQuery,
};
