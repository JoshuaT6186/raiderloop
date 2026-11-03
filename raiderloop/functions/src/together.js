/**
 * Doing things together:
 *   • Group Spaces (projects: deadlines, clipped files, who's doing
 *     what, find a time)
 *   • plans and polls ("Thursday at 4, 6 or 7?") and "Free tonight?"
 *   • office hours queues
 *   • Present Mode (phone → TV or class PC)
 *   • Safe Walk (friends watch your walk until you arrive)
 */
const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const C = require('./common');

const { db, FieldValue, HttpsError, clean } = C;
const AI = [C.ANTHROPIC_API_KEY];
const MIN = 60000;

async function textOk(text) {
  if (!text) return;
  const m = await C.moderate({ text });
  if (!m.allowed && !m.held) throw new HttpsError('invalid-argument', m.reason || "That wording can't be used. Try something else.");
}

/* ================= Group Spaces ================= */
const MAX_MEMBERS = 12;
const cardOf = (c) => ({ name: c.name, avatar: c.avatar });

exports.groupCreate = onCall(C.callOpts(AI), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'groupCreate', 10);
  const d = request.data || {};
  const name = clean(d.name, 60);
  if (name.length < 2) throw new HttpsError('invalid-argument', 'Name your group.');
  await textOk(name);
  const friends = new Set(await C.friendIds(uid));
  const invited = [...new Set((d.invite || []).map((x) => clean(x, 64)))].filter((x) => friends.has(x)).slice(0, MAX_MEMBERS - 1);
  const me = await C.basicCard(uid);
  const id = C.shortId(10);
  const code = C.shortId(6);
  const endsAt = Date.parse(d.endsAt) ? new Date(d.endsAt).toISOString() : null;
  await db.doc(`groups/${id}`).set({
    name, course: clean(d.course, 16).toUpperCase(), owner: uid, members: [uid], invited, code,
    memberCards: { [uid]: cardOf(me) }, deadlines: [], files: [], tasks: [], busy: {}, endsAt,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  if (invited.length) await C.pushTo(invited, { title: `${me.name.split(' ')[0]} added you to a group`, body: `${name}. Open Flyer to join.`, data: { route: 'group', id }, category: 'groups' });
  return { ok: true, id, code, url: `${C.shareBase()}/g/${code}` };
});

exports.groupJoin = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  let ref;
  if (d.id) ref = db.doc(`groups/${clean(d.id, 20)}`);
  else {
    const q = await db.collection('groups').where('code', '==', clean(d.code, 10).toUpperCase()).limit(1).get();
    if (q.empty) throw new HttpsError('not-found', 'That group code is wrong or the group was deleted.');
    ref = q.docs[0].ref;
  }
  const me = await C.basicCard(uid);
  let out = null;
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('not-found', 'That group was deleted.');
    const g = s.data();
    if (g.members.includes(uid)) { out = { id: s.id, name: g.name }; return; }
    if (!d.code && !(g.invited || []).includes(uid)) throw new HttpsError('permission-denied', 'Ask a member for the group code.');
    if (g.members.length >= MAX_MEMBERS) throw new HttpsError('resource-exhausted', 'This group is full.');
    for (const m of g.members) if (await C.isBlocked(uid, m)) throw new HttpsError('permission-denied', "You can't join this group.");
    tx.update(ref, {
      members: FieldValue.arrayUnion(uid), invited: FieldValue.arrayRemove(uid), [`memberCards.${uid}`]: cardOf(me), updatedAt: FieldValue.serverTimestamp(),
    });
    out = { id: s.id, name: g.name, others: g.members };
  });
  if (out.others) await C.pushTo(out.others, { title: `${me.name.split(' ')[0]} joined ${out.name}`, body: 'Your group just got a new member.', data: { route: 'group', id: out.id }, category: 'groups' });
  return { ok: true, id: out.id };
});

