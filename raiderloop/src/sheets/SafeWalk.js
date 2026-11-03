/**
 * Safe Walk: pick the friends who should know, where you're headed,
 * and about how long it'll take. They see you on the map while Flyer
 * is open, they're told when you arrive, and if you're late Flyer asks
 * "Are you OK?" first, then lets them know. One tap for SOS.
 *
 * Flyer only uses location while it's open on your screen (it never
 * runs in the background). If your phone locks, your friends see your
 * last spot and the timer keeps running on Flyer's server.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Linking, Alert } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Chip, Field, Loading, Empty, Check, Row, Toggle,
} from '../ui/Paper';
import { PersonRow, SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, listenDoc } from '../lib/firebase';
import { currentPosition, getForegroundPermission, lastSeenLabel } from '../lib/location';
import { Notifications, KeepAwake } from '../lib/native';
import { call } from '../lib/links';
import { BUILDINGS, buildingById, distanceM } from '../data/campus';
import { HEALTH } from '../data/hub';
import { SAFETY } from '../config';

const mmss = (ms) => { const neg = ms < 0; const s = Math.abs(Math.round(ms / 1000)); return `${neg ? '+' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const raiderRide = HEALTH.getHome.find((x) => x.id === 'raiderride');

function HelpNumbers() {
  const { t } = useTheme();
  return (
    <Card style={{ marginTop: 14 }}>
      <Row title="Emergency: 911" left={<Icon name="alert" color={t.redPen} />} onPress={() => call('911')} />
      <Row title={SAFETY.campusPolice.label} meta={SAFETY.campusPolice.phone} left={<Icon name="shield" color={t.ink} />} onPress={() => call(SAFETY.campusPolice.phone)} />
      {raiderRide ? <Row title="Raider Ride (free night shuttle)" meta={raiderRide.phone} left={<Icon name="bus" color={t.ink} />} onPress={() => call(raiderRide.phone)} last /> : null}
    </Card>
  );
}

async function scheduleCheck(eta, dest) {
  if (!Notifications) return null;
  try {
    return await Notifications.scheduleNotificationAsync({ content: { title: 'Did you make it?', body: `Tap to tell your friends you got to ${dest}.`, data: { route: 'walkSelf' } }, trigger: { type: 'date', date: new Date(eta) } });
  } catch (e) { return null; }
}

function ActiveWalk({ id, onDone }) {
  const { t } = useTheme();
  const { set, showToast, friends } = useApp();
  const [w, setW] = useState(undefined);
  const [now, setNow] = useState(Date.now());
  const notifId = useRef(null);
  useEffect(() => listenDoc(`walks/${id}`, setW), [id]);
  useEffect(() => { const x = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(x); }, []);
  useEffect(() => {
    const ping = async () => { const p = await currentPosition(); if (p) api.walkUpdate({ id, lat: p.lat, lng: p.lng }).catch(() => {}); };
    ping();
    const x = setInterval(ping, 20000);
    return () => clearInterval(x);
  }, [id]);
  useEffect(() => { if (w && w.eta && !notifId.current) scheduleCheck(w.eta, w.dest?.name).then((n) => { notifId.current = n; }); }, [w?.eta]);
  const finish = async (arrived) => {
    try { await api.walkEnd({ id, arrived }); } catch (e) { showToast(e.message); }
    if (notifId.current && Notifications) Notifications.cancelScheduledNotificationAsync(notifId.current).catch(() => {});
    set({ activeWalk: null }); onDone();
  };
  const sos = () => Alert.alert('Send SOS?', 'Your friends get an urgent alert with your last spot. If you are in danger, call 911.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Call 911', onPress: () => call('911') },
    { text: 'Send SOS', style: 'destructive', onPress: () => api.walkSOS({ id }).then(() => showToast('SOS sent to your friends')).catch((e) => showToast(e.message)) },
  ]);
  if (w === undefined) return <Loading />;
  if (!w || !['active', 'overdue', 'sos'].includes(w.status)) { return <Empty icon="walk" title="No walk in progress" action="Done" onAction={() => { set({ activeWalk: null }); onDone(); }} />; }
  const left = Date.parse(w.eta) - now;
  const names = w.watchers.map((u) => (friends.find((f) => f.uid === u)?.name || 'a friend').split(' ')[0]);
  return (
    <View>
      {w.status === 'overdue' ? (
        <PostIt color="pink" tape style={{ marginBottom: 14 }}>
          <PT kind="title">Are you OK?</PT>
          <PT kind="small">You're past your time. If you don't check in, your friends will be told in a few minutes.</PT>
          <Button title="I'm OK, I need more time" small onPress={() => api.walkCheckIn({ id, minutes: 5 }).catch((e) => showToast(e.message))} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        </PostIt>
      ) : null}
      <PostIt color={w.status === 'sos' ? 'pink' : 'green'} tilt={-0.6} padding={18} style={{ alignItems: 'center' }}>
        <PT kind="tiny">{w.status === 'sos' ? 'SOS sent' : `Walking to ${w.dest?.name}`}</PT>
        <T kind="marker" color="#1F2A44" style={{ fontSize: 52, lineHeight: 60 }}>{mmss(left)}</T>
        <PT kind="small">{left >= 0 ? 'until you should be there' : 'past your time'}</PT>
        <PT kind="small" style={{ marginTop: 6 }}>Watching: {names.join(', ')}</PT>
      </PostIt>
      <Button title="I made it" icon="check" onPress={() => finish(true)} style={{ marginTop: 16 }} />
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <Button title="+5 min" kind="ghost" small onPress={() => api.walkCheckIn({ id, minutes: 5 }).catch(() => {})} style={{ flex: 1, marginRight: 8 }} />
        <Button title="End walk" kind="ghost" small onPress={() => finish(false)} style={{ flex: 1 }} />
      </View>
      <Button title="SOS" icon="alert" kind="danger" onPress={sos} style={{ marginTop: 12 }} />
      <HelpNumbers />
      <SectionNote icon="info">Keep Flyer open so your friends see where you are. If the phone locks, they see your last spot and the timer keeps going.</SectionNote>
      <T kind="small" color={t.pencil}>Last update {w.last ? lastSeenLabel(new Date(w.last.at)) : 'waiting for location'}.</T>
    </View>
  );
}

export function SafeWalkSheet({ onClose }) {
  const { friends, activeWalk, set, showToast, scheduleItems, user, setSheet } = useApp();
  const [q, setQ] = useState('');
  const [dest, setDest] = useState(null);
  const [minutes, setMinutes] = useState(15);
  const [watchers, setWatchers] = useState([]);
  const [awake, setAwake] = useState(true);
  const [busy, setBusy] = useState(false);
  const signedIn = user && !user.isAnonymous;
  useEffect(() => {
    if (!activeWalk || !awake || !KeepAwake?.activateKeepAwakeAsync) return undefined;
    KeepAwake.activateKeepAwakeAsync('flyer-walk').catch(() => {});
    return () => KeepAwake.deactivateKeepAwake && KeepAwake.deactivateKeepAwake('flyer-walk');
  }, [activeWalk, awake]);
  if (!signedIn) {
    return <Sheet title="Safe Walk" onClose={onClose}><PostIt color="yellow" tape><PT kind="bold">Safe Walk needs an account</PT><PT kind="small">Your friends need to know it's you.</PT><Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10 }} /></PostIt><HelpNumbers /></Sheet>;
  }
  if (activeWalk) return <Sheet title="Safe Walk" onClose={onClose} height={0.95}><ActiveWalk id={activeWalk} onDone={onClose} /></Sheet>;
  const hits = q.trim().length > 1 ? BUILDINGS.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 5) : [];
  const pickBuilding = async (b) => {
    setDest({ name: b.name, lat: b.lat, lng: b.lng }); setQ('');
    const pos = await currentPosition();
    if (pos) { const d = distanceM(pos, b); if (d != null) setMinutes(Math.min(60, Math.max(5, Math.ceil(d / 75) + 3))); }
  };
  const nextBuildings = [...new Map(scheduleItems.filter((c) => c.buildingId).map((c) => [c.buildingId, buildingById(c.buildingId)])).values()].filter(Boolean).slice(0, 4);
  const start = async () => {
    setBusy(true);
    try {
      if (!(await getForegroundPermission(true))) throw new Error('Safe Walk needs location while Flyer is open.');
      const pos = await currentPosition();
      const r = await api.walkStart({ watchers, dest: dest || { name: q.trim() || 'home' }, minutes, lat: pos?.lat, lng: pos?.lng });
      set({ activeWalk: r.data.id });
      showToast('Your friends know you\'re walking');
    } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  return (
    <Sheet title="Safe Walk" hand="Friends watch your walk until you arrive." onClose={onClose} height={0.95}
      footer={<Button title="Start walking" icon="walk" loading={busy} disabled={!watchers.length || (!dest && !q.trim())} onPress={start} />}>
      <Field label="Where to?" value={dest ? dest.name : q} onChangeText={(v) => { setDest(null); setQ(v); }} placeholder="A building, or type Home" />
      {hits.map((b) => <Row key={b.id} title={b.name} onPress={() => pickBuilding(b)} />)}
      {!dest && !q ? <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{nextBuildings.map((b) => <Chip key={b.id} label={b.name} onPress={() => pickBuilding(b)} />)}<Chip label="Home" onPress={() => setDest({ name: 'home' })} /></View> : null}
      <T kind="tiny" style={{ marginTop: 6, marginBottom: 6 }}>About how long?</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[5, 10, 15, 20, 30, 45].map((m) => <Chip key={m} label={`${m} min`} active={minutes === m} onPress={() => setMinutes(m)} />)}</View>
      <T kind="tiny" style={{ marginTop: 8, marginBottom: 6 }}>Who should know?</T>
      {friends.length ? friends.map((f, i) => (
        <PersonRow key={f.uid} person={f} last={i === friends.length - 1} onPress={() => setWatchers((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))}
          right={<Check checked={watchers.includes(f.uid)} onPress={() => setWatchers((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))} label={f.name} />} />
      )) : <Empty icon="users" title="Add a friend first" body="Safe Walk tells the friends you pick." />}
      <Row title="Keep my screen on during the walk" right={<Toggle value={awake} onChange={setAwake} label="Keep screen on" />} last />
      <HelpNumbers />
    </Sheet>
  );
}

/* What a friend sees when they're watching your walk. */
export function WalkWatchSheet({ id, onClose }) {
  const { t } = useTheme();
  const [w, setW] = useState(undefined);
  const [now, setNow] = useState(Date.now());
  useEffect(() => listenDoc(`walks/${id}`, setW), [id]);
  useEffect(() => { const x = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(x); }, []);
  if (w === undefined) return <Sheet title="Safe Walk" onClose={onClose}><Loading /></Sheet>;
  if (!w) return <Sheet title="Safe Walk" onClose={onClose}><Empty icon="walk" title="That walk is over." /></Sheet>;
  const first = (w.name || 'Your friend').split(' ')[0];
  const left = Date.parse(w.eta) - now;
  const done = w.status === 'arrived' || w.status === 'ended';
  const color = w.status === 'sos' || w.status === 'overdue' ? 'pink' : done ? 'green' : 'yellow';
  return (
    <Sheet title={`${first}'s Safe Walk`} hand={`To ${w.dest?.name}`} onClose={onClose} height={0.9}>
      <PostIt color={color} tape padding={18} style={{ alignItems: 'center' }}>
        <PT kind="tiny">{{ active: 'On the way', overdue: 'Late, not checked in', sos: 'SOS', arrived: 'Arrived safe', ended: 'Walk ended' }[w.status] || w.status}</PT>
        {!done ? <T kind="marker" color="#1F2A44" style={{ fontSize: 46, lineHeight: 54 }}>{mmss(left)}</T> : <Icon name="check" size={44} color="#2E8256" />}
        <PT kind="small">{w.last ? `Last seen ${lastSeenLabel(new Date(w.last.at))}` : 'No location yet'}</PT>
      </PostIt>
      {w.last ? <Button title="Open last spot in Maps" icon="map" onPress={() => Linking.openURL(`http://maps.apple.com/?ll=${w.last.lat},${w.last.lng}&q=${encodeURIComponent(`${first} (Safe Walk)`)}`).catch(() => {})} style={{ marginTop: 14 }} /> : null}
      {w.status === 'sos' || w.status === 'overdue' ? (
        <PostIt color="pink" style={{ marginTop: 14 }}>
          <PT kind="bold">Try calling {first} first. If you think they're in danger, call 911.</PT>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Button title="Call 911" small kind="danger" onPress={() => call('911')} style={{ marginRight: 8, backgroundColor: '#fff' }} />
            <Button title="TTU Police" small kind="ghost" onPress={() => call(SAFETY.campusPolice.phone)} style={{ backgroundColor: '#fff' }} />
          </View>
        </PostIt>
      ) : null}
      <T kind="small" color={t.pencil} style={{ marginTop: 12 }}>You'll get a notification when {first} arrives, or if they don't check in.</T>
    </Sheet>
  );
}
