/**
 * Home — the front page of your notebook. Calm, personal, short:
 * weather, what's next, what's due, and a few headlines.
 */
import React, { useState } from 'react';
import { View, Image, Pressable } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/ThemeContext';
import { Page } from '../ui/Page';
import {
  T, PostIt, PT, Card, Section, Button, Check, Stamp, Loading, Highlight, 
} from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import {
  useWeather, weatherIcon, forecastAt, weatherNote, useCallable, useNow,
} from '../lib/hooks';
import { api } from '../lib/firebase';
import {
  itemsOnDay, todayCode, toMinutes, sortByTime, greeting, dueLabel, daysUntil, metaLine, dateAt,
} from '../lib/time';
import { buildingById, walkLabel, nextGame, gameDateLabel, floorPlanFor } from '../data/campus';
import { openDirections, openUrl } from '../lib/links';
import { BannerAd } from '../lib/monetize';
import { TERM } from '../config';

function WeatherNote({ w, nextClass }) {
  if (w.loading) return <PostIt color="blue" seed="wx"><Loading label="Checking the sky…" /></PostIt>;
  if (w.error) return <PostIt color="blue" seed="wx"><PT kind="small">Weather is unavailable right now.</PT></PostIt>;
  let note = null;
  if (nextClass) {
    const start = dateAt(new Date(), toMinutes(nextClass.time));
    note = weatherNote(forecastAt(w.hourly, start));
  }
  return (
    <PostIt color="blue" seed="wx" tape>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name={weatherIcon(w.code, w.isDay)} size={44} color="#1F2A44" />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <PT kind="title" style={{ fontSize: 28, lineHeight: 32 }}>{w.temp}°</PT>
          <PT kind="small">{w.condition} · H {w.hi}° L {w.lo}°</PT>
        </View>
      </View>
      {note ? <PT kind="bold" style={{ marginTop: 8 }}>For {nextClass.title}: {note}</PT> : null}
    </PostIt>
  );
}

function UpNext({ next, now }) {
  const { t } = useTheme();
  const { setTab } = useApp();
  if (!next) {
    return (
      <Card onPress={() => setTab('schedule')}>
        <T kind="hand">nothing else on the schedule today</T>
        <T kind="small" style={{ marginTop: 2 }}>Tap to see your week or add a class.</T>
      </Card>
    );
  }
  const b = buildingById(next.buildingId);
  const startM = toMinutes(next.time); const nowM = now.getHours() * 60 + now.getMinutes();
  const inMin = startM - nowM;
  const happening = inMin <= 0;
  const plan = floorPlanFor(b);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T kind="tiny">{happening ? 'Happening now' : 'Up next'}</T>
          <T kind="title" style={{ fontSize: 22, lineHeight: 27, marginTop: 2 }}>{next.title}</T>
          <T kind="small">{metaLine(`${next.time}–${next.endTime}`, next.place)}</T>
        </View>
        {!happening ? (
          <Highlight><T kind="handBig" style={{ fontSize: 26 }}>{inMin >= 60 ? `${Math.floor(inMin / 60)}h ${inMin % 60}m` : `${inMin} min`}</T></Highlight>
        ) : <Stamp label="In class" color={t.ok} />}
      </View>
      {b ? (
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <Button title={walkLabel(b) || 'Directions'} icon="walk" small onPress={() => openDirections(b)} style={{ marginRight: 8 }} />
          {plan ? <Button title="Floor plan" icon="layers" small kind="ghost" onPress={() => openUrl(plan.url)} /> : null}
        </View>
      ) : null}
      {!happening && b && b.walk && inMin <= b.walk + 5 && inMin > 0 ? <T kind="small" color={t.redPen} style={{ marginTop: 8 }}>Leave now — it's about a {b.walk}-minute walk.</T> : null}
    </Card>
  );
}

function DueSoon() {
  const { t } = useTheme();
  const { assignments, updateAssignment, setTab, set } = useApp();
  const list = assignments.filter((a) => !a.done && a.due).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 3);
  return (
    <>
      <Section title="Due soon" icon="clipboard" action="planner" onAction={() => { set({}); setTab('schedule'); }} />
      {list.length ? (
        <PostIt color="yellow" seed="due">
          {list.map((a) => {
            const late = new Date(a.due) < new Date();
            return (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                <Check checked={a.done} onPress={() => updateAssignment(a.id, { done: !a.done })} label={a.title} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <PT kind="bold" numberOfLines={1}>{a.title}</PT>
                  <T kind="small" color={late ? t.redPen : '#4B5571'}>{metaLine(a.course, dueLabel(a.due))}</T>
                </View>
              </View>
            );
          })}
        </PostIt>
      ) : (
        <Card onPress={() => setTab('schedule')}><T kind="hand">all caught up ✓</T><T kind="small">Add assignments in the Planner to get reminders.</T></Card>
      )}
    </>
  );
}

