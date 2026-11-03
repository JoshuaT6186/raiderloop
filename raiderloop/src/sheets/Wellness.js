/**
 * Sleep & steps, next to your schedule. Read from Apple Health on the
 * phone only. No calorie counting, no weight, no streaks: just enough
 * to notice "8 AM class tomorrow and 5 hours of sleep last night".
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Toggle, Loading,
} from '../ui/Paper';
import { SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { healthAvailable, connectHealth, readToday, hm } from '../lib/health';
import { ensureNotificationPermission } from '../lib/notifications';
import { bedtimeFor, walkingToday } from '../lib/bedtime';
import { HEALTH } from '../data/hub';
import { openUrl, call } from '../lib/links';

export { bedtimeFor, walkingToday } from '../lib/bedtime';

export function WellnessCard({ compact = false }) {
  const { connections, set, scheduleItems, notif, showToast } = useApp();
  const [data, setData] = useState(null);
  const on = connections.health && healthAvailable();
  useEffect(() => { if (on) readToday().then(setData).catch(() => setData(null)); }, [on]);
  const bed = bedtimeFor(scheduleItems);
  const walk = walkingToday(scheduleItems);
  const connect = async () => {
    if (!healthAvailable()) { showToast("Apple Health isn't available on this device."); return; }
    const ok = await connectHealth();
    set((p) => ({ connections: { ...p.connections, health: ok } }));
    if (ok) readToday().then(setData).catch(() => {});
  };
  if (compact && !on) return null;
  return (
    <View>
      {!on ? (
        <PostIt color="lavender" tape tilt={-0.6}>
          <PT kind="title" style={{ fontSize: 19 }}>Sleep & steps</PT>
          <PT kind="small" style={{ marginTop: 2 }}>See last night's sleep and today's steps next to your schedule. Works with Apple Watch, Fitbit, Oura, Garmin and more through Apple Health. Read on your phone only, never saved or shared.</PT>
          <Button title="Continue" icon="heart" small onPress={connect} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        </PostIt>
      ) : (
        <PostIt color="lavender" tape tilt={-0.6}>
          <PT kind="title" style={{ fontSize: 19 }}>Today</PT>
          {!data ? <Loading label="Reading Apple Health…" /> : (
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <View style={{ flex: 1 }}><PT kind="tiny">Slept</PT><PT kind="title">{hm(data.sleepMinutes)}</PT></View>
              <View style={{ flex: 1 }}><PT kind="tiny">Steps</PT><PT kind="title">{data.steps == null ? '—' : data.steps.toLocaleString()}</PT></View>
              <View style={{ flex: 1 }}><PT kind="tiny">Active</PT><PT kind="title">{data.exercise == null ? '—' : `${data.exercise} min`}</PT></View>
            </View>
          )}
          {data && data.sleepMinutes != null && data.sleepMinutes < 360 && bed ? <PT style={{ marginTop: 8 }}>Short night. Your first class tomorrow is at {bed.startLabel}, so tonight might be a good one to wind down early.</PT> : null}
        </PostIt>
      )}
      {bed && !compact ? (
        <Card style={{ marginTop: 14 }}>
          <T kind="bold">Tomorrow: {bed.cls.title} at {bed.startLabel}</T>
          <T kind="small">For about 8 hours of sleep and time to get ready, aim to be asleep by {bed.asleepLabel}. Most adults do best with 7 or more hours.</T>
          <Row title="Bedtime nudge" meta="A reminder 30 minutes before, on school nights" right={<Toggle value={!!notif.bedtime} onChange={async (v) => { if (v) await ensureNotificationPermission(true); set((p) => ({ notif: { ...p.notif, bedtime: v } })); }} label="Bedtime nudge" />} last />
        </Card>
      ) : null}
      {walk > 0 && !compact ? <T kind="small" style={{ marginTop: 10 }}>Walking between today's classes is about {walk} minutes.</T> : null}
    </View>
  );
}

export function WellnessSheet({ onClose }) {
  const { t } = useTheme();
  return (
    <Sheet title="Wellness" hand="Small things that make the semester easier." onClose={onClose} height={0.92}>
      <WellnessCard />
      <T kind="tiny" style={{ marginTop: 18, marginBottom: 6 }}>On campus</T>
      <Card>
        {HEALTH.care.map((c, i) => <Row key={c.id} title={c.name} meta={c.note} left={<Icon name="heart" color={t.ink} />} onPress={() => (c.url ? openUrl(c.url) : c.phone ? call(c.phone) : null)} last={i === HEALTH.care.length - 1} />)}
      </Card>
      <PostIt color="pink" tilt={0.5} style={{ marginTop: 14 }} onPress={() => call(HEALTH.crisis[0].phone)}>
        <PT kind="bold">{HEALTH.crisis[0].name}: {HEALTH.crisis[0].phone}</PT>
        <PT kind="small">{HEALTH.crisis[0].note} Tap to call.</PT>
      </PostIt>
      <SectionNote icon="lock">Flyer never saves or sends your health data. You can turn off access any time in the Health app → Sharing → Apps → Flyer.</SectionNote>
    </Sheet>
  );
}