exports.groupLeave = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const ref = db.doc(`groups/${clean(request.data?.id, 20)}`);
  const s = await ref.get();
  if (!s.exists) return { ok: true };
  const g = s.data();
  if (request.data?.decline) { await ref.update({ invited: FieldValue.arrayRemove(uid) }); return { ok: true }; }
  const members = g.members.filter((m) => m !== uid);
  if (!members.length) {
    for (const f of g.files || []) if (f.stored) await C.deleteFileByUrl(f.url);
    await C.deletePrefix(`groups/${s.id}/`);
    await ref.delete();
    return { ok: true };
  }
  const cards = { ...g.memberCards }; delete cards[uid];
  const busy = { ...g.busy }; delete busy[uid];
  await ref.update({ members, memberCards: cards, busy, owner: g.owner === uid ? members[0] : g.owner, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

const DAYS = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];
const hhmm = (s) => (/^\d{2}:\d{2}$/.test(s) ? s : null);

exports.groupAction = onCall({ ...C.callOpts(AI), memory: '512MiB' }, async (request) => {
  const uid = C.requireAuth(request, { account: true });
  const d = request.data || {};
  const ref = db.doc(`groups/${clean(d.id, 20)}`);
  const op = clean(d.op, 20);
  await C.takeQuota(uid, 'groupOp', 300);
  const pre = await ref.get();
  if (!pre.exists || !pre.data().members.includes(uid)) throw new HttpsError('permission-denied', "You're not in this group.");

  // Work that can't happen inside a transaction (moderation, uploads).
  let fileEntry = null;
  if (op === 'addFile') {
    const title = clean(d.title, 100);
    if (d.uploadPath) {
      const up = await C.readUpload(uid, d.uploadPath, { maxBytes: 20 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] });
      if (up.contentType.startsWith('image/')) {
        const m = await C.moderate({ image: up.buf, mediaType: up.contentType, text: title });
        if (!m.allowed) { await up.file.delete().catch(() => {}); throw new HttpsError('invalid-argument', m.held ? 'Try again in a few minutes.' : (m.reason || "That can't be added.")); }
      } else await textOk(title);
      const fid = C.shortId(8);
      const url = await C.publishFile(up.file, `groups/${pre.id}/${fid}.${up.contentType === 'application/pdf' ? 'pdf' : 'jpg'}`, up.contentType);
      fileEntry = { id: fid, title: title || (up.contentType === 'application/pdf' ? 'PDF' : 'Photo'), url, kind: up.contentType === 'application/pdf' ? 'pdf' : 'photo', stored: true, by: uid, at: Date.now() };
    } else {
      const url = C.cleanUrl(d.url);
      if (!url) throw new HttpsError('invalid-argument', 'Paste a link that starts with https://');
      await textOk(title);
      fileEntry = { id: C.shortId(8), title: title || url.replace(/^https:\/\//, '').slice(0, 60), url, kind: clean(d.kind, 20) || 'link', stored: false, by: uid, at: Date.now() };
    }
  }
  if (op === 'rename') await textOk(clean(d.name, 60));
  if (op === 'invite') {
    const g = pre.data();
    const friends = new Set(await C.friendIds(uid));
    const add = [...new Set((d.uids || []).map((x) => clean(x, 64)))].filter((x) => friends.has(x) && !g.members.includes(x));
    if (!add.length) return { ok: true, invited: 0 };
    if (g.members.length + (g.invited || []).length + add.length > MAX_MEMBERS + 6) throw new HttpsError('resource-exhausted', 'Groups can have up to 12 people.');
    await ref.update({ invited: FieldValue.arrayUnion(...add), updatedAt: FieldValue.serverTimestamp() });
    const me = await C.basicCard(uid);
    await C.pushTo(add, { title: `${me.name.split(' ')[0]} added you to a group`, body: `${g.name}. Open Flyer to join.`, data: { route: 'group', id: ref.id }, category: 'groups' });
    return { ok: true, invited: add.length };
  }

  let push = null; let award = null;
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const g = s.data();
    const patch = { updatedAt: FieldValue.serverTimestamp() };
    const findIdx = (arr) => arr.findIndex((x) => x.id === d.itemId);
    if (op === 'addDeadline') {
      const title = clean(d.title, 100); const due = Date.parse(d.due);
      if (!title || !due) throw new HttpsError('invalid-argument', 'Add a title and a date.');
      patch.deadlines = [...(g.deadlines || []), { id: C.shortId(8), title, due: new Date(due).toISOString(), done: false, by: uid }].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 40);
      push = { title: `${g.name}: new deadline`, body: `${title}, ${new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` };
    } else if (op === 'toggleDeadline' || op === 'removeDeadline') {
      const list = [...(g.deadlines || [])]; const i = findIdx(list);
      if (i < 0) return;
      if (op === 'removeDeadline') list.splice(i, 1); else list[i] = { ...list[i], done: !list[i].done };
      patch.deadlines = list;
    } else if (op === 'addFile') {
      patch.files = [...(g.files || []), fileEntry].slice(-60);
      push = { title: `${g.name}: new file`, body: fileEntry.title };
    } else if (op === 'removeFile') {
      const list = [...(g.files || [])]; const i = findIdx(list);
      if (i < 0) return;
      if (list[i].by !== uid && g.owner !== uid) throw new HttpsError('permission-denied', 'Only the person who added it (or the group owner) can remove it.');
      if (list[i].stored) C.deleteFileByUrl(list[i].url);
      list.splice(i, 1); patch.files = list;
    } else if (op === 'addTask') {
      const title = clean(d.title, 100);
      if (!title) throw new HttpsError('invalid-argument', 'Describe the task.');
      patch.tasks = [...(g.tasks || []), { id: C.shortId(8), title, who: d.mine ? uid : null, done: false }].slice(0, 60);
    } else if (op === 'claimTask' || op === 'toggleTask' || op === 'removeTask') {
      const list = [...(g.tasks || [])]; const i = findIdx(list);
      if (i < 0) return;
      if (op === 'removeTask') list.splice(i, 1);
      else if (op === 'claimTask') list[i] = { ...list[i], who: list[i].who === uid ? null : uid };
      else { list[i] = { ...list[i], done: !list[i].done }; if (list[i].done && list[i].who) award = { who: list[i].who, key: `task:${s.id}:${list[i].id}` }; }
      patch.tasks = list;
    } else if (op === 'setBusy') {
      const blocks = (Array.isArray(d.blocks) ? d.blocks : []).slice(0, 60)
        .map((b) => ({ day: DAYS.includes(b.day) ? b.day : null, start: hhmm(b.start), end: hhmm(b.end) }))
        .filter((b) => b.day && b.start && b.end && b.start < b.end);
      patch[`busy.${uid}`] = d.clear ? FieldValue.delete() : blocks;
    } else if (op === 'rename') {
      patch.name = clean(d.name, 60);
    } else if (op === 'setEnd') {
      patch.endsAt = Date.parse(d.endsAt) ? new Date(d.endsAt).toISOString() : null;
    } else throw new HttpsError('invalid-argument', 'Unknown action.');
    tx.update(ref, patch);
  });
  if (award) await C.award(award.who, award.key, 10, { label: 'Finished a group task' });
  if (push) {
    const g = (await ref.get()).data();
    const to = push.to || g.members.filter((m) => m !== uid);
    await C.pushTo(to, { title: push.title, body: push.body, data: { route: 'group', id: ref.id }, category: 'groups' });
  }
  return { ok: true };
});

