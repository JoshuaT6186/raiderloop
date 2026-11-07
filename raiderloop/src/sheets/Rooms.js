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
        <PT kind="tiny">{r.how === 'picked' ? 'Building' : r.how === 'code' ? 'Building code' : r.how === 'yours' ? 'You taught Flyer this one' : 'Best match'}</PT>
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

/* Two simple boxes: the building (type part of its name and pick it),
   and the room number. Your classes are one tap away. Typing the room
   the way the schedule writes it ("HOLDEN 104") still works too. */
export function RoomFinderSheet({ query: initialQuery, buildingId, onClose }) {
  const { t } = useTheme();
  const { scheduleItems, roomAliases, set, showToast } = useApp();
  const start = initialQuery ? findRoom(initialQuery, roomAliases) : null;
  const [bText, setBText] = useState(start?.building?.name || (buildingId ? (buildingById(buildingId)?.name || '') : (start?.buildingText || '')));
  const [picked, setPicked] = useState(start?.building || (buildingId ? buildingById(buildingId) : null));
  const [room, setRoom] = useState(start?.room || '');
  const [picking, setPicking] = useState(false);
  const [bq, setBq] = useState('');
  const typed = bText.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (picked || typed.length < 2) return [];
    const words = typed.split(/\s+/);
    return BUILDINGS.filter((b) => {
      const name = b.name.toLowerCase();
      const short = (b.short || '').toLowerCase();
      return words.every((w) => name.split(/[^a-z0-9]+/).some((n) => n.startsWith(w))) || short === typed;
    }).slice(0, 6);
  }, [typed, picked]);
  /* If they typed a whole "HOLDEN 104" into the building box, read it. */
  const r = useMemo(() => {
    if (picked) {
      const f = room.trim() ? findRoom(`${picked.name} ${room.trim()}`, roomAliases) : null;
      return { query: `${picked.name} ${room}`.trim(), code: '', buildingText: picked.name, building: picked, confidence: 1, how: 'picked', room: f ? f.room : '', floor: f ? f.floor : null, floorText: f ? f.floorText : '' };
    }
    if (typed.length > 1 && /\d/.test(typed)) return findRoom(bText, roomAliases);
    return null;
  }, [picked, room, typed, bText, roomAliases]);
  const places = [...new Map(scheduleItems.filter((c) => !c.oneOff && c.place).map((c) => [c.place, c])).values()];
  const fromClass = (c) => {
    const f = findRoom(c.place, roomAliases);
    setPicked(f.building || null); setBText(f.building ? f.building.name : f.buildingText); setRoom(f.room || '');
  };
  const teach = (b) => {
    if (r && r.code) set((p) => ({ roomAliases: { ...p.roomAliases, [r.code]: b.id } }));
    showToast(r && r.code ? `Got it: ${r.code} is ${b.name}` : b.name);
    setPicked(b); setBText(b.name); if (r && r.room) setRoom(r.room);
    setPicking(false);
  };
  const hits = BUILDINGS.filter((b) => b.name.toLowerCase().includes(bq.trim().toLowerCase())).slice(0, 30);
  return (
    <Sheet title="Find a room" hand="Type the building, then the room number." onClose={onClose} height={0.95}>
      <Field label="Building" placeholder="Holden, Math, Science…" value={bText} onChangeText={(v) => { setBText(v); setPicked(null); }} autoCorrect={false} returnKeyType="next" clearButtonMode="while-editing" />
      {suggestions.length ? (
        <Card style={{ marginTop: -4, marginBottom: 10 }}>
          {suggestions.map((b, i) => <Row key={b.id} title={b.name} meta={walkLabel(b)} left={<Icon name="building" color={t.ink} />} onPress={() => { setPicked(b); setBText(b.name); }} last={i === suggestions.length - 1} />)}
        </Card>
      ) : null}
      <Field label="Room number" placeholder="104" value={room} onChangeText={setRoom} autoCapitalize="characters" autoCorrect={false} keyboardType="default" returnKeyType="search" />
      {!r ? (
        places.length ? (
          <Card>
            <T kind="tiny" style={{ marginBottom: 4 }}>Your classes</T>
            {places.map((c, i) => <Row key={c.id} title={c.place} meta={c.title} left={<Icon name="door" color={t.ink} />} onPress={() => fromClass(c)} last={i === places.length - 1} />)}
          </Card>
        ) : <Empty icon="door" title="Where's your class?" body="Type the building and room above, or add your classes in the Planner and they'll show up here." />
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

