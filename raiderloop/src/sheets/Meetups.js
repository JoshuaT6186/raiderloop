/**
 * Meetup cards: suggest a public place + time to friends (or a whole
 * flock). If they accept and you're both there, you both earn flight
 * score — checked with one location reading each, at that moment.
 */
import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Row, Chip, Field, Empty } from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, errText } from '../lib/firebase';
import { AutoCheckInNote } from './PlaceExtras';
import { PLACES, placeById, FLIGHT } from '../data/places';

const W = FLIGHT.meetupWindow;
const fmtWhen = (ms) => new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const STATUS = { going: 'Going', invited: 'Invited', declined: "Can't make it" };

export function meetupPhase(m, now = Date.now()) {
  if (now < m.atMs - W.beforeMin * 60000) return 'upcoming';
  if (now <= m.atMs + W.afterMin * 60000) return 'open';
  return 'past';
}

/* ---------- Picking a time ---------- */
function WhenPicker({ value, onChange }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const cur = value ? new Date(value) : null;
  const dayIdx = cur ? days.findIndex((d) => d.toDateString() === cur.toDateString()) : -1;
  const set = (di, h, m) => { const d = new Date(days[di]); d.setHours(h, m, 0, 0); onChange(d.getTime()); };
  const h = cur ? cur.getHours() : 12; const m = cur ? cur.getMinutes() : 0;
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {days.map((d, i) => <Chip key={i} label={i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })} active={dayIdx === i} onPress={() => set(i, h, m)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {Array.from({ length: 16 }, (_, i) => i + 7).map((hr) => <Chip key={hr} label={`${hr % 12 === 0 ? 12 : hr % 12}${hr < 12 ? 'a' : 'p'}`} active={!!cur && h === hr} onPress={() => set(Math.max(dayIdx, 0), hr, m)} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row' }}>
        {[0, 15, 30, 45].map((mm) => <Chip key={mm} label={`:${String(mm).padStart(2, '0')}`} color="blue" active={!!cur && m === mm} onPress={() => set(Math.max(dayIdx, 0), h, mm)} />)}
      </View>
    </View>
  );
}

function PlacePicker({ value, onChange }) {
  const { t } = useTheme();
  const [q, setQ] = useState('');
  const p = value ? placeById(value) : null;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? PLACES.filter((x) => x.name.toLowerCase().includes(s)).slice(0, 6) : [];
  }, [q]);
  if (p) return <Row title={p.name} meta="Public campus spot" right={<Pressable onPress={() => onChange(null)} hitSlop={10}><T kind="hand" color={t.redPen}>change</T></Pressable>} last />;
  return (
    <View>
      <Field placeholder="Search campus places…" value={q} onChangeText={setQ} style={{ marginBottom: 4 }} />
      {list.map((x, i) => <Row key={x.id} title={x.name} onPress={() => { onChange(x.id); setQ(''); }} last={i === list.length - 1} />)}
      {!q ? <T kind="small">Meetups are always at a public spot on the campus list.</T> : null}
    </View>
  );
}

