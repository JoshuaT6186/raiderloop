/**
 * Arriving at a meetup. Used by automatic check-ins (places.js) and by
 * older app builds that still call meetupCheckIn (chat.js). The bonus
 * lands for everyone once at least two people have arrived.
 */
const C = require('./common');
const S = require('./socialCore');
const F = require('./placesCore');

const { db, HttpsError } = C;
const W = F.RULES.meetupWindow;

const meetupOpen = (m, now) => now >= m.atMs - W.beforeMin * 60000 && now <= m.atMs + W.afterMin * 60000;

async function arriveAtMeetup(uid, meetupId, place, now = Date.now()) {
  const ref = db.doc(`meetups/${meetupId}`);
  const toAward = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'That meetup was canceled.');
    const m = snap.data();
    if (m.status[uid] !== 'going') throw new HttpsError('failed-precondition', 'Accept the meetup first.');
    if (!meetupOpen(m, now)) throw new HttpsError('failed-precondition', `Meetup check-in opens ${W.beforeMin} minutes before and closes ${W.afterMin} minutes after.`);
    if (m.checkedIn && m.checkedIn[uid]) return { award: [], ids: Object.keys(m.checkedIn), members: m.members, already: true };
    const checkedIn = { ...(m.checkedIn || {}), [uid]: now };
    const awarded = { ...(m.awarded || {}) };
    const ids = Object.keys(checkedIn);
    const award = ids.length >= 2 ? ids.filter((u) => awarded[u] == null) : [];
    award.forEach((u) => { awarded[u] = 0; });
    tx.update(ref, { checkedIn, awarded });
    return { award, ids, members: m.members };
  });
  if (toAward.already) return { points: 0, already: true, message: 'Already checked in.' };

  const results = {};
  for (const u of toAward.award) {
    const others = toAward.ids.filter((x) => x !== u).sort().join(',');
    const key = `${place.id}:${others}`;
    const fref = db.doc(`flight/${u}`);
    results[u] = await db.runTransaction(async (tx) => {
      const fs = await tx.get(fref);
      const f = fs.exists ? fs.data() : {};
      const day = C.chicagoDay(now);
      const count = f.meetupDay === day ? (f.meetupCount || 0) : 0;
      let bonus = ['rec', 'game'].includes(place.tier) || F.liveGameAt(place.id, now) ? F.P.meetupBig : F.P.meetup;
      const log = { ...(f.meetupLog || {}) };
      if (log[key] && now - log[key] < 7 * 86400000) bonus = Math.floor(bonus / 2);
      if (count >= F.RULES.caps.meetupBonusesPerDay) bonus = 0;
      const st = F.stampPlace(f, place, { tier: place.tier, now });
      const { pts, patch } = F.applyPoints(f, bonus + st.want, now);
      log[key] = now;
      tx.set(fref, { ...patch, stamps: st.stamps, meetupLog: log, meetupDay: day, meetupCount: count + 1 }, { merge: true });
      return pts;
    });
    await ref.update({ [`awarded.${u}`]: results[u] });
  }
  // Friends who were awarded just now hear about it; friends who haven't
  // arrived yet get a heads-up.
  const me = S.firstName((await S.publicCard(uid)).name) || 'A friend';
  await C.sendPush(toAward.award.filter((u) => u !== uid), { title: 'Meetup made!', body: `You and ${me} met up at ${place.name}. Flight score added.`, data: { open: 'meetup', meetupId } });
  await C.sendPush(toAward.members.filter((u) => u !== uid && !toAward.ids.includes(u)), { title: `${me} is here`, body: `${place.name}. Flyer checks you in when you get there.`, data: { open: 'meetup', meetupId } });
  if (results[uid] != null) return { points: results[uid], message: results[uid] > 0 ? `Meetup made! +${results[uid]} flight score` : 'Meetup made! (No bonus left today.)' };
  return { points: 0, waiting: toAward.ids.length < 2, message: toAward.ids.length < 2 ? "You're checked in. The bonus lands when a friend gets there too." : 'Checked in.' };
}

module.exports = { arriveAtMeetup, meetupOpen };
