/**
 * Campus — the map, with a paper drawer of tools and places.
 * Pins: buildings (filtered), Citibus stops, and friends who are
 * sharing with you (shown as their avatars).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, Animated, SafeAreaView, Platform } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/ThemeContext';
import { SCREEN_H, PAD } from '../theme/tokens';
import { T, PostIt, PT, Chip, Field, Row, Stamp, NotebookBg, Button } from '../ui/Paper';
import Icon from '../ui/Icon';
import { AvatarPin } from '../ui/Avatar';
import { Maps } from '../lib/native';
import { isOpenNow } from '../lib/hours';
import { metaLine } from '../lib/time';
import { currentPosition, lastSeenLabel } from '../lib/location';
import { BOTTOM_SPACE } from '../ui/Page';
import {
  BUILDINGS, CAMPUS_CATS, catLabel, BUS_STOPS, distanceM, walkMinutes, liveHomeGame,
} from '../data/campus';
import { SCHOOLS } from '../config';
import { placeById } from '../data/places';
import { RatingSummary } from '../sheets/PlaceExtras';

const COLLAPSED = 250;
const EXPANDED = SCREEN_H * 0.66;

function Tools() {
  const { setSheet } = useApp();
  const game = liveHomeGame();
  const tools = [
    { id: 'open', label: 'Open now', icon: 'clock', color: 'green', s: { type: 'openNow' } },
    { id: 'park', label: 'Parking', icon: 'parking', color: 'blue', s: { type: 'parking' } },
    { id: 'friends', label: 'Friends', icon: 'users', color: 'pink', s: { type: 'friends', tab: 'sharing' } },
    { id: 'safety', label: 'Safety', icon: 'shield', color: 'orange', s: { type: 'safety' } },
  ];
  return (
    <View>
      {game ? (
        <PostIt color="orange" tilt={-0.8} onPress={() => setSheet({ type: 'gameday', kickoff: game.kickoff })} style={{ marginBottom: 12 }} padding={10}>
          <PT kind="bold">🏟️ Game day vs. {game.opponent}: share your spot with friends</PT>
        </PostIt>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {tools.map((x) => (
          <Pressable key={x.id} onPress={() => setSheet(x.s)} style={{ marginRight: 10 }} accessibilityLabel={x.label}>
            <PostIt color={x.color} seed={x.id} padding={9} fold={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name={x.icon} size={18} color="#1F2A44" />
                <PT kind="bold" style={{ marginLeft: 6, fontSize: 13 }}>{x.label}</PT>
              </View>
            </PostIt>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* Tapping a building on the map shows this little card first, with a
   quick Rate button — a full sheet only when you ask for details. */
function SelectedCard({ b, onClose }) {
  const { setSheet } = useApp();
  const place = placeById(b.id);
  return (
    <PostIt color="yellow" tilt={-0.6} padding={12} fold={false} style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <PT kind="bold" numberOfLines={2}>{b.name}</PT>
          {place ? <RatingSummary placeId={b.id} compact /> : <PT kind="small">{catLabel(b.kind)}</PT>}
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><Icon name="close" size={18} color="#1F2A44" /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {place ? <Button title="Rate" icon="star" small onPress={() => setSheet({ type: 'rate', placeId: b.id })} style={{ marginRight: 6 }} /> : null}
        <Button title="Details" small kind="ghost" onPress={() => setSheet({ type: 'building', id: b.id })} style={{ backgroundColor: '#fff' }} />
      </View>
    </PostIt>
  );
}