function QuickTools() {
  const { setSheet } = useApp();
  const tools = [
    { id: 'open', label: 'Open now', icon: 'clock', color: 'green', sheet: { type: 'openNow' } },
    { id: 'park', label: 'Parking', icon: 'parking', color: 'blue', sheet: { type: 'parking' } },
    { id: 'friends', label: 'Friends', icon: 'users', color: 'pink', sheet: { type: 'friends' } },
    { id: 'safety', label: 'Safety', icon: 'shield', color: 'orange', sheet: { type: 'safety' } },
  ];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
      {tools.map((x) => (
        <View key={x.id} style={{ width: '23%' }}>
          <PostIt color={x.color} seed={x.id} padding={10} fold={false} onPress={() => setSheet(x.sheet)} accessibilityLabel={x.label}>
            <View style={{ alignItems: 'center' }}>
              <Icon name={x.icon} color="#1F2A44" />
              <PT kind="small" style={{ fontSize: 11.5, marginTop: 4, fontWeight: '700' }}>{x.label}</PT>
            </View>
          </PostIt>
        </View>
      ))}
    </View>
  );
}

function Headlines() {
  const { t } = useTheme();
  const news = useCallable(api.getNews, {}, 'news');
  const [shown, setShown] = useState(4);
  return (
    <>
      <Section title="In the loop" icon="megaphone" hand="Live headlines from campus & Lubbock outlets" />
      {news.loading ? <Loading label="Grabbing today's headlines…" /> : null}
      {news.error ? <T kind="small">Headlines couldn't load right now.</T> : null}
      {(news.data || []).slice(0, shown).map((n, i) => (
        <Card key={`${n.headline}-${i}`} onPress={() => openUrl(n.url)} style={{ marginBottom: 12 }} header={false} padding={0}>
          {i === 0 && n.art ? <Image source={{ uri: n.art }} style={{ width: '100%', height: 160, backgroundColor: t.paperDeep }} resizeMode="cover" /> : null}
          <View style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <T kind="tiny" style={{ flex: 1 }}>{metaLine(n.source, n.date)}</T>
              {n.official ? <Stamp label="Student paper" color={t.accent} /> : null}
            </View>
            <T kind="title" style={{ fontSize: 17, lineHeight: 22 }}>{n.headline}</T>
            {n.excerpt ? <T kind="small" style={{ marginTop: 4 }}>{n.excerpt}</T> : null}
          </View>
        </Card>
      ))}
      {(news.data || []).length > shown ? <Button title="More headlines" kind="ghost" small onPress={() => setShown(shown + 4)} /> : null}
    </>
  );
}

export default function Home() {
  const app = useApp();
  const { userName, avatar, scheduleItems, setTab, schoolId, isPlus, setSheet } = app;
  const w = useWeather(schoolId);
  const now = useNow(30000);
  const alerts = useCallable(api.getCampusAlerts, {}, 'alerts');
  const nowM = now.getHours() * 60 + now.getMinutes();
  const today = sortByTime(itemsOnDay(scheduleItems, todayCode(now)));
  const next = today.find((c) => (toMinutes(c.endTime) ?? toMinutes(c.time)) > nowM) || null;
  const g = nextGame(now);
  const gameSoon = g && (new Date(g.kickoff) - now) < 6 * 86400000;
  const finalsIn = daysUntil(TERM.finalsStart, now);
  const first = (userName || '').split(' ')[0];

  return (
    <Page
      eyebrow={now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      title={`${greeting(now)}${first ? `, ${first}` : ''}`}
      right={<Pressable onPress={() => setTab('you')} accessibilityLabel="Your profile"><Avatar config={avatar} size={46} /></Pressable>}>
      <View style={{ marginTop: 14 }}><WeatherNote w={w} nextClass={next} /></View>

      {(alerts.data || []).map((a, i) => (
        <PostIt key={i} color="pink" seed={`al${i}`} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="alert" size={18} color="#C8413B" /><PT kind="bold" style={{ marginLeft: 6, flex: 1 }}>{a.title}</PT></View>
          <PT kind="small" style={{ marginTop: 4 }}>{metaLine(a.body, a.source, a.date)}</PT>
        </PostIt>
      ))}

      <QuickTools />

      <Section title={today.length ? `Today · ${today.length} ${today.length === 1 ? 'class' : 'classes'}` : 'Today'} icon="schedule" action="week" onAction={() => setTab('schedule')} />
      <UpNext next={next} now={now} />

      <DueSoon />

      {finalsIn > 0 && finalsIn <= 45 ? (
        <PostIt color="lavender" seed="finals" style={{ marginTop: 18 }} onPress={() => { setTab('schedule'); }}>
          <PT kind="tiny">{TERM.label} finals</PT>
          <PT kind="title" style={{ marginTop: 2 }}>{finalsIn} days until finals start</PT>
          <PT kind="small">Tap to look up your exam times.</PT>
        </PostIt>
      ) : null}

      {gameSoon ? (
        <>
          <Section title="Game day" icon="football" />
          <PostIt color="orange" seed={g.kickoff} tape onPress={() => setSheet({ type: 'gameday', kickoff: g.kickoff })}>
            <PT kind="tiny">{g.homeAway === 'home' ? 'Home' : 'Away'} · {g.venue}</PT>
            <PT kind="title" style={{ fontSize: 21, marginTop: 2 }}>Texas Tech {g.homeAway === 'home' ? 'vs.' : 'at'} {g.opponent}</PT>
            <PT kind="small">{gameDateLabel(g.kickoff, now)}</PT>
            {g.homeAway === 'home' ? <PT kind="bold" style={{ marginTop: 8 }}>Going? Share your spot with friends for the game →</PT> : null}
          </PostIt>
        </>
      ) : null}

      <BannerAd isPlus={isPlus} />
      <Headlines />
    </Page>
  );
}