/* ================= Plans + polls ================= */
exports.planCreate = onCall(C.callOpts(AI), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'plan', 20, "That's a lot of plans today. Try again tomorrow.");
  const d = request.data || {};
  const kind = d.kind === 'free' ? 'free' : 'poll';
  const title = clean(d.title, 120) || (kind === 'free' ? "I'm free tonight. Want to hang?" : '');
  if (!title) throw new HttpsError('invalid-argument', 'Ask a question first.');
  const labels = kind === 'free' ? ["I'm in", "Can't tonight"] : (d.options || []).map((o) => clean(o, 60)).filter(Boolean).slice(0, 6);
  if (labels.length < 2) throw new HttpsError('invalid-argument', 'Add at least two options.');
  await textOk([title, ...labels].join('\n'));
  const friends = new Set(await C.friendIds(uid));
  let audience = (d.to || []).map((x) => clean(x, 64)).filter((x) => friends.has(x));
  let groupId = null;
  if (d.groupId) {
    const g = await db.doc(`groups/${clean(d.groupId, 20)}`).get();
    if (g.exists && g.data().members.includes(uid)) { groupId = g.id; audience = [...new Set([...audience, ...g.data().members.filter((m) => m !== uid)])]; }
  }
  const me = await C.basicCard(uid);
  const id = C.shortId(10);
  const options = labels.map((label, i) => ({ id: `o${i}`, label }));
  const hours = kind === 'free' ? 12 : Math.min(14 * 24, Math.max(1, Number(d.hours) || 72));
  await db.doc(`plans/${id}`).set({
    owner: uid, ownerName: (me.name || '').split(' ')[0], ownerAvatar: me.avatar, kind, title, options,
    votes: Object.fromEntries(options.map((o) => [o.id, []])), webVotes: Object.fromEntries(options.map((o) => [o.id, []])),
    audience, groupId, open: true, createdAt: FieldValue.serverTimestamp(), closesAt: new Date(Date.now() + hours * 3600000).toISOString(),
  });
  if (audience.length) await C.pushTo(audience, { title: kind === 'free' ? `${me.name.split(' ')[0]} is free tonight` : `${me.name.split(' ')[0]} asks`, body: title, data: { route: 'plan', id }, category: 'plans' });
  return { ok: true, id, url: `${C.shareBase()}/p/${id}` };
});

