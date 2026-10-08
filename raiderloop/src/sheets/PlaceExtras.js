/**
 * Automatic check-in and rating pieces used by the map, building
 * sheets, events, meetups and the Flight passport.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Pressable, AppState, Alert, Linking } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Row, Toggle } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, errText, listenPlaceRating } from '../lib/firebase';
import { backgroundAvailable, hasAlways, requestAlways } from '../lib/backgroundLocation';
import { FLIGHT, placeById, tierLabel, tierPoints, classBuildingIds } from '../data/places';

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
    return <T kind="small">{v && v.n ? `${v.n} ${v.n === 1 ? 'person has' : 'people have'} rated it. Averages show at 5.` : 'Nobody has rated it yet. Get stamped here to be the first.'}</T>;
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
      <T kind="small" style={{ marginTop: 4 }}>{v.n} ratings from people who've been here.</T>
    </View>
  );
}

/* ---------- Automatic check-ins ----------
   Flight score works only with automatic check-ins, which need
   location set to "Always". This hook says whether they're running
   and turns them on or off. */
export const DWELL_MIN = FLIGHT.autoDwellMin || 5;

export function useAutoCheckIn() {
  const { flightAuto, set, showToast, user, setSheet } = useApp();
  const [always, setAlways] = useState(null);
  const refresh = useCallback(() => { hasAlways().then(setAlways).catch(() => setAlways(false)); }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);
  const enable = async () => {
    if (!user || user.isAnonymous) { setSheet({ type: 'account' }); return; }
    if (!backgroundAvailable()) { showToast('Automatic check-ins need the full app build.'); return; }
    const r = await requestAlways();
    if (!r.ok) {
      refresh();
      Alert.alert('Location needs to be "Always"', 'Flight score checks you in automatically, so Flyer needs location set to Always. Open Settings, tap Location, and choose Always.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
      ]);
      return;
    }
    set({ flightAuto: true });
    setAlways(true);
    showToast('Automatic check-ins are on');
  };
  const disable = () => { set({ flightAuto: false }); showToast('Automatic check-ins are off'); };
  return { on: !!flightAuto && always === true, paused: !!flightAuto && always === false, checking: always === null, enable, disable };
}

/* The on/off card at the top of the Flight passport. */
export function AutoCheckInCard() {
  const { t } = useTheme();
  const { on, paused, checking, enable, disable } = useAutoCheckIn();
  if (checking) return null;
  if (on) {
    return (
      <PostIt color="green" seed="auto-on" padding={14} style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="radar" color="#1F2A44" size={24} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <PT kind="bold">Automatic check-ins are on</PT>
            <PT kind="small">{`Spend about ${DWELL_MIN} minutes at a campus spot and Flyer stamps it, even with the app closed.`}</PT>
          </View>
          <Toggle value onChange={disable} label="Automatic check-ins" />
        </View>
      </PostIt>
    );
  }
  return (
    <PostIt color="pink" seed="auto-off" padding={14} style={{ marginTop: 14 }}>
      <PT kind="bold">{paused ? 'Check-ins are paused' : 'Turn on automatic check-ins'}</PT>
      <PT kind="small" style={{ marginTop: 4 }}>
        {paused
          ? 'Flyer\'s location isn\'t set to Always anymore, so flight score can\'t count your visits. Set it back to Always to keep earning.'
          : `Flight score needs location set to Always. Spend about ${DWELL_MIN} minutes at a campus spot and Flyer stamps it for you, even with the app closed. Without it, flight score is off.`}
      </PT>
      <Button title={paused ? 'Fix it' : 'Turn on'} icon="radar" small onPress={enable} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      <T kind="small" color={t.postitInkSoft} style={{ marginTop: 8, fontSize: 11 }}>Your location only leaves your phone when you've stayed at one of the places on the list. Turn it off any time here.</T>
    </PostIt>
  );
}

/* One line for a place, event or meetup: how it gets stamped. */
export function AutoCheckInNote({ text, style }) {
  const { t } = useTheme();
  const { on, checking, enable } = useAutoCheckIn();
  if (checking) return null;
  if (on) return <T kind="small" color={t.postitInkSoft} style={style}>{text || `Stay about ${DWELL_MIN} minutes and Flyer stamps it automatically.`}</T>;
  return (
    <View style={style}>
      <T kind="small" color={t.postitInkSoft}>Flight score needs automatic check-ins.</T>
      <Button title="Turn on" icon="radar" small kind="ghost" onPress={enable} style={{ marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#fff' }} />
    </View>
  );
}

export function CheckInCard({ placeId }) {
  const { t } = useTheme();
  const { flight, scheduleItems, setSheet } = useApp();
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
          {isClass ? <PT kind="small">No points, but a stamp lets you rate it.</PT> : null}
        </View>
      </View>
      <AutoCheckInNote style={{ marginTop: 6 }} />
      <Button title="Rate" icon="star" small kind="ghost" onPress={() => setSheet({ type: 'rate', placeId })} style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#fff' }} />
      {!stamp ? <T kind="small" color={t.postitInkSoft} style={{ marginTop: 6, fontSize: 11 }}>Only people who've been stamped here can rate it.</T> : null}
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
        <PostIt color="yellow" tilt={-1}><PT kind="bold">Get stamped here first.</PT><PT kind="small">Only people who've been there can rate it. It keeps ratings honest. With automatic check-ins on, a few minutes here does it.</PT></PostIt>
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
