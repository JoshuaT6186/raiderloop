/**
 * A friend's page: message, meetups, their shared schedule, what you
 * share with them — and "find a time we're free".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Alert } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Row, Chip, Toggle, Divider, Loading, Empty } from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, errText, getFriendSchedule } from '../lib/firebase';
import { lastSeenLabel } from '../lib/location';
import {
  busyBlocks, freeGrid, freeWindows, windowLabel, nextDateFor, SHARE_DAYS,
} from '../lib/schedule';
import { WEEK_DAY_LABELS, metaLine } from '../lib/time';

const LEVELS = [['off', 'Nothing'], ['busy', 'Free / busy'], ['full', 'Full schedule']];

export function ShareLevelPicker({ uid }) {
  const { scheduleShare, set } = useApp();
  const level = scheduleShare.levels[uid] || 'off';
  const pick = (v) => set((p) => {
    const levels = { ...p.scheduleShare.levels };
    if (v === 'off') delete levels[uid]; else levels[uid] = v;
    return { scheduleShare: { ...p.scheduleShare, levels } };
  });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {LEVELS.map(([v, label]) => <Chip key={v} label={label} active={level === v} onPress={() => pick(v)} />)}
    </View>
  );
}

function TheirSchedule({ uid, name }) {
  const [s, setS] = useState(null);
  useEffect(() => { getFriendSchedule(uid).then(setS).catch(() => setS({ busy: null, classes: null })); }, [uid]);
  if (!s) return <Loading label="Checking their schedule…" />;
  if (s.classes && s.classes.length) {
    return (
      <View>
        {s.classes.map((c, i) => <Row key={`${c.title}${i}`} title={c.title} meta={metaLine((c.days || []).join('/'), `${c.time}–${c.endTime}`, c.place)} last={i === s.classes.length - 1} />)}
      </View>
    );
  }
  if (s.busy) {
    const byDay = SHARE_DAYS.map((d) => ({ d, n: s.busy.filter((b) => b.d === d).length }));
    return <T kind="small">{name} shares when they're busy: {byDay.map((x) => `${WEEK_DAY_LABELS[x.d]} ${x.n}`).join(' · ')} blocks. Use "Find a time" to see when you're both free.</T>;
  }
  return <T kind="small">{name} isn't sharing their schedule with you.</T>;
}

export function FriendSheet({ uid, onClose }) {
  const { t } = useTheme();
  const { friends, friendLocations, sharing, set, setSheet, showToast, nearby, meetups } = useApp();
  const f = friends.find((x) => x.uid === uid);
  if (!f) {
    return <Sheet title="Friend" onClose={onClose} height={0.4}><Empty icon="users" title="Not on your friends list" /></Sheet>;
  }
  const name = (f.name || '').split(' ')[0] || 'Friend';
  const loc = friendLocations.find((l) => l.uid === uid);
  const locOn = sharing.allowed.includes(uid);
  const nearOn = nearby.allow.includes(uid);
  const theirs = meetups.filter((m) => m.members.includes(uid));
  const run = async (fn, ok) => { try { await fn(); if (ok) showToast(ok); } catch (e) { showToast(errText(e)); } };

  return (
    <Sheet title={f.name || f.handle} hand={`@${f.handle}`} onClose={onClose} height={0.94}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Avatar config={f.avatar} size={72} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Button title="Message" icon="chat" small onPress={() => setSheet({ type: 'chat', withUid: uid })} style={{ marginBottom: 8 }} />
          <Button title="Suggest a meetup" icon="users" small kind="ghost" onPress={() => setSheet({ type: 'meetupNew', to: [uid] })} />
        </View>
      </View>
      {loc ? <PostIt color="green" seed={uid} padding={10}><PT kind="bold">Sharing location with you · {lastSeenLabel(loc.updatedAt)}</PT></PostIt> : null}
      {theirs.length ? <T kind="small" style={{ marginTop: 8 }}>{theirs.length} upcoming {theirs.length === 1 ? 'meetup' : 'meetups'} together.</T> : null}

      <T kind="tiny" style={{ marginTop: 16, marginBottom: 6 }}>{name}'s schedule</T>
      <TheirSchedule uid={uid} name={name} />
      <Button title="Find a time we're both free" icon="clock" small kind="ghost" onPress={() => setSheet({ type: 'findTime', uids: [uid] })} style={{ marginTop: 10, alignSelf: 'flex-start' }} />

      <Divider />
      <T kind="tiny" style={{ marginBottom: 6 }}>What {name} can see of your schedule</T>
      <ShareLevelPicker uid={uid} />
      <T kind="small">Free / busy shows only when you're in class. No class names or buildings. Changing this is quiet; {name} isn't notified.</T>

      <Divider />
      <Row title="Share my live location" meta="Only while Flyer is open; set times in Friends → Sharing" right={<Toggle value={locOn} onChange={() => set((p) => ({ sharing: { ...p.sharing, allowed: locOn ? p.sharing.allowed.filter((x) => x !== uid) : [...p.sharing.allowed, uid] } }))} label={`Share location with ${name}`} />} />
      <Row title="Nearby alerts" meta={nearby.on ? `Only works if ${name} also picks you` : 'Turn on in Friends → Sharing first'} right={<Toggle value={nearOn} onChange={() => { if (!nearby.on) { setSheet({ type: 'friends', tab: 'sharing' }); return; } set((p) => ({ nearby: { ...p.nearby, allow: nearOn ? p.nearby.allow.filter((x) => x !== uid) : [...p.nearby.allow, uid] } })); }} label={`Nearby alerts with ${name}`} />} last />

      <Divider />
      <Row title="Remove friend" left={<Icon name="userPlus" color={t.redPen} />} onPress={() => Alert.alert(`Remove ${name}?`, "They aren't told. Anything you shared with them stops right away.", [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => run(() => api.removeFriend({ uid }).then(onClose), 'Removed') }])} />
      <Row title="Report" left={<Icon name="report" color={t.redPen} />} onPress={() => run(() => api.reportContent({ uid, reason: 'Reported from profile', kind: 'user' }), 'Reported. Thanks!')} />
      <Row title="Block" left={<Icon name="close" color={t.redPen} />} onPress={() => Alert.alert(`Block ${name}?`, "They won't be able to find, add, or message you. They aren't told.", [{ text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => run(() => api.blockUser({ uid }).then(onClose), 'Blocked') }])} last />
    </Sheet>
  );
}

/* ---------- Find a time we're all free ---------- */
export function FindTimeSheet({ uids = [], flockId, onClose }) {
  const { t } = useTheme();
  const { scheduleItems, friends, chats, setSheet } = useApp();
  const [data, setData] = useState(null);
  useEffect(() => {
    let off = false;
    Promise.all(uids.map((u) => getFriendSchedule(u).then((s) => ({ uid: u, busy: s.busy })).catch(() => ({ uid: u, busy: null }))))
      .then((r) => { if (!off) setData(r); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uids.join(',')]);
  const nameOf = (u) => {
    const f = friends.find((x) => x.uid === u);
    if (f) return (f.name || '').split(' ')[0];
    const c = chats.find((x) => x.memberCards && x.memberCards[u]);
    return c ? (c.memberCards[u].name || '').split(' ')[0] : 'Someone';
  };
  const counted = (data || []).filter((x) => x.busy);
  const missing = (data || []).filter((x) => !x.busy);
  const people = useMemo(() => [busyBlocks(scheduleItems), ...counted.map((x) => x.busy)], [data, scheduleItems]);
  const grid = useMemo(() => freeGrid(people), [people]);
  const windows = useMemo(() => freeWindows(people).sort((a, b) => (b.e - b.s) - (a.e - a.s)).slice(0, 5), [people]);
  const plan = (w) => {
    const at = nextDateFor(w.d, w.s);
    setSheet(flockId ? { type: 'meetupNew', flockId, at: at && at.getTime() } : { type: 'meetupNew', to: uids, at: at && at.getTime() });
  };
  return (
    <Sheet title="Find a time" hand="When everyone's free, weekdays 8 AM–8 PM" onClose={onClose} height={0.94}>
      {!data ? <Loading label="Lining up schedules…" /> : (
        <>
          <T kind="small">Counting you{counted.length ? ` and ${counted.map((x) => nameOf(x.uid)).join(', ')}` : ''}.{missing.length ? ` ${missing.map((x) => nameOf(x.uid)).join(', ')} ${missing.length === 1 ? "isn't" : "aren't"} sharing a schedule with you, so they're not counted.` : ''}</T>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <View style={{ width: 34 }}>
              <View style={{ height: 20 }} />
              {grid[0].hours.map((h) => <T key={h.h} kind="small" style={{ height: 24, fontSize: 11, textAlign: 'right', paddingRight: 4 }}>{h.h % 12 === 0 ? 12 : h.h % 12}{h.h < 12 ? 'a' : 'p'}</T>)}
            </View>
            {grid.map((col) => (
              <View key={col.d} style={{ flex: 1, marginHorizontal: 2 }}>
                <T kind="bold" style={{ height: 20, textAlign: 'center', fontSize: 12 }}>{WEEK_DAY_LABELS[col.d]}</T>
                {col.hours.map((h) => <View key={h.h} style={{ height: 22, marginBottom: 2, borderRadius: 4, borderWidth: 1.5, borderColor: '#1F2A44', backgroundColor: h.free ? t.postit.green : (t.mode === 'dark' ? '#3A4A44' : '#D9D2C2') }} />)}
              </View>
            ))}
          </View>
          <T kind="small" style={{ marginTop: 6 }}>Green: everyone free that hour. Gray: someone's in class.</T>
          <T kind="tiny" style={{ marginTop: 16, marginBottom: 6 }}>Best windows</T>
          {windows.length ? windows.map((w, i) => (
            <Row key={`${w.d}${w.s}`} title={`${WEEK_DAY_LABELS[w.d]} · ${windowLabel(w)}`} meta="Tap to send a meetup card" onPress={() => plan(w)} last={i === windows.length - 1} />
          )) : <T kind="small">No shared free time this week between 8 AM and 8 PM.</T>}
        </>
      )}
    </Sheet>
  );
}
