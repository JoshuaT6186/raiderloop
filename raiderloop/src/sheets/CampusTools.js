/**
 * Campus tools: What's open near me, Commuter parking, Safety.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Row, Card, Chip, Stamp, Loading, Empty } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { useCallable } from '../lib/hooks';
import { openUrl, call } from '../lib/links';
import { isOpenNow, minutesUntilClose, todayHoursText } from '../lib/hours';
import { currentPosition } from '../lib/location';
import { metaLine } from '../lib/time';
import {
  BUILDINGS, DINING, STUDY, distanceM, walkMinutes, COMMUTER_LOTS, PARKING_LINKS, catLabel, BUS_STOPS,
} from '../data/campus';
import { SAFETY, CHECKED } from '../config';
import LastChecked from '../ui/LastChecked';

/* ---------- What's open near me ---------- */
export function OpenNowSheet({ onClose }) {
  const { t } = useTheme();
  const { setSheet } = useApp();
  const [pos, setPos] = useState(null);
  const [filter, setFilter] = useState('All');
  useEffect(() => { currentPosition().then(setPos).catch(() => {}); }, []);

  const items = useMemo(() => {
    const dining = DINING.map((d) => ({ key: d.id, kind: 'Food', name: d.name, sub: d.venue, hours: d.hours, lat: d.lat, lng: d.lng, walk: d.walk, open: () => setSheet({ type: 'dining', id: d.id }) }));
    const places = BUILDINGS.filter((b) => b.hours && b.kind !== 'Dining').map((b) => ({
      key: b.id, kind: b.kind === 'Library' || STUDY.some((s) => s.id === b.id) ? 'Study' : b.kind === 'Retail' ? 'Shops' : 'Places',
      name: b.name, sub: catLabel(b.kind), hours: b.hours, lat: b.lat, lng: b.lng, walk: b.walk, open: () => setSheet({ type: 'building', id: b.id }),
    }));
    return [...dining, ...places]
      .filter((x) => isOpenNow(x.hours) === true)
      .map((x) => {
        const m = pos ? distanceM(pos, x) : null;
        return { ...x, mins: m != null ? walkMinutes(m) : x.walk, closesIn: minutesUntilClose(x.hours) };
      })
      .sort((a, b) => (a.mins ?? 99) - (b.mins ?? 99));
  }, [pos]);

  const kinds = ['All', ...new Set(items.map((i) => i.kind))];
  const list = filter === 'All' ? items : items.filter((i) => i.kind === filter);
  return (
    <Sheet title="Open right now" hand={pos ? 'Sorted by walking time from you' : 'Sorted by walk from the center of campus'} onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {kinds.map((k) => <Chip key={k} label={k} active={filter === k} onPress={() => setFilter(k)} />)}
      </View>
      {list.length ? list.map((x, i) => (
        <Row key={x.key} title={x.name} last={i === list.length - 1}
          meta={metaLine(x.sub, x.mins != null ? `${x.mins} min walk` : null, todayHoursText(x.hours))}
          left={<Icon name={x.kind === 'Food' ? 'food' : x.kind === 'Study' ? 'book' : 'building'} color={t.ink} />}
          right={x.closesIn != null && x.closesIn <= 60 ? <Stamp label={`${x.closesIn}m left`} color={t.warn} /> : null}
          onPress={x.open} />
      )) : <Empty icon="moon" title="Everything with posted hours is closed right now." body="Check back in the morning, or ask Pilot." />}
    </Sheet>
  );
}

