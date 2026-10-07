/**
 * Chat helpers shared by chat.js (messages, flocks, meetups) and
 * account.js (deletion/export). Not Cloud Functions themselves.
 */
const { getStorage } = require('firebase-admin/storage');
const C = require('./common');
const S = require('./socialCore');

const { db, FieldValue, HttpsError } = C;
const MESSAGE_TTL_DAYS = 30;
const FLOCK_MAX = 15;

/* Profanity/slur filter (the `obscenity` package, English set).
   Matches are masked with asterisks rather than blocking the whole
   message. If the package is missing, text passes through and the
   report button is the backstop. */
let censorText = (s) => s;
try {
  // eslint-disable-next-line global-require
  const O = require('obscenity');
  const matcher = new O.RegExpMatcher({ ...O.englishDataset.build(), ...O.englishRecommendedTransformers });
  const censor = new O.TextCensor().setStrategy(O.asteriskCensorStrategy());
  censorText = (s) => {
    const str = String(s || '');
    const m = matcher.getAllMatches(str);
    return m.length ? censor.applyTo(str, m) : str;
  };
} catch (e) { console.warn('obscenity not installed — text filter off'); }

const bucket = () => getStorage().bucket();
const dmId = (a, b) => `dm_${[a, b].sort().join('_')}`;

async function ensureDm(a, b) {
  if (!(await S.areFriends(a, b))) throw new HttpsError('permission-denied', 'You can only message friends.');
  if (await S.isBlocked(a, b)) throw new HttpsError('permission-denied', 'You can only message friends.');
  const id = dmId(a, b);
  const ref = db.doc(`chats/${id}`);
  const snap = await ref.get();
  if (!snap.exists) {
    const [ca, cb] = await Promise.all([S.publicCard(a), S.publicCard(b)]);
    await ref.set({
      type: 'dm', members: [a, b].sort(), admins: [], name: '',
      memberCards: { [a]: { name: ca.name, avatar: ca.avatar }, [b]: { name: cb.name, avatar: cb.avatar } },
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedMs: Date.now(), last: null,
    });
  }
  return id;
}

function preview(msg) {
  if (msg.kind === 'image') return 'Sent a photo';
  if (msg.kind === 'card') {
    const c = msg.card || {};
    return { meetup: `Meetup: ${c.placeName || ''}`, class: `Class: ${c.title || ''}`, place: `Place: ${c.name || ''}`, event: `Event: ${c.title || ''}`, note: `Note: ${c.title || ''}` }[c.type] || 'Shared a card';
  }
  return String(msg.text || '').slice(0, 120);
}

/* Writes a message, bumps the chat, and pushes to everyone else in
   it (skipping anyone who muted the chat or blocked the sender). */
async function postMessage(chatId, msg, { push = true } = {}) {
  const chatRef = db.doc(`chats/${chatId}`);
  const snap = await chatRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That chat was deleted.');
  const chat = snap.data();
  const now = Date.now();
  const doc = {
    kind: 'text', text: null, card: null, image: null, hidden: false, ...msg,
    at: FieldValue.serverTimestamp(), atMs: now, expiresAt: new Date(now + MESSAGE_TTL_DAYS * 86400000),
  };
  const ref = await chatRef.collection('messages').add(doc);
  await chatRef.update({ updatedAt: FieldValue.serverTimestamp(), updatedMs: now, last: { text: preview(doc), from: msg.from || null, atMs: now } });
  if (push && msg.from) {
    const others = (chat.members || []).filter((u) => u !== msg.from);
    const blockedBy = await Promise.all(others.map((u) => db.doc(`users/${u}/blocked/${msg.from}`).get()));
    const to = others.filter((u, i) => !blockedBy[i].exists);
    const sender = S.firstName((chat.memberCards || {})[msg.from]?.name) || 'Someone';
    await C.sendPush(to, {
      title: chat.type === 'flock' ? `${chat.name}` : sender,
      body: chat.type === 'flock' ? `${sender}: ${preview(doc)}` : preview(doc),
      data: { open: 'chat', chatId }, chatId,
    });
  }
  return ref.id;
}

async function deleteChatDeep(chatId) {
  await S.deleteQuery(db.collection(`chats/${chatId}/messages`));
  await bucket().deleteFiles({ prefix: `chatImages/${chatId}/` }).catch(() => {});
  await db.doc(`chats/${chatId}`).delete().catch(() => {});
}

module.exports = { censorText, bucket, dmId, ensureDm, postMessage, deleteChatDeep, preview, MESSAGE_TTL_DAYS, FLOCK_MAX };
