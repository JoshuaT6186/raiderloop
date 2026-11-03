/**
 * Home — the front page of your notebook. Calm, personal, short:
 * friends' moments, weather, today as a timeline (with the free gaps
 * and when to leave), what's due, tonight, one deal, one tip, and a
 * few headlines. Cards that only matter sometimes (first 30 days, a
 * new season's icon, game day, finals) show up only then.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, Pressable } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/ThemeContext';
import { Page } from '../ui/Page';
import {
  T, PostIt, PT, Card, Section, Button, Check, Stamp, Loading, Highlight,
} from '../ui/Paper';
import { Washi, Pushpin } from '../ui/Scrap';
import { FadeIn, Highlighter } from '../ui/Kit';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import {
  useWeather, weatherIcon, forecastAt, weatherNote, useCallable, useNow,
} from '../lib/hooks';
import { api, listenPublic } from '../lib/firebase';
import {
  itemsOnDay, todayCode, toMinutes, sortByTime, greeting, dueLabel, daysUntil, metaLine, dateAt, minutesToLabel,
} from '../lib/time';
import { buildingById, walkLabel, nextGame, gameDateLabel, DINING } from '../data/campus';
import { openDirections, openUrl } from '../lib/links';
import { isOpenNow } from '../lib/hours';
import { roomLabel } from '../lib/rooms';
import { leavePlan } from '../lib/leave';
import { BannerAd } from '../lib/monetize';
import { TERM } from '../config';
import { upcomingDates, dateLabel } from '../data/hub';
import { FIRST_WEEKS, firstWeeksActive } from '../data/firstweeks';
import { iconOffer, useCurrentIcon, ICON_LABELS } from '../lib/icons';
import { StoriesRow, StoryViewer } from '../sheets/Story';
import { WellnessCard } from '../sheets/Wellness';
import { bedtimeFor } from '../lib/bedtime';

const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`);

/* ---------- Header chip ---------- */
function ScoreChip() {
  const { score, user, setTab } = useApp();
  if (!user || user.isAnonymous) return null;
  const pts = score?.points || 0;
  return (
    <Pressable onPress={() => setTab('you')} accessibilityLabel={`Flight Score ${pts} points`} style={{ marginRight: 10, backgroundColor: '#FFE45C', borderWidth: 1.5, borderColor: '#1F2A44', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '-3deg' }] }}>
      <T kind="bold" color="#1F2A44" style={{ fontSize: 13 }}>✈︎ {pts.toLocaleString()}</T>
    </Pressable>
  );
}