exports.planVote = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const ref = db.doc(`plans/${clean(request.data?.id, 20)}`);
  const opt = clean(request.data?.optionId, 6);
  let owner = null; let title = '';
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('not-found', 'That plan is gone.');
    const p = s.data();
    if (!p.open || new Date(p.closesAt) < new Date()) throw new HttpsError('failed-precondition', 'Voting closed.');
    if (!p.options.some((o) => o.id === opt)) throw new HttpsError('invalid-argument', 'Pick an option.');
    const votes = { ...p.votes };
    const had = (votes[opt] || []).includes(uid);
    if (p.kind === 'free') Object.keys(votes).forEach((k) => { votes[k] = votes[k].filter((x) => x !== uid); });
    votes[opt] = had ? (votes[opt] || []).filter((x) => x !== uid) : [...new Set([...(votes[opt] || []), uid])];
    tx.update(ref, { votes });
    if (!had && p.owner !== uid) { owner = p.owner; title = p.title; }
  });
  if (owner) {
    const me = await C.basicCard(uid);
    await C.pushTo([owner], { title: `${me.name.split(' ')[0]} voted`, body: title, data: { route: 'plan', id: ref.id }, category: 'plans' });
  }
  return { ok: true };
});

exports.planClose = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const ref = db.doc(`plans/${clean(request.data?.id, 20)}`);
  const s = await ref.get();
  if (!s.exists || s.data().owner !== uid) throw new HttpsError('permission-denied', 'Only the person who made the plan can close it.');
  if (request.data?.delete) await ref.delete(); else await ref.update({ open: false });
  return { ok: true };
});

/* ================= Office hours queue ================= */
exports.queueOpen = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'queueOpen', 10);
  const d = request.data || {};
  const me = await C.basicCard(uid);
  const code = C.shortId(6);
  await db.doc(`queues/${code}`).set({
    host: uid, hostName: clean(d.hostName, 60) || me.name, title: clean(d.title, 80) || 'Office hours', course: clean(d.course, 16).toUpperCase(),
    place: clean(d.place, 100), open: true, waiting: [], serving: null, served: 0, createdAt: FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
  });
  return { ok: true, code, url: `${C.shareBase()}/q/${code}` };
});

exports.queueJoin = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const code = clean(request.data?.code, 10).toUpperCase();
  const ref = db.doc(`queues/${code}`);
  const s = await ref.get();
  if (!s.exists || !s.data().open) throw new HttpsError('not-found', "That queue isn't open.");
  const existing = await ref.collection('entries').where('uid', '==', uid).where('status', '==', 'waiting').limit(1).get();
  if (!existing.empty) return { ok: true, entryId: existing.docs[0].id };
  const me = await C.basicCard(uid);
  const entryId = C.shortId(8);
  await ref.collection('entries').doc(entryId).set({ uid, name: clean(request.data?.name, 60) || me.name || 'Student', note: clean(request.data?.note, 200), status: 'waiting', joinedAt: FieldValue.serverTimestamp() });
  await ref.update({ waiting: FieldValue.arrayUnion(entryId) });
  return { ok: true, entryId };
});

exports.queueLeave = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const code = clean(request.data?.code, 10).toUpperCase();
  const entryId = clean(request.data?.entryId, 12);
  const ref = db.doc(`queues/${code}`);
  const e = await ref.collection('entries').doc(entryId).get();
  if (!e.exists || e.data().uid !== uid) return { ok: true };
  await e.ref.update({ status: 'left' });
  await ref.update({ waiting: FieldValue.arrayRemove(entryId) });
  return { ok: true };
});

