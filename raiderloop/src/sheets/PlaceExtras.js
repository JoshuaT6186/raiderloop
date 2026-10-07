/**
 * Check-in and rating pieces used by the map and building sheets.
 */
import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Row } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, errText, listenPlaceRating } from '../lib/firebase';
import { checkInAt } from '../lib/flight';
import { placeById, tierLabel, tierPoints, classBuildingIds } from '../data/places';

const ROWS = {
  study: [['quiet', 'Quiet'], ['seating', 'Seating'], ['outlets', 'Outlets']],
  food: [['taste', 'Food'], ['value', 'Value'], ['wait', 'Short wait']],
};
export const categoryFor = (place) => (place?.tier === 'dining' ? 'food' : 'study');

export function Stars({ value = 0, size = 18, onChange, label }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row' }} accessibilityLabel={label ? `${label}: ${value} of 5` : undefined}>
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= Math.round(value);
        const icon = <Icon name="star" size={size} color={on ? '#1F2A44' : t.faint} fill={on ? '#F2B62A' : 'none'} stroke={1.6} />;
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} style={{ marginRight: 4 }} accessibilityRole="button" accessibilityLabel={`${label || 'Rate'} ${i} stars`}>{icon}</Pressable>
        ) : <View key={i} style={{ marginRight: 2 }}>{icon}</View>;
      })}
    </View>
  );
}

export function usePlaceRating(placeId) {
  const [r, setR] = useState(null);
  useEffect(() => (placeId ? listenPlaceRating(placeId, setR) : undefined), [placeId]);
  return r;
}

export function RatingSummary({ placeId, compact }) {
  const place = placeById(placeId);
  const r = usePlaceRating(place ? placeId : null);
  if (!place) return null;
  const cat = categoryFor(place);
  const v = r && r[cat];
  if (!v || !v.ready) {
    if (compact) return <T kind="small">{v && v.n ? `${v.n} of 5 ratings so far` : 'No ratings yet'}</T>;
    return <T kind="small">{v && v.n ? `${v.n} ${v.n === 1 ? 'person has' : 'people have'} rated it — averages show at 5.` : 'Nobody has rated it yet. Check in to be the first.'}</T>;
  }
  if (compact) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Stars value={v.overall} size={14} /><T kind="small" style={{ marginLeft: 4 }}>{v.overall} · {v.n}</T>
      </View>
    );
  }
  return (
    <View>
      {ROWS[cat].map(([k, label]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 }}>
          <T kind="bold">{label}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Stars value={v[k]} label={label} /><T kind="small" style={{ marginLeft: 6, width: 26 }}>{v[k]}</T></View>
        </View>
      ))}
      <T kind="small" style={{ marginTop: 4 }}>{v.n} ratings from people who checked in.</T>
    </View>
  );
}

export function useCheckIn() {
  const { scheduleItems, showToast, user, setSheet } = useApp();
  const [busy, setBusy] = useState(false);
  const run = async ({ placeId, eventId }) => {
    if (!user || user.isAnonymous) { setSheet({ type: 'account' }); return null; }
    setBusy(true);
    const r = await checkInAt({ placeId, eventId, scheduleItems });
    setBusy(false);
    showToast(r.message);
    return r;
  };
  return { busy, run };
}

export function CheckInCard({ placeId }) {
  const { t } = useTheme();
  const { flight, scheduleItems, setSheet } = useApp();
  const { busy, run } = useCheckIn();
  const place = placeById(placeId);
  if (!place) return null;
  const stamp = (flight.stamps || {})[placeId];
  const isClass = classBuildingIds(scheduleItems).includes(placeId);
  const pts = tierPoints(place.tier);
  return (
    <PostIt color="green" seed={`ci-${placeId}`} style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="passport" color="#1F2A44" size={26} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <PT kind="bold">{stamp ? `Stamped${stamp.visits > 1 ? ` · ${stamp.visits} visits` : ''}` : isClass ? 'Your class building' : `${tierLabel(place.tier)} · +${pts} on your first visit`}</PT>
          <PT kind="small">{isClass ? 'No points — but checking in lets you rate it.' : 'Check in when you\'re here.'}</PT>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <Button title="I'm here" icon="check" small loading={busy} onPress={() => run({ placeId })} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Rate" icon="star" small kind="ghost" onPress={() => setSheet({ type: 'rate', placeId })} style={{ flex: 1, backgroundColor: '#fff' }} />
      </View>
      {!stamp ? <T kind="small" color={t.postitInkSoft} style={{ marginTop: 6, fontSize: 11 }}>Only people who've checked in can rate a place.</T> : null}
    </PostIt>
  );
}

export function RateSheet({ placeId, onClose }) {
  const { t } = useTheme();
  const { flight, showToast } = useApp();
  const place = placeById(placeId);
  const cat = categoryFor(place);
  const mine = (flight.rated || {})[`${placeId}:${cat}`] || {};
  const [scores, setScores] = useState(mine);
  const [busy, setBusy] = useState(false);
  if (!place) return null;
  const stamped = !!(flight.stamps || {})[placeId];
  const done = ROWS[cat].every(([k]) => scores[k] >= 1);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.rateBuilding({ placeId, category: cat, scores });
      showToast(r.data.points ? `Thanks! +${r.data.points} flight score` : 'Rating saved');
      onClose();
    } catch (e) { showToast(errText(e)); }
    setBusy(false);
  };
  return (
    <Sheet title={`Rate ${place.name}`} hand={cat === 'food' ? 'How was the food?' : 'How is it for studying?'} onClose={onClose} height={0.7}
      footer={<Button title={Object.keys(mine).length ? 'Update rating' : 'Save rating'} icon="star" loading={busy} disabled={!done || !stamped} onPress={save} />}>
      {!stamped ? (
        <PostIt color="yellow" tilt={-1}><PT kind="bold">Check in here first.</PT><PT kind="small">Only people who've been there can rate it — it keeps ratings honest.</PT></PostIt>
      ) : null}
      {ROWS[cat].map(([k, label]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: t.rule, borderStyle: 'dashed' }}>
          <T kind="title">{label}</T>
          <Stars value={scores[k] || 0} size={30} label={label} onChange={(v) => setScores((p) => ({ ...p, [k]: v }))} />
        </View>
      ))}
      <T kind="small" style={{ marginTop: 10 }}>Stars only, one rating per place. You can change it any time. Averages appear once 5 people have rated.</T>
      <Row title="Current ratings" meta={null} last />
      <RatingSummary placeId={placeId} />
    </Sheet>
  );
}