/* ---------- Moments from friends (24 hours, friends only) ---------- */
function Moments() {
  const { setSheet, user } = useApp();
  const [viewing, setViewing] = useState(null);
  if (!user || user.isAnonymous) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><StoriesRow onOpen={setViewing} /></View>
        <Pressable onPress={() => setSheet({ type: 'compose', kind: 'moment' })} accessibilityLabel="Post a moment for friends" style={{ marginLeft: 6, alignItems: 'center', width: 56 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#1F2A44', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE45C' }}>
            <Icon name="camera" color="#1F2A44" />
          </View>
          <T kind="small" style={{ fontSize: 11 }}>Post</T>
        </Pressable>
      </View>
      {viewing ? <StoryViewer person={viewing} posts={viewing.posts} onClose={() => setViewing(null)} /> : null}
    </View>
  );
}

/* ---------- Weather ---------- */
function WeatherNote({ w, nextClass }) {
  if (w.loading) return <PostIt color="blue" seed="wx"><Loading label="Checking the sky…" /></PostIt>;
  if (w.error) return <PostIt color="blue" seed="wx"><PT kind="small">Weather is unavailable right now.</PT></PostIt>;
  let note = null;
  if (nextClass && toMinutes(nextClass.time) != null) {
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

/* ---------- Season icon offer ---------- */
function IconOffer() {
  const { season, seasonIcon, iconAsked, set, showToast } = useApp();
  const [current, switchIcon] = useCurrentIcon();
  const offer = iconOffer({ season, seasonIcon, iconAsked, current });
  if (!offer) return null;
  const dismiss = () => set({ iconAsked: offer.kind === 'switch' ? offer.season.id : `back-${offer.from}` });
  const go = async () => { const ok = await switchIcon(offer.name); dismiss(); if (!ok) showToast("Couldn't change the icon on this phone."); };
  return (
    <FadeIn>
      <PostIt color="orange" tilt={1.2} style={{ marginTop: 16 }}>
        <Washi width={60} angle={6} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 54, height: 54, borderRadius: 12, borderWidth: 1.5, borderColor: '#1F2A44', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', marginRight: 12 }}>
            <Icon name={offer.kind === 'switch' ? 'leaf' : 'plane'} size={28} color="#1F2A44" />
          </View>
          <View style={{ flex: 1 }}>
            <PT kind="bold">{offer.kind === 'switch' ? `Want the ${ICON_LABELS[offer.name]} icon?` : `${ICON_LABELS[offer.from] || 'That'} season's over`}</PT>
            <PT kind="small">{offer.kind === 'switch' ? 'Your home screen gets a seasonal Flyer. iPhone will show a quick note when it changes.' : 'Switch back to the classic icon?'}</PT>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <Button title={offer.kind === 'switch' ? 'Switch' : 'Switch back'} small onPress={go} style={{ marginRight: 8 }} />
          <Button title="Not now" small kind="ghost" onPress={dismiss} style={{ backgroundColor: '#fff' }} />
        </View>
      </PostIt>
    </FadeIn>
  );
}

/* ---------- First 30 days ---------- */
function FirstWeeksCard() {
  const { firstWeeks, userClassYear, setSheet, set } = useApp();
  if (!firstWeeksActive({ firstWeeks, userClassYear }, TERM)) return null;
  const done = (firstWeeks.done || []).length;
  const next = FIRST_WEEKS.find((x) => !(firstWeeks.done || []).includes(x.id));
  const pct = Math.round((done / FIRST_WEEKS.length) * 100);
  return (
    <PostIt color="green" tape tilt={-0.8} style={{ marginTop: 16 }} onPress={() => setSheet({ type: 'firstWeeks' })} accessibilityLabel="First 30 days checklist">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <PT kind="tiny" style={{ flex: 1 }}>Your first 30 days · {done} of {FIRST_WEEKS.length}</PT>
        <Pressable onPress={() => set((p) => ({ firstWeeks: { ...p.firstWeeks, on: false } }))} hitSlop={10} accessibilityLabel="Hide the first 30 days card"><Icon name="close" size={14} color="#1F2A44" /></Pressable>
      </View>
      {next ? <PT kind="bold" style={{ marginTop: 4 }}>Next: {next.title}</PT> : null}
      <View style={{ height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#1F2A44', marginTop: 8, overflow: 'hidden', backgroundColor: '#fff' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#3FA66A' }} />
      </View>
    </PostIt>
  );
}

/* ---------- Today as a timeline ---------- */
function Timeline({ now }) {
  const { t } = useTheme();
  const { scheduleItems, setTab, setSheet } = useApp();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const plan = useMemo(() => leavePlan(scheduleItems, { code: todayCode(now) }), [JSON.stringify(scheduleItems), todayCode(now)]);
  if (!plan.length) {
    return (
      <Card onPress={() => setTab('schedule')}>
        <T kind="hand">no classes today</T>
        <T kind="small" style={{ marginTop: 2 }}>Tap to see your week or add a class.</T>
      </Card>
    );
  }
  const nextIdx = plan.findIndex((p) => (toMinutes(p.cls.endTime) ?? p.start + 50) > nowM);
  const rows = [];
  plan.forEach((p, i) => {
    if (i > 0) {
      const prevEnd = toMinutes(plan[i - 1].cls.endTime);
      const gap = prevEnd != null ? p.start - prevEnd : 0;
      if (gap >= 45) rows.push({ gap: true, from: prevEnd, to: p.start, key: `gap-${i}` });
    }
    rows.push({ ...p, i, key: p.cls.id });
  });
  const openFood = DINING.filter((d) => isOpenNow(d.hours) === true);
  return (
    <View style={{ paddingLeft: 14 }}>
      <View style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, backgroundColor: t.rule }} />
      {rows.map((r) => {
        if (r.gap) {
          const live = nowM >= r.from && nowM < r.to;
          const lunch = r.from <= 13 * 60 && r.to >= 11 * 60 + 30;
          return (
            <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ position: 'absolute', left: -13, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: t.pencil, backgroundColor: t.paper }} />
              <View style={{ flex: 1, borderWidth: 1.5, borderStyle: 'dashed', borderColor: live ? t.ok : t.rule, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                <T kind="hand" style={{ fontSize: 17 }}>free {minutesToLabel(r.from)}–{minutesToLabel(r.to)} · {dur(r.to - r.from)}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {lunch ? <Pressable onPress={() => setSheet({ type: 'openNow' })}><T kind="small" style={{ textDecorationLine: 'underline', marginRight: 10 }}>{live && openFood.length ? `${openFood.length} places open to eat` : 'Lunch?'}</T></Pressable> : null}
                  <Pressable onPress={() => setSheet({ type: 'groups' })}><T kind="small" style={{ textDecorationLine: 'underline' }}>Plan something</T></Pressable>
                </View>
              </View>
            </View>
          );
        }
        const done = (toMinutes(r.cls.endTime) ?? r.start + 50) <= nowM;
        const isNext = r.i === nextIdx;
        return isNext ? <UpNext key={r.key} row={r} now={now} /> : (
          <Pressable key={r.key} onPress={() => setTab('schedule')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, opacity: done ? 0.5 : 1 }}>
            <View style={{ position: 'absolute', left: -14, width: 12, height: 12, borderRadius: 6, backgroundColor: done ? t.pencil : t.accent }} />
            <T kind="num" style={{ width: 78, fontSize: 13 }}>{r.cls.time}</T>
            <View style={{ flex: 1 }}>
              <T kind="bold" numberOfLines={1} style={{ textDecorationLine: done ? 'line-through' : 'none' }}>{r.cls.title}</T>
              <T kind="small" numberOfLines={1}>{metaLine(r.cls.place, r.tight ? 'tight walk' : null)}</T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function UpNext({ row, now }) {
  const { t } = useTheme();
  const { setSheet } = useApp();
  const next = row.cls;
  const b = row.building || buildingById(next.buildingId);
  const nowM = now.getHours() * 60 + now.getMinutes();
  const inMin = row.start - nowM;
  const happening = inMin <= 0;
  const walk = row.walk ?? (b ? b.walk : null);
  const leaveIn = walk != null ? inMin - walk - 2 : null;
  const room = roomLabel(next.place);
  return (
    <View style={{ marginVertical: 6 }}>
      <View style={{ position: 'absolute', left: -16, top: 18, width: 16, height: 16, borderRadius: 8, backgroundColor: t.redPen, borderWidth: 2, borderColor: t.paper }} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <T kind="tiny">{happening ? 'Happening now' : 'Up next'}</T>
            <T kind="title" style={{ fontSize: 22, lineHeight: 27, marginTop: 2 }}>{next.title}</T>
            <T kind="small">{metaLine(`${next.time}${next.endTime ? `–${next.endTime}` : ''}`, next.place)}</T>
          </View>
          {!happening ? (
            <Highlight><T kind="handBig" style={{ fontSize: 26 }}>{dur(inMin)}</T></Highlight>
          ) : <Stamp label="In class" color={t.ok} />}
        </View>
        {!happening && leaveIn != null && leaveIn <= 10 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Icon name="walk" size={18} color={t.redPen} />
            <T kind="bold" color={t.redPen} style={{ marginLeft: 6, flex: 1 }}>
              {leaveIn <= 0 ? `Leave now. It's about a ${walk}-minute walk${row.fromName ? ` from ${row.fromName}` : ''}.` : `Leave in ${leaveIn} min (${walk}-minute walk${row.fromName ? ` from ${row.fromName}` : ''}).`}
            </T>
          </View>
        ) : null}
        {!happening && row.tight ? <T kind="small" color={t.redPen} style={{ marginTop: 6 }}>Heads up: that's a tight walk from your last class.</T> : null}
        {b ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
            <Button title={walk ? `${walk} min walk` : walkLabel(b) || 'Directions'} icon="walk" small onPress={() => openDirections(b)} style={{ marginRight: 8, marginBottom: 6 }} />
            <Button title={room ? `Find ${room}` : 'Find the room'} icon="door" small kind="ghost" onPress={() => setSheet({ type: 'rooms', query: next.place || b.name, buildingId: b.id })} style={{ marginRight: 8, marginBottom: 6 }} />
            <Button title="Missed it?" icon="clipboard" small kind="ghost" onPress={() => setSheet({ type: 'missed', course: next.title })} style={{ marginBottom: 6 }} />
          </View>
        ) : next.place ? (
          <Button title="Find the room" icon="door" small kind="ghost" onPress={() => setSheet({ type: 'rooms', query: next.place })} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
        ) : null}
      </Card>
    </View>
  );
}

/* ---------- Due soon ---------- */
function DueSoon() {
  const { t } = useTheme();
  const { assignments, updateAssignment, setTab } = useApp();
  const list = assignments.filter((a) => !a.done && a.due).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 3);
  return (
    <>
      <Section title="Due soon" icon="clipboard" action="planner" onAction={() => setTab('schedule')} />
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
        <Card onPress={() => setTab('schedule')}><T kind="hand">all caught up ✓</T><T kind="small">Add assignments, or drop in a syllabus, in the Planner.</T></Card>
      )}
    </>
  );
}

/* ---------- Tonight ---------- */
function Tonight({ now }) {
  const { setSheet, setTab, isHidden } = useApp();
  const [posted, setPosted] = useState([]);
  useEffect(() => listenPublic('event', setPosted, 40), []);
  const official = useCallable(api.getEvents, {}, 'events');
  const start = new Date(now); start.setHours(16, 0, 0, 0);
  if (now > start) start.setTime(now.getTime() - 60 * 60000);
  const end = new Date(now); end.setHours(27, 0, 0, 0); // 3 AM
  const inWindow = (iso) => { const d = iso ? new Date(iso) : null; return d && d >= start && d <= end; };
  const list = [
    ...posted.filter((p) => inWindow(p.when) && !isHidden('publicPost', p.id)).map((p) => ({ id: `p-${p.id}`, title: p.title, when: p.when, where: p.place?.name || '', open: () => setSheet({ type: 'publicPost', id: p.id }), org: !!p.verified })),
    ...(official.data || []).filter((e) => inWindow(e.startsAt)).map((e, i) => ({ id: `o-${i}`, title: e.title, when: e.startsAt, where: e.location || e.org || '', open: () => setSheet({ type: 'event', ev: { ...e, id: e.id || `live-${i}` } }) })),
  ].sort((a, b) => new Date(a.when) - new Date(b.when)).slice(0, 3);
  if (!list.length) return null;
  return (
    <>
      <Section title="Tonight" icon="moon" action="more" onAction={() => setTab('discover')} hand="Posted by students, orgs, and campus calendars" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {list.map((e, i) => (
          <View key={e.id} style={{ width: list.length === 1 ? '100%' : '48.5%', marginBottom: 12 }}>
            <PostIt color={['pink', 'lavender', 'orange'][i % 3]} seed={e.id} onPress={e.open} minHeight={110}>
              {i % 2 === 0 ? <View style={{ position: 'absolute', top: -6, left: '45%' }}><Pushpin color="#E0533F" /></View> : null}
              <PT kind="tiny">{new Date(e.when).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '')}</PT>
              <PT kind="bold" numberOfLines={2} style={{ marginTop: 2 }}>{e.title}</PT>
              {e.where ? <PT kind="small" numberOfLines={1}>{e.where}</PT> : null}
            </PostIt>
          </View>
        ))}
      </View>
    </>
  );
}

/* ---------- One deal and one tip ---------- */
function DealAndTip({ now }) {
  const { setSheet, flags, isHidden } = useApp();
  const deals = useCallable(api.getDeals, {}, 'deals', { enabled: !!flags.deals });
  const [tips, setTips] = useState([]);
  useEffect(() => listenPublic('tip', setTips, 8), []);
  const dayIdx = Math.floor(now.getTime() / 86400000);
  const dl = (deals.data || []).filter((d) => !d.online);
  const deal = dl.length ? dl[dayIdx % dl.length] : null;
  const tl = tips.filter((p) => !isHidden('publicPost', p.id));
  const tip = tl.length ? tl[dayIdx % tl.length] : null;
  if (!deal && !tip) return null;
  return (
    <View style={{ flexDirection: 'row', marginTop: 18 }}>
      {deal ? (
        <PostIt color="orange" tilt={-1.4} style={{ flex: 1, marginRight: tip ? 10 : 0 }} onPress={() => setSheet({ type: 'deals' })} accessibilityLabel={`Deal: ${deal.name}, ${deal.offer}`}>
          <PT kind="tiny">Deal</PT>
          <PT kind="bold" numberOfLines={2}>{deal.name}</PT>
          <Highlighter><PT kind="small" numberOfLines={3}>{deal.offer}</PT></Highlighter>
        </PostIt>
      ) : null}
      {tip ? (
        <PostIt color="yellow" tilt={1.2} style={{ flex: 1 }} onPress={() => setSheet({ type: 'publicPost', id: tip.id })} accessibilityLabel={`Good to know: ${tip.title}`}>
          <Washi width={44} angle={-6} />
          <PT kind="tiny">Good to know</PT>
          <PT kind="small" numberOfLines={4} style={{ marginTop: 2 }}>{tip.title}</PT>
        </PostIt>
      ) : null}
    </View>
  );
}

/* ---------- The next official deadline, if it's within two weeks ---------- */
function NextDeadline({ now }) {
  const { setTab, setCampusMode, flags } = useApp();
  const d = upcomingDates(now, 1)[0];
  if (!flags.hub || !d || d.days > 14) return null;
  const when = d.days <= 0 ? 'today' : d.days === 1 ? 'tomorrow' : `in ${d.days} days`;
  return (
    <PostIt color="green" seed={`dl-${d.date}`} style={{ marginTop: 18 }} onPress={() => { setCampusMode('hub'); setTab('campus'); }} accessibilityLabel={`${d.title}, ${dateLabel(d)}`}>
      <PT kind="tiny">Coming up · {dateLabel(d)}</PT>
      <PT kind="bold" style={{ marginTop: 2 }}>{d.title}</PT>
      <PT kind="small">{when}. Tap for more dates and the Campus hub.</PT>
    </PostIt>
  );
}

/* ---------- Sleep peek (only if Apple Health is connected, or the night before an early class) ---------- */
function WellnessPeek({ now }) {
  const { connections, scheduleItems, setSheet } = useApp();
  const bed = bedtimeFor(scheduleItems, now);
  const evening = now.getHours() >= 19;
  if (connections?.health && now.getHours() < 12) return <View style={{ marginTop: 18 }}><WellnessCard compact /></View>;
  if (!bed || !evening || !(bed.asleepBy >= 21 * 60 || bed.asleepBy <= 60)) return null;
  return (
    <Card style={{ marginTop: 18 }} onPress={() => setSheet({ type: 'wellness' })}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="bed" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <T kind="bold">{bed.cls.title} at {bed.startLabel} tomorrow</T>
          <T kind="small">Asleep by {bed.asleepLabel} gets you about 8 hours.</T>
        </View>
      </View>
    </Card>
  );
}

/* ---------- Quick tools ---------- */
function QuickTools() {
  const { setSheet } = useApp();
  const tools = [
    { id: 'open', label: 'Open now', icon: 'clock', color: 'green', sheet: { type: 'openNow' } },
    { id: 'rooms', label: 'Find a room', icon: 'door', color: 'blue', sheet: { type: 'rooms' } },
    { id: 'walk', label: 'Safe Walk', icon: 'shield', color: 'orange', sheet: { type: 'safewalk' } },
    { id: 'scan', label: 'Scan', icon: 'scan', color: 'pink', sheet: { type: 'scan' } },
  ];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
      {tools.map((x, i) => (
        <View key={x.id} style={{ width: '23%' }}>
          <PostIt color={x.color} seed={x.id} tilt={[-2, 1.5, -1, 2][i]} padding={10} fold={false} onPress={() => setSheet(x.sheet)} accessibilityLabel={x.label}>
            <View style={{ alignItems: 'center' }}>
              <Icon name={x.icon} color="#1F2A44" />
              <PT kind="small" style={{ fontSize: 11.5, marginTop: 4, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{x.label}</PT>
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
      <Section title="In the loop" icon="megaphone" hand={news.offline ? 'Saved copy · you look offline' : 'Live headlines from campus & Lubbock outlets'} />
      {news.loading && !news.data ? <Loading label="Grabbing today's headlines…" /> : null}
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
      right={(
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ScoreChip />
          <Pressable onPress={() => setTab('you')} accessibilityLabel="Your profile"><Avatar config={avatar} size={46} /></Pressable>
        </View>
      )}>
      <Moments />
      <View style={{ marginTop: 12 }}><WeatherNote w={w} nextClass={next} /></View>

      {(alerts.data || []).map((a, i) => (
        <PostIt key={i} color="pink" seed={`al${i}`} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="alert" size={18} color="#C8413B" /><PT kind="bold" style={{ marginLeft: 6, flex: 1 }}>{a.title}</PT></View>
          <PT kind="small" style={{ marginTop: 4 }}>{metaLine(a.body, a.source, a.date)}</PT>
        </PostIt>
      ))}

      <IconOffer />
      <FirstWeeksCard />
      <QuickTools />

      <Section title={today.length ? `Today · ${today.length} ${today.length === 1 ? 'class' : 'classes'}` : 'Today'} icon="schedule" action="week" onAction={() => setTab('schedule')} />
      <Timeline now={now} />

      <DueSoon />
      <Tonight now={now} />
      <DealAndTip now={now} />
      <NextDeadline now={now} />
      <WellnessPeek now={now} />

      {finalsIn > 0 && finalsIn <= 45 ? (
        <PostIt color="lavender" seed="finals" style={{ marginTop: 18 }} onPress={() => setTab('schedule')}>
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