exports.queueNext = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const code = clean(request.data?.code, 10).toUpperCase();
  const ref = db.doc(`queues/${code}`);
  let called = null; let next = null; let hostName = '';
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists || s.data().host !== uid) throw new HttpsError('permission-denied', 'Only the host can call the next person.');
    const q = s.data(); hostName = q.hostName;
    const waiting = [...(q.waiting || [])];
    if (q.serving) tx.update(ref.collection('entries').doc(q.serving), { status: 'done' });
    const id = waiting.shift() || null;
    if (id) tx.update(ref.collection('entries').doc(id), { status: 'called', calledAt: FieldValue.serverTimestamp() });
    tx.update(ref, { waiting, serving: id, served: FieldValue.increment(id ? 1 : 0) });
    called = id; next = waiting[0] || null;
  });
  const uidOf = async (id) => (id ? ((await ref.collection('entries').doc(id).get()).data() || {}).uid : null);
  const [a, b] = await Promise.all([uidOf(called), uidOf(next)]);
  if (a) await C.pushTo([a], { title: "You're up!", body: `${hostName} is ready for you.`, data: { route: 'queue', code }, category: 'queue' });
  if (b) await C.pushTo([b], { title: "You're next", body: `Head over to ${hostName}'s office hours.`, data: { route: 'queue', code }, category: 'queue' });
  return { ok: true, serving: called };
});

exports.queueClose = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const code = clean(request.data?.code, 10).toUpperCase();
  const ref = db.doc(`queues/${code}`);
  const s = await ref.get();
  if (!s.exists || s.data().host !== uid) throw new HttpsError('permission-denied', 'Only the host can close the queue.');
  const waiting = s.data().waiting || [];
  await ref.update({ open: false, waiting: [], serving: null });
  const uids = (await Promise.all(waiting.map((id) => ref.collection('entries').doc(id).get()))).map((e) => e.exists && e.data().uid).filter(Boolean);
  await C.pushTo(uids, { title: 'Office hours ended', body: `${s.data().hostName} closed the queue for today.`, data: { route: 'queue', code }, category: 'queue' });
  return { ok: true };
});

/* ================= Present Mode ================= */
/* The TV page (web.js /present) signs in anonymously and calls
   presentScreen to get a code. The phone claims the code, then sends
   what to show. Only the claiming phone and that screen can read it. */
exports.presentScreen = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  await C.takeQuota(uid, 'presentScreen', 30);
  const code = C.shortId(6);
  await db.doc(`present/${code}`).set({ screens: [uid], owner: null, item: null, createdAt: FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 4 * 3600000).toISOString() });
  return { code };
});

exports.presentClaim = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const ref = db.doc(`present/${clean(request.data?.code, 10).toUpperCase()}`);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists || new Date(s.data().expiresAt) < new Date()) throw new HttpsError('not-found', "That TV code didn't work. Check the code on the screen.");
    if (s.data().owner && s.data().owner !== uid) throw new HttpsError('already-exists', 'Someone else is already presenting on that screen.');
    tx.update(ref, { owner: uid, claimedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true, code: ref.id };
});

exports.presentShow = onCall({ ...C.callOpts(AI), memory: '512MiB' }, async (request) => {
  const uid = C.requireAuth(request);
  const ref = db.doc(`present/${clean(request.data?.code, 10).toUpperCase()}`);
  const s = await ref.get();
  if (!s.exists || s.data().owner !== uid) throw new HttpsError('permission-denied', 'Connect to the screen first.');
  const d = request.data || {};
  const it = d.item || {};
  let item;
  if (d.uploadPath) {
    const up = await C.readUpload(uid, d.uploadPath, { maxBytes: 25 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] });
    if (up.contentType.startsWith('image/')) {
      const m = await C.moderate({ image: up.buf, mediaType: up.contentType });
      if (!m.allowed) { await up.file.delete().catch(() => {}); throw new HttpsError('invalid-argument', m.held ? 'Try again in a minute.' : (m.reason || "That can't be shown.")); }
    }
    const url = await C.publishFile(up.file, `present/${ref.id}/${C.shortId(8)}.${up.contentType === 'application/pdf' ? 'pdf' : 'jpg'}`, up.contentType);
    const prev = s.data().item;
    if (up.contentType === 'application/pdf') item = { kind: 'pdf', url, title: clean(it.title, 100) };
    else item = prev && prev.kind === 'images' && d.append ? { ...prev, images: [...prev.images, url].slice(-40), index: prev.images.length } : { kind: 'images', images: [url], index: 0, title: clean(it.title, 100) };
  } else if (it.kind === 'link') {
    const url = C.cleanUrl(it.url);
    if (!url) throw new HttpsError('invalid-argument', 'Paste a link that starts with https://');
    item = { kind: 'link', url, title: clean(it.title, 100) };
  } else if (it.kind === 'note') {
    const text = clean(it.text, 1200);
    await textOk(text);
    item = { kind: 'note', text, title: clean(it.title, 100) };
  } else if (it.kind === 'images' && Array.isArray(it.images)) {
    item = { kind: 'images', images: it.images.map(C.cleanUrl).filter((u) => /firebasestorage\.googleapis\.com/.test(u)).slice(0, 40), index: 0, title: clean(it.title, 100) };
  } else throw new HttpsError('invalid-argument', 'Pick something to show.');
  await ref.update({ item, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

exports.presentNav = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const ref = db.doc(`present/${clean(request.data?.code, 10).toUpperCase()}`);
  const s = await ref.get();
  if (!s.exists || s.data().owner !== uid) throw new HttpsError('permission-denied', 'Connect to the screen first.');
  const item = s.data().item;
  if (!item || item.kind !== 'images') return { ok: true };
  const index = Math.max(0, Math.min(item.images.length - 1, Number(request.data?.index) || 0));
  await ref.update({ 'item.index': index });
  return { ok: true, index };
});

exports.presentEnd = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request);
  const ref = db.doc(`present/${clean(request.data?.code, 10).toUpperCase()}`);
  const s = await ref.get();
  if (!s.exists) return { ok: true };
  if (s.data().owner !== uid && !s.data().screens.includes(uid)) throw new HttpsError('permission-denied', 'Not your screen.');
  await C.deletePrefix(`present/${ref.id}/`);
  await ref.delete();
  return { ok: true };
});

