/**
 * Room finder + floor guide. Type "HOLDEN 104" (or tap one of your
 * classes) and Flyer shows the building on the map, which floor the
 * room is probably on, the entrances other students actually use,
 * and whether the elevator is working right now.
 *
 * Flyer doesn't draw official floor plans. The SUB and the Library
 * publish public floor maps, and those are linked when you're there.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Field, Empty,
} from '../ui/Paper';
import { SectionNote, Pill } from '../ui/Kit';
import { Polaroid } from '../ui/Scrap';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { findRoom, floorLabel } from '../lib/rooms';
import { listenPublic } from '../lib/firebase';
import { openDirections, openUrl } from '../lib/links';
import { BUILDINGS, buildingById, walkLabel, floorPlanFor } from '../data/campus';
import { StatusTaps } from './Status';
import LastChecked from '../ui/LastChecked';
import { CHECKED } from '../config';

const INK = '#1F2A44';

/* A simple stack of floors, with your floor marked. It only draws up
   to your floor (Flyer doesn't claim to know how tall a building is). */
function FloorStack({ floor }) {
  const { t } = useTheme();
  if (floor == null) return null;
  const top = Math.max(1, floor);
  const levels = [];
  for (let f = top; f >= 1; f--) levels.push(f);
  if (floor === 0) levels.push(0);
  return (
    <View style={{ alignItems: 'center', marginVertical: 6 }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 90, borderRightWidth: 90, borderBottomWidth: 22, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: t.borderStrong }} />
      {levels.map((f) => {
        const on = f === floor;
        return (
          <View key={f} style={{ width: 180, height: 34, borderWidth: 2, borderTopWidth: f === top ? 2 : 0, borderColor: INK, backgroundColor: on ? t.highlight : t.card, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
            <T kind="bold" color={on ? INK : t.inkSoft} style={{ flex: 1 }}>{floorLabel(f)}</T>
            {on ? <Icon name="pin" size={18} color={INK} /> : null}
          </View>
        );
      })}
      <View style={{ width: 200, height: 3, backgroundColor: INK }} />
    </View>
  );
}

export function BuildingTips({ buildingId, max = 6 }) {
  const { isHidden } = useApp();
  const [tips, setTips] = useState([]);
  useEffect(() => listenPublic('tip', (list) => setTips(list.filter((p) => p.place?.buildingId === buildingId && !isHidden('publicPost', p.id)))), [buildingId]);
  if (!tips.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      {tips.slice(0, max).map((p) => (
        p.photoUrl ? (
          <View key={p.id} style={{ width: '48%', marginBottom: 14 }}>
            <Polaroid uri={p.photoUrl} caption={p.title} sub={`from ${p.name}`} photoHeight={110} seed={p.id} />
          </View>
        ) : (
          <View key={p.id} style={{ width: '100%', marginBottom: 10 }}><PostIt color="yellow" seed={p.id}><PT>{p.title}</PT><PT kind="small">from {p.name}</PT></PostIt></View>
        )
      ))}
    </View>
  );
}

function Result({ r, onPickBuilding }) {
  const { t } = useTheme();
  const { setSheet, scheduleItems } = useApp();
  const b = r.building;
  const plan = floorPlanFor(b);
  const mine = b ? scheduleItems.filter((c) => c.buildingId === b.id) : [];
  if (!b) {
    return (
      <PostIt color="pink" tilt={-0.8}>
        <PT kind="bold">Flyer doesn't know "{r.buildingText || r.query}" yet.</PT>
        <PT kind="small" style={{ marginTop: 2 }}>Pick the building once and Flyer will remember that code on this phone.</PT>
        <Button title="Pick the building" small onPress={onPickBuilding} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      </PostIt>
    );
  }
  return (
    <View>
      <PostIt color="green" tape tilt={-0.6}>
        <PT kind="tiny">{r.how === 'code' ? 'Building code' : r.how === 'yours' ? 'You taught Flyer this one' : 'Best match'}</PT>
        <PT kind="title" style={{ fontSize: 22 }}>{b.name}</PT>
        <PT kind="small">{[walkLabel(b), r.room ? `Room ${r.room}` : null].filter(Boolean).join(' · ')}</PT>
        {r.floor != null ? <PT kind="bold" style={{ marginTop: 8 }}>Probably {floorLabel(r.floor).toLowerCase()}. Most rooms here start with their floor number.</PT> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          <Button title="Directions" icon="walk" small onPress={() => openDirections(b)} style={{ marginRight: 8, marginBottom: 6 }} />
          <Button title="On the map" icon="map" small kind="ghost" onPress={() => setSheet({ type: 'building', id: b.id })} style={{ backgroundColor: '#fff', marginRight: 8, marginBottom: 6 }} />
          {r.confidence < 0.9 ? <Button title="Wrong building?" small kind="ghost" onPress={onPickBuilding} style={{ backgroundColor: '#fff', marginBottom: 6 }} /> : null}
        </View>
      </PostIt>
      {r.how === 'code' ? <LastChecked date={CHECKED.roomCodes} source="Building code from TTU IT Help Central" itemId={`room-code:${r.code}`} title={`${r.code} → ${b.name}`} /> : null}
      <FloorStack floor={r.floor} />
      {plan ? <Row title={plan.label} meta="Official public floor maps for this building" left={<Icon name="layers" color={t.ink} />} onPress={() => openUrl(plan.url)} /> : null}
      {mine.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>{mine.map((c) => <Pill key={c.id} label={`${c.title} · ${(c.days || []).join('/')} ${c.time}`} color="yellow" />)}</View> : null}
      <T kind="tiny" style={{ marginTop: 16, marginBottom: 6 }}>Right now</T>
      <StatusTaps placeId={b.id} kinds={['elevator', 'printer', 'seats', 'wifi']} />
      <T kind="tiny" style={{ marginTop: 16, marginBottom: 6 }}>Doors and tips from students</T>
      <BuildingTips buildingId={b.id} />
      <Button title="Add the door you use" icon="camera" small kind="ghost" onPress={() => setSheet({ type: 'compose', kind: 'postcard' })} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
      <SectionNote icon="info">Snap the entrance you actually use and turn on "share as a tip" so the next person finds it faster. Objects and places only.</SectionNote>
    </View>
  );
}

export function RoomFinderSheet({ query: initialQuery, buildingId, onClose }) {
  const { t } = useTheme();
  const { scheduleItems, roomAliases, set, showToast } = useApp();
  const [q, setQ] = useState(initialQuery || (buildingId ? (buildingById(buildingId)?.name || '') : ''));
  const [picking, setPicking] = useState(false);
  const [bq, setBq] = useState('');
  const r = useMemo(() => (q.trim().length > 1 ? findRoom(q, roomAliases) : null), [q, roomAliases]);
  const places = [...new Map(scheduleItems.filter((c) => !c.oneOff && c.place).map((c) => [c.place, c])).values()];
  const teach = (b) => {
    if (r && r.code) set((p) => ({ roomAliases: { ...p.roomAliases, [r.code]: b.id } }));
    showToast(r && r.code ? `Got it: ${r.code} is ${b.name}` : b.name);
    if (!r || !r.code) setQ(b.name);
    setPicking(false);
  };
  const hits = BUILDINGS.filter((b) => b.name.toLowerCase().includes(bq.trim().toLowerCase())).slice(0, 30);
  return (
    <Sheet title="Find a room" hand="Type it the way your schedule shows it." onClose={onClose} height={0.95}>
      <Field placeholder="HOLDEN 104, MATH 012, Holden Hall 104…" value={q} onChangeText={setQ} autoCapitalize="characters" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />
      {!r ? (
        places.length ? (
          <Card>
            <T kind="tiny" style={{ marginBottom: 4 }}>Your classes</T>
            {places.map((c, i) => <Row key={c.id} title={c.place} meta={c.title} left={<Icon name="door" color={t.ink} />} onPress={() => setQ(c.place)} last={i === places.length - 1} />)}
          </Card>
        ) : <Empty icon="door" title="Where's your class?" body="Add your classes in the Planner and they'll show up here." />
      ) : <Result r={r} onPickBuilding={() => setPicking(true)} />}
      {picking ? (
        <Sheet title="Which building?" hand={r?.code ? `Flyer will remember ${r.code} on this phone.` : ''} onClose={() => setPicking(false)} height={0.85}>
          <Field placeholder="Search buildings…" value={bq} onChangeText={setBq} />
          {hits.map((b, i) => <Row key={b.id} title={b.name} meta={walkLabel(b)} onPress={() => teach(b)} last={i === hits.length - 1} />)}
        </Sheet>
      ) : null}
    </Sheet>
  );
}