/* ---------- New meetup ---------- */
export function MeetupNewSheet({ placeId: initialPlace, to: initialTo, flockId, at: initialAt, onClose }) {
  const { t } = useTheme();
  const { friends, chats, showToast, user, setSheet } = useApp();
  const flock = flockId ? chats.find((c) => c.id === flockId) : null;
  const [to, setTo] = useState(initialTo || []);
  const [placeId, setPlaceId] = useState(initialPlace || null);
  const [at, setAt] = useState(initialAt || null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user || user.isAnonymous) { setTimeout(() => setSheet({ type: 'account' }), 0); return null; }
  const toggle = (uid) => setTo((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]));
  const ok = placeId && at && at > Date.now() && (flockId || to.length);
  const send = async () => {
    setBusy(true);
    try {
      await api.createMeetup({ placeId, at: new Date(at).toISOString(), note, ...(flockId ? { flockId } : { to }) });
      showToast('Meetup card sent');
      onClose();
    } catch (e) { showToast(errText(e)); }
    setBusy(false);
  };
  return (
    <Sheet title="Suggest a meetup" hand="Plan it. Show up. Both get points." onClose={onClose} height={0.94}
      footer={<Button title="Send card" icon="send" loading={busy} disabled={!ok} onPress={send} />}>
      <T kind="tiny" style={{ marginBottom: 6 }}>Who</T>
      {flock ? <PostIt color="blue" seed={flock.id} padding={10}><PT kind="bold">Everyone in {flock.name}</PT></PostIt> : friends.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {friends.map((f) => (
            <Pressable key={f.uid} onPress={() => toggle(f.uid)} style={{ alignItems: 'center', marginRight: 12, marginBottom: 8, opacity: to.includes(f.uid) ? 1 : 0.4 }} accessibilityRole="button" accessibilityState={{ selected: to.includes(f.uid) }} accessibilityLabel={f.name}>
              <Avatar config={f.avatar} size={44} />
              <T kind="small" style={{ fontSize: 11 }}>{(f.name || '').split(' ')[0]}</T>
            </Pressable>
          ))}
        </View>
      ) : <T kind="small">Add friends first.</T>}
      <T kind="tiny" style={{ marginTop: 14, marginBottom: 6 }}>Where</T>
      <PlacePicker value={placeId} onChange={setPlaceId} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
        <T kind="tiny">When</T>
        <T kind="hand" color={at ? t.accent : t.faint}>{at ? fmtWhen(at) : 'pick a time'}</T>
      </View>
      <WhenPicker value={at} onChange={setAt} />
      <Field label="Note (optional)" placeholder="Bring the practice problems" value={note} onChangeText={setNote} maxLength={140} style={{ marginTop: 10 }} />
      <T kind="small">When you're both there ({W.beforeMin} min before to {W.afterMin} min after), Flyer checks you in automatically. You each get +{FLIGHT.points.meetup} flight score, or +{FLIGHT.points.meetupBig} at the Rec or a game.</T>
    </Sheet>
  );
}

/* ---------- One meetup ---------- */
export function MeetupCard({ m, compact, onOpen }) {
  const { user, friends, chats } = useApp();
  const me = user?.uid;
  const mine = m.status?.[me];
  const phase = meetupPhase(m);
  const names = (m.members || []).filter((u) => u !== me).map((u) => {
    const f = friends.find((x) => x.uid === u);
    if (f) return (f.name || '').split(' ')[0];
    const c = chats.find((x) => x.memberCards && x.memberCards[u]);
    return c ? (c.memberCards[u].name || '').split(' ')[0] : 'someone';
  });
  const color = phase === 'open' ? 'green' : mine === 'invited' ? 'blue' : 'yellow';
  return (
    <PostIt color={color} seed={m.id} onPress={onOpen} padding={compact ? 10 : 14}>
      <PT kind="tiny">{phase === 'open' ? 'Happening now' : mine === 'invited' ? `Invite from ${m.fromName || 'a friend'}` : 'Meetup'}</PT>
      <PT kind="title" style={{ marginTop: 2 }}>{m.placeName}</PT>
      <PT kind="small">{fmtWhen(m.atMs)} · with {names.slice(0, 3).join(', ')}{names.length > 3 ? ` +${names.length - 3}` : ''}</PT>
      {m.note && !compact ? <PT kind="small" style={{ marginTop: 4 }}>"{m.note}"</PT> : null}
    </PostIt>
  );
}