/* ================= Safe Walk ================= */
exports.walkStart = onCall(C.callOpts(), async (request) => {
  const uid = C.requireAuth(request, { account: true });
  await C.takeQuota(uid, 'walk', 20);
  const d = request.data || {};
  const friends = new Set(await C.friendIds(uid));
  const watchers = (d.watchers || []).map((x) => clean(x, 64)).filter((x) => friends.has(x)).slice(0, 10);
  if (!watchers.length) throw new HttpsError('invalid-argument', 'Pick at least one friend to watch your walk.');
  const minutes = Math.min(90, Math.max(3, Number(d.minutes) || 15));
  const dest = { name: clean(d.dest?.name, 100) || 'my destination', lat: Number(d.dest?.lat) || null, lng: Number(d.dest?.lng) || null };
  const me = await C.basicCard(uid);
  const id = C.shortId(10);
  const eta = new Date(Date.now() + minutes * MIN).toISOString();
  const lat = Number(d.lat); const lng = Number(d.lng);
  await db.doc(`walks/${id}`).set({
    uid, name: me.name, avatar: me.avatar, watchers, dest, startedAt: FieldValue.serverTimestamp(), eta, minutes, status: 'active',
    last: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, at: Date.now() } : null, overdueAt: null, watchersAlerted: false,
  });
  const time = new Date(eta).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
  await C.pushTo(watchers, { title: `${me.name.split(' ')[0]} started a Safe Walk`, body: `To ${dest.name}. Should arrive by ${time}. You'll hear when they're there.`, data: { route: 'walk', id }, category: 'safety' });
  return { ok: true, id, eta };
});

async function ownWalk(request) {
  const uid = C.requireAuth(request);
  const ref = db.doc(`walks/${clean(request.data?.id, 20)}`);
  const s = await ref.get();
  if (!s.exists || s.data().uid !== uid) throw new HttpsError('not-found', 'Walk not found.');
  return { uid, ref, w: s.data() };
}