/* ---------- Commuter parking ---------- */
function Meter({ pct }) {
  const { t } = useTheme();
  const color = pct >= 95 ? t.redPen : pct >= 80 ? t.warn : t.ok;
  return (
    <View style={{ height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: t.borderStrong, overflow: 'hidden', backgroundColor: t.card, flex: 1 }}>
      <View style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

export function ParkingSheet({ onClose }) {
  const { t } = useTheme();
  const live = useCallable(api.getParking, {}, null, { asArray: false });
  const lots = live.data?.lots || [];
  const byLot = Object.fromEntries(lots.map((l) => [l.lot, l]));
  /* The live numbers come from Parking Services' own posts, which can
     take a while to find. Everything else on this sheet shows right
     away; after 8 seconds the live part stops making you wait. */
  const [slow, setSlow] = useState(false);
  useEffect(() => { const id = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(id); }, []);
  const checking = live.loading && !slow;
  return (
    <Sheet title="Commuter parking" hand="Lots, maps, and Parking Services' live posts" onClose={onClose}>
      <PostIt color={lots.length ? 'green' : 'yellow'} seed="park-live" tape style={{ marginBottom: 12 }}>
        <PT kind="tiny">Live lot fullness</PT>
        {checking ? <PT kind="small" style={{ marginTop: 4 }}>Checking today's update from Parking Services…</PT> : null}
        {!checking && lots.length ? <PT kind="bold" style={{ marginTop: 2 }}>Updated {live.data.postedAt || 'today'}</PT> : null}
        {!checking && !lots.length ? (
          <>
            <PT kind="bold" style={{ marginTop: 2 }}>No live update posted yet today</PT>
            <PT kind="small" style={{ marginTop: 4 }}>Parking Services posts lot fullness on busy weekdays. Flyer only shows today's real numbers, never old ones. Their live feed is linked below.</PT>
          </>
        ) : null}
      </PostIt>
      <T kind="tiny" style={{ marginBottom: 4 }}>Commuter lots</T>
      <Card>
        {COMMUTER_LOTS.map((lot, i) => {
          const l = byLot[lot];
          return (
            <View key={lot} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i === COMMUTER_LOTS.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
              <View style={{ width: 54 }}><T kind="title">{lot}</T></View>
              {l ? <Meter pct={l.percentFull} /> : <T kind="small" style={{ flex: 1 }}>{checking ? 'checking…' : 'no live number right now'}</T>}
              <T kind="num" style={{ width: 54, textAlign: 'right' }}>{l ? `${l.percentFull}%` : ''}</T>
            </View>
          );
        })}
      </Card>
      <View style={{ marginTop: 14 }}>
        <Row title="Live posts from Parking Services" meta="Their own updates, as they post them" left={<Icon name="megaphone" color={t.ink} />} onPress={() => openUrl(PARKING_LINKS.updates)} />
        <Row title="Commuter permits & lots" meta="Official TTU page" left={<Icon name="parking" color={t.ink} />} onPress={() => openUrl(PARKING_LINKS.commuter)} />
        <Row title="Campus parking maps" left={<Icon name="map" color={t.ink} />} onPress={() => openUrl(PARKING_LINKS.map)} last />
      </View>
    </Sheet>
  );
}

/* ---------- Safety ---------- */
export function SafetySheet({ onClose }) {
  const { t } = useTheme();
  const { setSheet } = useApp();
  return (
    <Sheet title="Safety" hand="Numbers verified on Texas Tech Police's contact page" onClose={onClose} height={0.75}>
      <PostIt color="pink" tilt={-1} tape padding={18}>
        <PT kind="tiny">Emergency</PT>
        <PT kind="title" style={{ fontSize: 26, lineHeight: 30, marginTop: 2 }}>Call 911</PT>
        <PT kind="small" style={{ marginTop: 4 }}>For anything happening right now that threatens someone's safety.</PT>
        <Button title="Call 911" icon="phone" kind="danger" onPress={() => call(SAFETY.emergency)} style={{ marginTop: 12, backgroundColor: '#fff' }} />
      </PostIt>
      <Card style={{ marginTop: 18 }}>
        <T kind="bold">{SAFETY.campusPolice.label}</T>
        <T kind="title" style={{ marginTop: 4 }}>{SAFETY.campusPolice.phone}</T>
        <T kind="small" style={{ marginTop: 4 }}>Reports, suspicious activity, a welfare check, or a question for campus police.</T>
        <Button title="Call campus police" icon="phone" kind="ghost" onPress={() => call(SAFETY.campusPolice.phone)} style={{ marginTop: 12 }} small />
      </Card>
      <Card style={{ marginTop: 14 }} onPress={() => { onClose(); setSheet({ type: 'safewalk' }); }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="shield" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <T kind="bold">Safe Walk</T>
            <T kind="small">Pick friends to watch you get home. If you don't check in, they get a ping.</T>
          </View>
          <Icon name="chevronRight" color={t.pencil} />
        </View>
      </Card>
      <Pressable onPress={() => openUrl(SAFETY.campusPolice.source)} style={{ marginTop: 14 }}><T kind="small" color={t.accent}>Source: depts.ttu.edu/ttpd/contact.php</T></Pressable>
      <LastChecked date={CHECKED.safety} source="Texas Tech Police" itemId="safety:ttpd" title="Campus police number" url={SAFETY.campusPolice.source} />
    </Sheet>
  );
}

/* ---------- Citibus stop ----------
   Citibus runs two campus loops: Red Raider (clockwise) and Double T
   (counter-clockwise). Live bus positions come from the GoPass app,
   which TTU Parking recommends. Source: depts.ttu.edu/parking/InformationFor/Busing.php */
const BUS_LINKS = {
  schedule: 'https://citibus.com/maps-and-schedules/#ttu-route-schedule',
  ttu: 'https://www.depts.ttu.edu/parking/InformationFor/Busing.php',
  sga: 'https://www.depts.ttu.edu/sga/CitiBusRoutes.php',
};
export function BusSheet({ id, onClose }) {
  const { t } = useTheme();
  const { setSheet } = useApp();
  const stop = BUS_STOPS.find((s) => s.id === id) || null;
  return (
    <Sheet title={stop ? `Citibus: ${stop.name}` : 'Citibus'} hand="Campus routes run by Citibus" onClose={onClose} height={0.72}>
      <PostIt color="blue" tilt={-1} tape>
        <PT kind="tiny">{stop ? `${stop.route} route stop` : 'Campus routes'}</PT>
        <PT kind="bold" style={{ marginTop: 2 }}>Red Raider loops campus clockwise. Double T loops counter-clockwise.</PT>
        <PT kind="small" style={{ marginTop: 6 }}>For live bus positions, TTU Parking recommends the GoPass app (no account needed).</PT>
      </PostIt>
      <Card style={{ marginTop: 14 }}>
        <Row title="Route maps and schedules" meta="Citibus, TTU routes" left={<Icon name="route" color={t.ink} />} onPress={() => openUrl(BUS_LINKS.schedule)} />
        <Row title="Busing at Texas Tech" meta="How to track buses live, from TTU Parking" left={<Icon name="bus" color={t.ink} />} onPress={() => openUrl(BUS_LINKS.ttu)} />
        <Row title="Apartment shuttle routes" meta="SGA's Citibus page" left={<Icon name="map" color={t.ink} />} onPress={() => openUrl(BUS_LINKS.sga)} last={!stop || !stop.buildingId} />
        {stop && stop.buildingId ? <Row title="What's at this stop" meta={stop.name} left={<Icon name="building" color={t.ink} />} onPress={() => setSheet({ type: 'building', id: stop.buildingId })} last /> : null}
      </Card>
    </Sheet>
  );
}