export function MeetupSheet({ id, onClose }) {
  const { t } = useTheme();
  const { meetups, user, friends, chats, showToast, setSheet } = useApp();
  const m = meetups.find((x) => x.id === id);
  const [busy, setBusy] = useState(null);
  const [reschedule, setReschedule] = useState(null);
  if (!m) {
    return <Sheet title="Meetup" onClose={onClose} height={0.4}><Empty icon="users" title="This meetup is gone" body="It was canceled or has passed." /></Sheet>;
  }
  const me = user?.uid;
  const mine = m.status?.[me];
  const phase = meetupPhase(m);
  const nameOf = (u) => {
    if (u === me) return 'You';
    const f = friends.find((x) => x.uid === u);
    if (f) return f.name;
    const c = chats.find((x) => x.memberCards && x.memberCards[u]);
    return c ? c.memberCards[u].name : 'Someone';
  };
  const act = async (label, fn) => {
    setBusy(label);
    try { await fn(); } catch (e) { showToast(errText(e)); }
    setBusy(null);
  };
  const respond = (answer, at) => act(answer, async () => { await api.respondMeetup({ id, answer, at: at ? new Date(at).toISOString() : undefined }); showToast(answer === 'going' ? "You're in" : answer === 'declined' ? 'Declined. They aren\'t notified.' : 'New time sent'); setReschedule(null); });
  const cancel = () => act('cancel', async () => { await api.cancelMeetup({ id }); showToast(m.from === me ? 'Meetup canceled' : "You're out"); onClose(); });
  const place = placeById(m.placeId);

  return (
    <Sheet title={m.placeName} hand={fmtWhen(m.atMs)} onClose={onClose} height={0.88}
      footer={(
        <View>
          {mine === 'invited' ? (
            <View style={{ flexDirection: 'row' }}>
              <Button title="Accept" icon="check" small loading={busy === 'going'} onPress={() => respond('going')} style={{ flex: 1.1, marginRight: 6 }} />
              <Button title="New time" small kind="ghost" onPress={() => setReschedule(m.atMs)} style={{ flex: 1, marginRight: 6 }} />
              <Button title="Decline" small kind="ghost" loading={busy === 'declined'} onPress={() => respond('declined')} style={{ flex: 1 }} />
            </View>
          ) : mine === 'going' && phase === 'open' ? (
            m.checkedIn?.[me] ? <T kind="bold" color={t.ok} style={{ textAlign: 'center' }}>You're checked in ✓</T> : <AutoCheckInNote text={`Flyer checks you in automatically once you're at ${m.placeName}.`} />
          ) : mine === 'going' ? (
            <Button title="Suggest another time" kind="ghost" onPress={() => setReschedule(m.atMs)} />
          ) : null}
        </View>
      )}>
      {m.note ? <PostIt color="yellow" seed={m.id} tape><PT>"{m.note}"</PT><PT kind="small" style={{ marginTop: 4 }}>From {m.fromName}</PT></PostIt> : null}
      <T kind="tiny" style={{ marginTop: 14, marginBottom: 6 }}>Who's coming</T>
      {(m.members || []).map((u, i) => (
        <Row key={u} title={nameOf(u)} meta={m.checkedIn?.[u] ? 'Here ✓' : STATUS[m.status?.[u]] || ''} last={i === m.members.length - 1}
          right={m.awarded?.[u] ? <T kind="bold" color={t.ok}>+{m.awarded[u]}</T> : null} />
      ))}
      {phase === 'upcoming' ? <T kind="small" style={{ marginTop: 10 }}>Flyer checks everyone in automatically from {W.beforeMin} minutes before to {W.afterMin} minutes after the meetup.</T> : null}
      {reschedule ? (
        <View style={{ marginTop: 14 }}>
          <T kind="tiny" style={{ marginBottom: 6 }}>Suggest a new time</T>
          {/* eslint-disable-next-line no-use-before-define */}
          <MiniWhen value={reschedule} onChange={setReschedule} />
          <Button title={`Send ${fmtWhen(reschedule)}`} small loading={busy === 'reschedule'} disabled={reschedule <= Date.now()} onPress={() => respond('reschedule', reschedule)} style={{ marginTop: 6 }} />
        </View>
      ) : null}
      <View style={{ marginTop: 14 }}>
        {place ? <Row title="Walking directions" left={<Icon name="walk" color={t.ink} />} onPress={() => { onClose(); setSheet({ type: 'building', id: place.id }); }} /> : null}
        <Row title={m.from === me ? 'Cancel meetup' : "I can't make it"} left={<Icon name="close" color={t.redPen} />} onPress={cancel} last />
      </View>
    </Sheet>
  );
}

function MiniWhen({ value, onChange }) { return <WhenPicker value={value} onChange={onChange} />; }

/* ---------- Home section ---------- */
export function MeetupsPeek() {
  const { meetups, user, setSheet } = useApp();
  const me = user?.uid;
  const list = meetups.filter((m) => m.status?.[me] !== 'declined' && meetupPhase(m) !== 'past').slice(0, 3);
  if (!list.length) return null;
  return (
    <View style={{ marginTop: 18 }}>
      {list.map((m) => (
        <View key={m.id} style={{ marginBottom: 10 }}>
          <MeetupCard m={m} compact onOpen={() => setSheet({ type: 'meetup', id: m.id })} />
        </View>
      ))}
    </View>
  );
}