exports.walkUpdate = onCall(C.callOpts(), async (request) => {
  const { ref, w, uid } = await ownWalk(request);
  if (!['active', 'overdue'].includes(w.status)) return { ok: true, status: w.status };
  await C.takeQuota(uid, 'walkPing', 600);
  const lat = Number(request.data?.lat); const lng = Number(request.data?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpsError('invalid-argument', 'Bad location.');
  await ref.update({ last: { lat, lng, at: Date.now() } });
  return { ok: true, status: w.status };
});

exports.walkCheckIn = onCall(C.callOpts(), async (request) => {
  const { ref, w } = await ownWalk(request);
  const extra = Math.min(30, Math.max(2, Number(request.data?.minutes) || 5));
  const base = Math.max(Date.now(), Date.parse(w.eta));
  await ref.update({ status: 'active', overdueAt: null, eta: new Date(base + extra * MIN).toISOString() });
  if (w.watchersAlerted) await C.pushTo(w.watchers, { title: `${w.name.split(' ')[0]} checked in`, body: "They tapped \"I'm OK\" and are still walking.", data: { route: 'walk', id: ref.id }, category: 'safety' });
  await ref.update({ watchersAlerted: false });
  return { ok: true };
});

exports.walkEnd = onCall(C.callOpts(), async (request) => {
  const { ref, w } = await ownWalk(request);
  const arrived = request.data?.arrived !== false;
  await ref.update({ status: arrived ? 'arrived' : 'ended', endedAt: FieldValue.serverTimestamp() });
  await C.pushTo(w.watchers, { title: arrived ? `${w.name.split(' ')[0]} arrived safe` : `${w.name.split(' ')[0]} ended their Safe Walk`, body: arrived ? `Made it to ${w.dest.name}.` : 'They stopped the walk.', data: { route: 'walk', id: ref.id }, category: 'safety' });
  return { ok: true };
});

const mapsLink = (last) => (last ? `https://maps.apple.com/?ll=${last.lat},${last.lng}&q=Last%20seen` : '');

exports.walkSOS = onCall(C.callOpts(), async (request) => {
  const { ref, w } = await ownWalk(request);
  await ref.update({ status: 'sos', sosAt: FieldValue.serverTimestamp() });
  await C.pushTo(w.watchers, {
    title: `${w.name.split(' ')[0]} pressed SOS`,
    body: `Call them now. If you think they're in danger, call 911. Last seen ${w.last ? 'on the map in Flyer' : 'near their route'}.`,
    data: { route: 'walk', id: ref.id, map: mapsLink(w.last) }, category: 'safety',
  });
  return { ok: true };
});

/* Every minute: nudge a walker who's late, then tell their friends. */
exports.walkWatchdog = onSchedule('every 1 minutes', async () => {
  const now = Date.now();
  const late = await db.collection('walks').where('status', '==', 'active').where('eta', '<', new Date(now - 5 * MIN).toISOString()).limit(100).get();
  for (const d of late.docs) {
    const w = d.data();
    await d.ref.update({ status: 'overdue', overdueAt: now });
    await C.pushTo([w.uid], { title: 'Are you OK?', body: `Your Safe Walk to ${w.dest.name} is past its time. Tap to check in.`, data: { route: 'walk', id: d.id }, category: 'safety' });
  }
  const overdue = await db.collection('walks').where('status', '==', 'overdue').limit(100).get();
  for (const d of overdue.docs) {
    const w = d.data();
    if (!w.watchersAlerted && w.overdueAt && now - w.overdueAt > 3 * MIN) {
      await d.ref.update({ watchersAlerted: true });
      await C.pushTo(w.watchers, {
        title: `${w.name.split(' ')[0]} hasn't checked in`,
        body: `Their Safe Walk to ${w.dest.name} is late. Try calling them. If you think they're in danger, call 911.`,
        data: { route: 'walk', id: d.id, map: mapsLink(w.last) }, category: 'safety',
      });
    }
  }
  // Tidy finished walks after a day.
  const old = await db.collection('walks').where('status', 'in', ['arrived', 'ended']).limit(200).get();
  const batch = db.batch(); let n = 0;
  old.docs.forEach((d) => { const at = d.data().endedAt?.toMillis?.() || 0; if (at && now - at > 24 * 3600000) { batch.delete(d.ref); n++; } });
  if (n) await batch.commit();
});

/* Expired plans, queues and screens. */
exports.cleanupTogether = onSchedule('every 6 hours', async () => {
  const nowIso = new Date().toISOString();
  for (const col of ['present', 'queues']) {
    const q = await db.collection(col).where('expiresAt', '<', nowIso).limit(200).get();
    for (const d of q.docs) {
      if (col === 'present') await C.deletePrefix(`present/${d.id}/`);
      if (col === 'queues') { const e = await d.ref.collection('entries').get(); const b = db.batch(); e.docs.forEach((x) => b.delete(x.ref)); if (e.size) await b.commit(); }
      await d.ref.delete();
    }
  }
  const plans = await db.collection('plans').where('closesAt', '<', new Date(Date.now() - 30 * 24 * 3600000).toISOString()).limit(200).get();
  const b = db.batch(); plans.docs.forEach((d) => b.delete(d.ref)); if (plans.size) await b.commit();
});
