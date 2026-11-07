/**
 * Campus — the map, with a paper drawer of tools and places.
 * Pins: buildings (filtered), Citibus stops, and friends who are
 * sharing with you (shown as their avatars).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, Animated, SafeAreaView, Platform, Image } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/ThemeContext';
import { SCREEN_H, PAD } from '../theme/tokens';
import { T, PostIt, PT, Chip, Field, Row, Stamp, NotebookBg, Button } from '../ui/Paper';
import Icon from '../ui/Icon';
import { AvatarPin } from '../ui/Avatar';
import { Maps } from '../lib/native';
import { isOpenNow } from '../lib/hours';
import { openDirections } from '../lib/links';
import { metaLine } from '../lib/time';
import { currentPosition, lastSeenLabel } from '../lib/location';
import { BOTTOM_SPACE } from '../ui/Page';
import {
  BUILDINGS, CAMPUS_CATS, catLabel, BUS_STOPS, distanceM, walkMinutes, liveHomeGame,
} from '../data/campus';
import { SCHOOLS } from '../config';
import { api, listenPublic, listenRecentStatus } from '../lib/firebase';
import { STATUS, freshStatus } from '../sheets/Status';
import { StoryViewer } from '../sheets/Story';
import { useCallable } from '../lib/hooks';
import CampusHub, { ModeSwitch } from './CampusHub';

const COLLAPSED = 250;
const EXPANDED = SCREEN_H * 0.66;

function Tools() {
  const { setSheet } = useApp();
  const game = liveHomeGame();
  const tools = [
    { id: 'open', label: 'Open now', icon: 'clock', color: 'green', s: { type: 'openNow' } },
    { id: 'park', label: 'Parking', icon: 'parking', color: 'blue', s: { type: 'parking' } },
    { id: 'rooms', label: 'Find a room', icon: 'door', color: 'lavender', s: { type: 'rooms' } },
    { id: 'postcard', label: 'Pin a Postcard', icon: 'camera', color: 'yellow', s: { type: 'compose', kind: 'postcard' } },
    { id: 'friends', label: 'Friends', icon: 'users', color: 'pink', s: { type: 'friends', tab: 'sharing' } },
    { id: 'walk', label: 'Safe Walk', icon: 'shield', color: 'orange', s: { type: 'safewalk' } },
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

/* Campus tab: the map, or the Hub (jobs, money, forms, health, tools,
   deals). The Map | Hub switch sits at the top of both. */
export default function Campus() {
  const { campusMode, flags } = useApp();
  if (Platform.OS === 'web' || (flags.hub && campusMode === 'hub')) return <CampusHub />;
  return <CampusMap />;
}

/* A tiny polaroid pin for a Postcard. Tracks view changes only until
   the photo loads, so the map stays smooth. */
function PostcardPin({ p, onPress }) {
  const [ready, setReady] = useState(false);
  const Marker = Maps?.Marker;
  return (
    <Marker coordinate={{ latitude: p.place.lat, longitude: p.place.lng }} onPress={onPress} tracksViewChanges={!ready} anchor={{ x: 0.5, y: 1 }}>
      <View style={{ backgroundColor: '#fff', padding: 2, paddingBottom: 6, borderWidth: 1, borderColor: '#1F2A44', transform: [{ rotate: `${((p.id || '').charCodeAt(0) % 2 ? 6 : -6)}deg` }] }}>
        <Image source={{ uri: p.photoUrl }} style={{ width: 34, height: 34, backgroundColor: '#eee' }} onLoad={() => setReady(true)} onError={() => setReady(true)} />
      </View>
    </Marker>
  );
}

const LAYERS = [['postcards', 'Postcards', 'image'], ['events', 'Events', 'ticket'], ['deals', 'Student deals', 'tag'], ['explore', 'Explore Lubbock', 'discover'], ['status', 'Status', 'elevator']];
const EXPLORE_PURPLE = '#B79CF0';

