/**
 * Pilot — Flyer's campus assistant (formerly "Ask Red").
 * ------------------------------------------------------------
 * Order matters:
 *  1. Instant answers computed from real app state (next class,
 *     weather, what's due, what's open, saved) — free, no model.
 *  2. Fixed answers that point at official sources (gameday, parking,
 *     textbooks, safety).
 *  3. Everything else → askPilot Cloud Function, grounded in a data
 *     snapshot, with live search for things the app doesn't know.
 * Server-side daily limits protect the API budget; the counter here
 * just shows the user where they stand.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Sheet, T, PostIt, PT, Row, Chip } from '../ui/Paper';
import Icon from '../ui/Icon';
import { PlaneMark } from '../ui/Logo';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { useWeather } from '../lib/hooks';
import { isOpenNow } from '../lib/hours';
import {
  itemsOnDay, todayCode, toMinutes, sortByTime, dueLabel, metaLine,
} from '../lib/time';
import {
  BUILDINGS, ORGS, DINING, RESOURCES, buildingById, catLabel, walkLabel, nextGame, gameDateLabel,
} from '../data/campus';
import { openUrl } from '../lib/links';
import { LIMITS, SAFETY } from '../config';

const SUGGESTIONS = [
  'Where is my next class?', "What's due this week?", "What's open to eat right now?",
  "What's happening tonight?", 'Where can I study late?', 'When is the next game?',
];

const FIXED = [
  { match: ['gate', 'get in the game', 'bag policy', 'gameday', 'game day', 'student ticket'], text: "Gates, bag policy, and student entry are in the official gameday guide. Bring your student ID.", resourceIds: ['res5'] },
  { match: ['football parking', 'game parking', 'shuttle'], text: 'On game days, lots and the free Park & Ride shuttle are on the official football parking map.', resourceIds: ['res7'] },
  { match: ['textbook', 'bookstore', 'merch'], text: "Raider Depot in the Student Union carries required textbooks and course materials.", resourceIds: ['res6'] },
  { match: ['police', 'emergency', 'unsafe', 'help me', 'campus safety'], text: `If it's an emergency, call 911. Texas Tech Police (24/7, non-emergency): ${SAFETY.campusPolice.phone}.`, sheet: 'safety' },
  { match: ['tutor', 'writing center', 'counsel'], text: 'These campus resources can help:', resourceIds: ['res1', 'res2', 'res3'] },
  { match: ['printing', 'print'], text: 'IT Help Central in the Library handles student printing questions.', resourceIds: ['res4'] },
];

function buildContext({ scheduleItems, assignments, weather, userMajor, userClassYear }) {
  const today = sortByTime(itemsOnDay(scheduleItems, todayCode()));
  const due = assignments.filter((a) => !a.done && a.due).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 8);
  const openFood = DINING.filter((d) => isOpenNow(d.hours) === true).map((d) => `${d.name} (${d.venue})`);
  const g = nextGame();
  return [
    `Now: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} (Central).`,
    `Student: ${metaLine(userClassYear, userMajor) || 'not specified'}.`,
    `Today's classes: ${today.length ? today.map((i) => `${i.time}-${i.endTime} ${i.title} @ ${i.place}`).join('; ') : 'none'}.`,
    `Weekly classes: ${scheduleItems.filter((c) => !c.oneOff).map((c) => `${c.title} ${(c.days || []).join('/')} ${c.time}`).join('; ') || 'none'}.`,
    `Upcoming assignments: ${due.length ? due.map((a) => `${a.title} (${a.course || 'no class'}) due ${new Date(a.due).toLocaleString('en-US')}`).join('; ') : 'none'}.`,
    `Weather in Lubbock: ${weather.loading || weather.error ? 'unavailable' : `${weather.temp}°F, ${weather.condition}`}.`,
    `Dining open right now: ${openFood.join(', ') || 'none with posted hours'}.`,
    `Next football game: ${g ? `${g.homeAway === 'home' ? 'vs.' : 'at'} ${g.opponent}, ${gameDateLabel(g.kickoff)}, ${g.venue}` : 'season over'}.`,
    `Real campus buildings (never invent one): ${BUILDINGS.map((b) => b.name).join(', ')}.`,
    `Real student orgs (never invent one): ${ORGS.map((o) => o.name).join(', ')}.`,
  ].join('\n');
}

export default function Pilot({ onClose }) {
  const { t } = useTheme();
  const app = useApp();
  const { scheduleItems, assignments, savedEvents, goToBuilding, setSheet, setTab, pilotSeed, setPilotSeed, notePilotUse, isPlus, pilotUsedToday, pilotDay, schoolId } = app;
  const weather = useWeather(schoolId);
  const [input, setInput] = useState('');
  const [thread, setThread] = useState([]);
  const scroller = useRef(null);
  const usedToday = pilotDay === new Date().toISOString().slice(0, 10) ? pilotUsedToday : 0;
  const limit = isPlus ? LIMITS.pilotPlus : LIMITS.pilotFree;

  const local = (low) => {
    if (/(next|my) class|where.*class|what.*class|schedule today/.test(low)) {
      const nowM = new Date().getHours() * 60 + new Date().getMinutes();
      const next = sortByTime(itemsOnDay(scheduleItems, todayCode())).find((i) => (toMinutes(i.endTime) ?? 0) > nowM);
      if (!next) return { text: scheduleItems.length ? "You're done with classes for today." : "You haven't added any classes yet — add them in the Planner and I'll know." };
      const b = buildingById(next.buildingId);
      return { text: `${next.title} at ${next.time} in ${next.place || b?.name}.${b?.walk ? ` About a ${b.walk}-minute walk.` : ''}`, buildingId: next.buildingId };
    }
    if (/due|assignment|homework/.test(low)) {
      const due = assignments.filter((a) => !a.done && a.due).sort((a, b) => new Date(a.due) - new Date(b.due));
      const week = due.filter((a) => new Date(a.due) - new Date() < 7 * 86400000);
      if (!due.length) return { text: "Nothing in your planner is due. If that's wrong, add assignments in Planner → Due.", tab: 'schedule' };
      return { text: week.length ? `You have ${week.length} due this week:\n${week.slice(0, 5).map((a) => `• ${a.title}${a.course ? ` (${a.course})` : ''} — ${dueLabel(a.due)}`).join('\n')}` : `Nothing this week. Next up: ${due[0].title}, ${dueLabel(due[0].due)}.`, tab: 'schedule' };
    }
    if (/weather|rain|cold|hot|jacket|umbrella|outside/.test(low)) {
      if (weather.loading) return { text: 'Still checking the weather — ask again in a sec.' };
      if (weather.error) return { text: "I can't reach the weather service right now." };
      return { text: `It's ${weather.temp}° and ${weather.condition.toLowerCase()} in Lubbock. High ${weather.hi}°, low ${weather.lo}°.` };
    }
    if (/(eat|food|hungry|lunch|dinner|breakfast|coffee).*(open|now)|open.*(eat|food)|what.*open/.test(low)) {
      const open = DINING.filter((d) => isOpenNow(d.hours) === true).sort((a, b) => (a.walk ?? 99) - (b.walk ?? 99));
      if (!open.length) return { text: 'None of the on-campus dining spots with posted hours are open right now.' };
      return { text: `${open.length} spots are open now. Closest:`, diningIds: open.slice(0, 4).map((d) => d.id) };
    }
    if (/next (football )?game|when.*game|who.*play/.test(low)) {
      const g = nextGame();
      return { text: g ? `${g.homeAway === 'home' ? 'Home vs.' : 'Away at'} ${g.opponent} — ${gameDateLabel(g.kickoff)} at ${g.venue}.` : 'Football season is over.' };
    }
    if (/saved|bookmark/.test(low)) return { text: savedEvents.length ? `You have ${savedEvents.length} saved ${savedEvents.length === 1 ? 'event' : 'events'} — they're in You.` : 'Nothing saved yet.', tab: 'you' };
    if (/study|quiet|library/.test(low)) return { text: 'Good study spots:', buildingIds: ['texas-tech-university-library', 'student-union'] };
    return null;
  };

  const ask = async (text) => {
    const q = (text || input).trim();
    if (!q) return;
    const low = q.toLowerCase();
    setInput('');
    setThread((p) => [...p, { role: 'u', text: q }]);
    const l = local(low);
    if (l) { setThread((p) => [...p, { role: 'p', hit: l }]); return; }
    const fixed = FIXED.find((r) => r.match.some((m) => low.includes(m)));
    if (fixed) { setThread((p) => [...p, { role: 'p', hit: fixed }]); return; }
    if (usedToday >= limit) {
      setThread((p) => [...p, { role: 'p', hit: { text: isPlus ? "You've hit today's question limit — it resets at midnight." : `That's all ${limit} free questions for today. They reset at midnight, or Flyer Plus gives you ${LIMITS.pilotPlus} a day.`, plus: !isPlus } }]);
      return;
    }
    const id = `pending-${Date.now()}`;
    setThread((p) => [...p, { role: 'p', pending: true, id }]);
    try {
      const res = await api.askPilot({ question: q, context: buildContext({ ...app, weather }), history: thread.slice(-6).filter((m) => !m.pending).map((m) => ({ role: m.role === 'u' ? 'user' : 'assistant', text: m.text || m.hit?.text || '' })) });
      notePilotUse();
      const reply = (res?.data?.text || '').trim() || "I don't have verified information on that.";
      setThread((p) => p.map((m) => (m.id === id ? { role: 'p', hit: { text: reply, sources: res?.data?.sources || [] } } : m)));
    } catch (e) {
      const msg = e?.code === 'functions/resource-exhausted' ? e.message : "I couldn't reach the server — try again in a moment.";
      setThread((p) => p.map((m) => (m.id === id ? { role: 'p', hit: { text: msg } } : m)));
    }
  };

  useEffect(() => { if (pilotSeed) { ask(pilotSeed); setPilotSeed(null); } }, []);
  useEffect(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60); }, [thread.length]);

  return (
    <Sheet title="Pilot" hand="Ask anything about campus." onClose={onClose} scroll={false} height={0.9}
      headerRight={<View style={{ marginRight: 4 }}><PlaneMark size={34} trail={false} /></View>}
      footer={(
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 2, borderColor: t.mode === 'dark' ? t.borderStrong : '#1F2A44', borderRadius: 16, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 }}>
            <TextInput style={{ flex: 1, fontSize: 16, color: t.ink, paddingVertical: 6 }} placeholder="Ask Pilot…" placeholderTextColor={t.faint} value={input} onChangeText={setInput} onSubmitEditing={() => ask()} returnKeyType="send" maxLength={500} />
            <Pressable onPress={() => ask()} accessibilityLabel="Send" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.highlight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1F2A44' }}>
              <Icon name="send" size={18} color="#1F2A44" />
            </Pressable>
          </View>
          <T kind="small" style={{ fontSize: 11, marginTop: 6, textAlign: 'center' }}>{Math.max(0, limit - usedToday)} live answers left today · Pilot can be wrong — check official sources for deadlines.</T>
        </View>
      )}>
      <ScrollView ref={scroller} style={{ height: 420 }} contentContainerStyle={{ paddingBottom: 10 }} keyboardShouldPersistTaps="handled">
        {!thread.length ? (
          <View>
            <T kind="hand" style={{ marginBottom: 8 }}>try one of these:</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {SUGGESTIONS.map((s) => <Chip key={s} label={s} onPress={() => ask(s)} />)}
            </View>
          </View>
        ) : thread.map((m, i) => (m.role === 'u' ? (
          <View key={i} style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: t.accent, borderRadius: 14, borderBottomRightRadius: 4, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 }}>
            <T color={t.accentInk}>{m.text}</T>
          </View>
        ) : m.pending ? (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <ActivityIndicator color={t.accent} /><T kind="hand" style={{ marginLeft: 8 }}>thinking…</T>
          </View>
        ) : (
          <View key={i} style={{ marginBottom: 12, maxWidth: '94%' }}>
            <PostIt color="yellow" seed={`p${i}`} padding={12} fold={false}>
              <PT>{m.hit.text}</PT>
            </PostIt>
            <View style={{ marginTop: 6 }}>
              {m.hit.buildingId ? <Row title={buildingById(m.hit.buildingId)?.name} meta="Show on map" onPress={() => { onClose(); goToBuilding(m.hit.buildingId); }} /> : null}
              {(m.hit.buildingIds || []).map((id) => { const b = buildingById(id); return b ? <Row key={id} title={b.name} meta={metaLine(catLabel(b.kind), walkLabel(b))} onPress={() => { onClose(); goToBuilding(id); }} /> : null; })}
              {(m.hit.diningIds || []).map((id) => { const d = DINING.find((x) => x.id === id); return d ? <Row key={id} title={d.name} meta={metaLine(d.venue, d.walk ? `${d.walk} min walk` : null)} onPress={() => { onClose(); setSheet({ type: 'dining', id }); }} /> : null; })}
              {(m.hit.resourceIds || []).map((id) => { const r = RESOURCES.find((x) => x.id === id); return r ? <Row key={id} title={r.name} meta={r.kind} onPress={() => (r.url ? openUrl(r.url) : (onClose(), goToBuilding(r.buildingId)))} /> : null; })}
              {(m.hit.sources || []).slice(0, 3).map((s) => <Row key={s.url} title={s.title || s.url} meta="Source" onPress={() => openUrl(s.url)} />)}
              {m.hit.tab ? <Row title={m.hit.tab === 'schedule' ? 'Open Planner' : 'Open You'} onPress={() => { onClose(); setTab(m.hit.tab); }} /> : null}
              {m.hit.sheet ? <Row title="Safety numbers" onPress={() => { onClose(); setSheet({ type: m.hit.sheet }); }} /> : null}
              {m.hit.plus ? <Row title="See Flyer Plus" onPress={() => { onClose(); setSheet({ type: 'plus' }); }} /> : null}
            </View>
          </View>
        )))}
      </ScrollView>
    </Sheet>
  );
}