export default function Campus() {
  const { t } = useTheme();
  const { setSheet, sheet, schoolId, friendLocations = [] } = useApp();
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [pos, setPos] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);
  const h = useRef(new Animated.Value(COLLAPSED)).current;
  const mapRef = useRef(null);
  const center = (SCHOOLS.find((s) => s.id === schoolId) || SCHOOLS[0]).center;

  useEffect(() => { currentPosition().then(setPos).catch(() => {}); }, []);
  useEffect(() => { Animated.spring(h, { toValue: expanded ? EXPANDED : COLLAPSED, useNativeDriver: false, friction: 9 }).start(); }, [expanded]);

  /* When a building sheet opens from elsewhere, center the map on it. */
  useEffect(() => {
    if (sheet?.type === 'building' && mapRef.current) {
      const b = BUILDINGS.find((x) => x.id === sheet.id);
      if (b) mapRef.current.animateToRegion({ latitude: b.lat - 0.002, longitude: b.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 400);
    }
  }, [sheet]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let l = cat === 'All' ? BUILDINGS : cat === 'Open now' ? BUILDINGS.filter((b) => isOpenNow(b.hours) === true) : BUILDINGS.filter((b) => b.kind === cat);
    if (s) l = l.filter((b) => b.name.toLowerCase().includes(s));
    return l.map((b) => ({ ...b, mins: pos ? walkMinutes(distanceM(pos, b)) : b.walk })).sort((a, b) => (a.mins ?? 99) - (b.mins ?? 99));
  }, [cat, q, pos]);

  const MapView = Maps?.default; const Marker = Maps?.Marker;
  const visibleFriends = friendLocations.filter((f) => f.lat != null);

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      {MapView ? (
        <MapView ref={mapRef} style={{ flex: 1 }} customMapStyle={t.mapStyle} showsUserLocation showsPointsOfInterest={false}
          initialRegion={{ latitude: center.latitude - 0.004, longitude: center.longitude, latitudeDelta: 0.022, longitudeDelta: 0.022 }}>
          {list.slice(0, 120).map((b) => (
            <Marker key={b.id} coordinate={{ latitude: b.lat, longitude: b.lng }} onPress={() => setSelected(b)} tracksViewChanges={false}>
              <View style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 27, height: 27, borderRadius: 13.5, backgroundColor: isOpenNow(b.hours) === true ? t.postit.green : t.postit.yellow, borderWidth: 2.5, borderColor: '#1F2A44' }} />
              </View>
            </Marker>
          ))}
          {BUS_STOPS.filter((s) => s.lat).map((s) => (
            <Marker key={s.id} coordinate={{ latitude: s.lat + 0.0002, longitude: s.lng + 0.0002 }} title={`Citibus: ${s.name}`} description={`${s.route} route`} tracksViewChanges={false}>
              <View style={{ backgroundColor: t.postit.blue, borderRadius: 6, borderWidth: 2, borderColor: '#1F2A44', padding: 2 }}><Icon name="bus" size={14} color="#1F2A44" /></View>
            </Marker>
          ))}
          {visibleFriends.map((f) => (
            <Marker key={f.uid} coordinate={{ latitude: f.lat, longitude: f.lng }} anchor={{ x: 0.5, y: 1 }} title={f.name} description={`${f.precise ? 'Precise' : 'Approximate'} · ${lastSeenLabel(f.updatedAt)}`}>
              <AvatarPin config={f.avatar} name={(f.name || '').split(' ')[0]} stale={f.updatedAt && Date.now() - (f.updatedAt.toMillis ? f.updatedAt.toMillis() : 0) > 20 * 60000} />
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={{ flex: 1 }}>
          <NotebookBg />
          <SafeAreaView style={{ padding: PAD, paddingTop: 170 }}>
            <PostIt color="yellow" tilt={-1}><PT kind="bold">The map needs a full build of the app.</PT><PT kind="small">Everything below still works.</PT></PostIt>
          </SafeAreaView>
        </View>
      )}

      {/* header chip row over the map */}
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <View style={{ paddingTop: Platform.OS === 'android' ? 36 : 6, paddingHorizontal: PAD }} pointerEvents="box-none">
          <PostIt color="yellow" tilt={-1.5} padding={8} fold={false} style={{ alignSelf: 'flex-start' }}>
            <T kind="marker" color="#1F2A44" style={{ fontSize: 22, lineHeight: 26 }}>Campus</T>
          </PostIt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {['All', 'Open now', ...CAMPUS_CATS.filter((c) => c !== 'All')].map((c) => <Chip key={c} label={catLabel(c)} active={cat === c} onPress={() => setCat(c)} />)}
          </ScrollView>
          {visibleFriends.length ? <T kind="hand" style={{ marginTop: 2 }}>{visibleFriends.length} {visibleFriends.length === 1 ? 'friend' : 'friends'} sharing with you</T> : null}
          {selected ? <SelectedCard b={selected} onClose={() => setSelected(null)} /> : null}
        </View>
      </SafeAreaView>

      {/* drawer */}
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Animated.add(h, BOTTOM_SPACE - 40), backgroundColor: t.paper, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: 2, borderColor: t.mode === 'dark' ? t.borderStrong : '#1F2A44', paddingHorizontal: PAD, paddingTop: 8 }}>
        <Pressable onPress={() => setExpanded(!expanded)} style={{ alignItems: 'center', paddingBottom: 8 }} accessibilityLabel={expanded ? 'Collapse list' : 'Expand list'}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: t.borderStrong }} />
        </Pressable>
        <Tools />
        <Field placeholder="Find a building…" value={q} onChangeText={(v) => { setQ(v); if (v) setExpanded(true); }} style={{ marginTop: 12, marginBottom: 6 }} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: BOTTOM_SPACE }} keyboardShouldPersistTaps="handled">
          <T kind="small">{list.length} places{pos ? ' · walk times from you' : ''}</T>
          {list.slice(0, expanded ? 80 : 12).map((b, i) => {
            const open = isOpenNow(b.hours);
            return (
              <Row key={b.id} title={b.name} meta={metaLine(catLabel(b.kind), b.mins ? `${b.mins} min walk` : null)}
                right={open == null ? null : <Stamp label={open ? 'Open' : 'Closed'} color={open ? t.ok : t.pencil} />}
                onPress={() => setSheet({ type: 'building', id: b.id })} />
            );
          })}
          {!expanded && list.length > 12 ? <Button title="Show more" kind="ghost" small onPress={() => setExpanded(true)} style={{ marginTop: 8 }} /> : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