function CampusMap() {
  const { t } = useTheme();
  const { setSheet, sheet, schoolId, friendLocations = [], flags, postcards = [], myPosts = [], user, isHidden } = useApp();
  const [layers, setLayers] = useState({ postcards: true, events: true, deals: true, explore: true, status: true });
  const deals = useCallable(api.getDeals, {}, 'deals', { enabled: !!flags.deals && layers.deals });
  const dealPins = layers.deals ? (deals.data || []).filter((d) => d.lat != null && d.lng != null) : [];
  const explore = useCallable(api.getExplore, {}, 'places', { enabled: layers.explore });
  const explorePins = layers.explore ? (explore.data || []).filter((p) => p.lat != null && p.lng != null) : [];
  const [spot, setSpot] = useState(null);
  const [events, setEvents] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [viewing, setViewing] = useState(null);
  useEffect(() => (layers.events ? listenPublic('event', setEvents, 60) : undefined), [layers.events]);
  useEffect(() => (layers.status && user ? listenRecentStatus(setStatuses) : undefined), [layers.status, user?.uid]);
  const eventPins = layers.events ? events.filter((e) => e.place && e.place.lat != null && !isHidden('publicPost', e.id) && (!e.when || Date.parse(e.when) > Date.now() - 2 * 3600000) && (!e.when || Date.parse(e.when) < Date.now() + 3 * 86400000)) : [];
  const mine = myPosts.filter((p) => p.kind === 'postcard' && p.place && p.place.lat != null && p.photoUrl).map((p) => ({ ...p, id: p.id, name: 'You' }));
  const cardPins = layers.postcards ? [...postcards.filter((p) => p.place && p.place.lat != null && p.photoUrl), ...mine].slice(0, 60) : [];
  const statusPins = layers.status ? statuses.map((s) => {
    const b = BUILDINGS.find((x) => x.id === s.id);
    if (!b) return null;
    const bad = Object.keys(STATUS).map((k) => { const v = freshStatus(s, k); const cfg = v && STATUS[k].values.find((x) => x[0] === v.value); return cfg && cfg[2] === 'pink' ? `${STATUS[k].name}: ${cfg[1]}` : null; }).filter(Boolean);
    const good = Object.keys(STATUS).some((k) => freshStatus(s, k));
    return good ? { b, bad } : null;
  }).filter(Boolean) : [];
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [pos, setPos] = useState(null);
  const [expanded, setExpanded] = useState(false);
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
            <Marker key={b.id} coordinate={{ latitude: b.lat, longitude: b.lng }} onPress={() => setSheet({ type: 'building', id: b.id })} tracksViewChanges={false}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: isOpenNow(b.hours) === true ? t.postit.green : t.postit.yellow, borderWidth: 2, borderColor: '#1F2A44' }} />
            </Marker>
          ))}
          {BUS_STOPS.filter((s) => s.lat).map((s) => (
            <Marker key={s.id} coordinate={{ latitude: s.lat + 0.0002, longitude: s.lng + 0.0002 }} onPress={() => setSheet({ type: 'bus', id: s.id })} tracksViewChanges={false}>
              <View style={{ backgroundColor: t.postit.blue, borderRadius: 6, borderWidth: 2, borderColor: '#1F2A44', padding: 2 }}><Icon name="bus" size={14} color="#1F2A44" /></View>
            </Marker>
          ))}
          {dealPins.map((d) => (
            <Marker key={`deal-${d.id}`} coordinate={{ latitude: d.lat, longitude: d.lng }} title={d.name} description={d.offer} onCalloutPress={() => setSheet({ type: 'deals' })} tracksViewChanges={false}>
              <View style={{ backgroundColor: '#F7A35C', borderRadius: 6, borderWidth: 2, borderColor: '#1F2A44', padding: 2, transform: [{ rotate: '-6deg' }] }}><Icon name="tag" size={14} color="#1F2A44" /></View>
            </Marker>
          ))}
          {explorePins.map((p) => (
            <Marker key={`ex-${p.id}`} coordinate={{ latitude: p.lat, longitude: p.lng }} onPress={() => setSpot(p)} tracksViewChanges={false}>
              <View style={{ backgroundColor: EXPLORE_PURPLE, borderRadius: 8, borderWidth: 2, borderColor: '#1F2A44', padding: 2, transform: [{ rotate: '-4deg' }] }}><Icon name="discover" size={14} color="#1F2A44" /></View>
            </Marker>
          ))}
          {eventPins.map((e) => (
            <Marker key={`ev-${e.id}`} coordinate={{ latitude: e.place.lat, longitude: e.place.lng }} title={e.title} description={e.when ? new Date(e.when).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : ''} onCalloutPress={() => setSheet({ type: 'publicPost', id: e.id })} tracksViewChanges={false}>
              <View style={{ backgroundColor: t.postit.pink, borderRadius: 6, borderWidth: 2, borderColor: '#1F2A44', padding: 2, transform: [{ rotate: '5deg' }] }}><Icon name="ticket" size={14} color="#1F2A44" /></View>
            </Marker>
          ))}
          {statusPins.map(({ b, bad }) => (
            <Marker key={`st-${b.id}`} coordinate={{ latitude: b.lat + 0.00025, longitude: b.lng - 0.00025 }} title={b.name} description={bad.length ? bad.join(' · ') : 'Recent status from students'} onCalloutPress={() => setSheet({ type: 'building', id: b.id })} tracksViewChanges={false}>
              <View style={{ backgroundColor: bad.length ? '#F28B82' : t.postit.green, borderRadius: 9, borderWidth: 2, borderColor: '#1F2A44', width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}><T kind="bold" style={{ fontSize: 10 }} color="#1F2A44">{bad.length ? '!' : '✓'}</T></View>
            </Marker>
          ))}
          {cardPins.map((p) => <PostcardPin key={`pc-${p.postId || p.id}`} p={p} onPress={() => setViewing({ uid: p.uid === user?.uid ? null : p.uid, name: p.name, avatar: p.avatar, posts: [p] })} />)}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} pointerEvents="box-none">
            <PostIt color="yellow" tilt={-1.5} padding={8} fold={false} style={{ alignSelf: 'flex-start' }}>
              <T kind="marker" color="#1F2A44" style={{ fontSize: 22, lineHeight: 26 }}>Campus</T>
            </PostIt>
            {flags.hub ? <ModeSwitch /> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {['All', 'Open now', ...CAMPUS_CATS.filter((c) => c !== 'All')].map((c) => <Chip key={c} label={catLabel(c)} active={cat === c} onPress={() => setCat(c)} />)}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
            {LAYERS.map(([id, label, icon]) => <Chip key={id} label={label} icon={icon} color="blue" active={layers[id]} onPress={() => setLayers((l) => ({ ...l, [id]: !l[id] }))} />)}
          </ScrollView>
          {visibleFriends.length ? <T kind="hand" style={{ marginTop: 2 }}>{visibleFriends.length} {visibleFriends.length === 1 ? 'friend' : 'friends'} sharing with you</T> : null}
        </View>
      </SafeAreaView>

      {viewing ? <StoryViewer person={viewing} posts={viewing.posts} onClose={() => setViewing(null)} /> : null}
      {spot ? (
        <View style={{ position: 'absolute', left: PAD, right: PAD, top: 190 }} pointerEvents="box-none">
          <PostIt color="lavender" tape tilt={-1}>
            <PT kind="tiny">Explore Lubbock · {spot.kind}</PT>
            <PT kind="bold" style={{ marginTop: 2 }}>{spot.name}</PT>
            <PT kind="small" style={{ marginTop: 2 }}>{spot.why}</PT>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Button title="Directions" icon="walk" small onPress={() => openDirections(spot)} style={{ marginRight: 8 }} />
              <Button title="Close" small kind="ghost" onPress={() => setSpot(null)} />
            </View>
          </PostIt>
        </View>
      ) : null}

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
