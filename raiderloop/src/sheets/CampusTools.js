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
  BUILDINGS, DINING, STUDY, distanceM, walkMinutes, COMMUTER_LOTS, PARKING_LINKS, catLabel,
} from '../data/campus';
import { SAFETY } from '../config';

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
  return (
    <Sheet title="Commuter parking" hand="From TTU Transportation & Parking Services' own posted updates" onClose={onClose}>
      {live.loading ? <Loading label="Checking today's lot updates…" /> : null}
      {!live.loading && live.data?.postedAt ? <T kind="hand" color={t.accent} style={{ marginBottom: 8 }}>Last update posted {live.data.postedAt}</T> : null}
      {!live.loading && !lots.length ? (
        <PostIt color="yellow" seed="park-none" tape style={{ marginBottom: 12 }}>
          <PT kind="bold">No lot update posted yet today.</PT>
          <PT kind="small" style={{ marginTop: 4 }}>Parking Services usually posts a few times on weekdays during the semester. Flyer only shows today's real numbers, never old ones.</PT>
        </PostIt>
      ) : null}
      {(lots.length ? COMMUTER_LOTS : []).map((lot) => {
        const l = byLot[lot];
        return (
          <View key={lot} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <View style={{ width: 54 }}><T kind="title">{lot}</T></View>
            {l ? <Meter pct={l.percentFull} /> : <T kind="small" style={{ flex: 1 }}>not in today's update</T>}
            <T kind="num" style={{ width: 54, textAlign: 'right' }}>{l ? `${l.percentFull}%` : 'N/A'}</T>
          </View>
        );
      })}
      <View style={{ marginTop: 14 }}>
        <Row title="Commuter permits & lots" meta="Official TTU page" left={<Icon name="parking" color={t.ink} />} onPress={() => openUrl(PARKING_LINKS.commuter)} />
        <Row title="Campus parking maps" left={<Icon name="map" color={t.ink} />} onPress={() => openUrl(PARKING_LINKS.map)} />
        <Row title="Live posts from Parking Services" left={<Icon name="megaphone" color={t.ink} />} onPress={() => openUrl(PARKING_LINKS.updates)} last />
      </View>
    </Sheet>
  );
}

/* ---------- Safety ---------- */
export function SafetySheet({ onClose }) {
  const { t } = useTheme();
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
      <Pressable onPress={() => openUrl(SAFETY.campusPolice.source)} style={{ marginTop: 14 }}><T kind="small" color={t.accent}>Source: depts.ttu.edu/ttpd/contact.php</T></Pressable>
    </Sheet>
  );
}
