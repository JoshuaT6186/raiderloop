/**
 * Week: how heavy each week of the semester looks (busiest week), a
 * few kind suggestions, and what's on your connected calendars in the
 * next seven days.
 */
import React, { useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, PostIt, PT, Card, Section, Row, Empty, Button } from '../../ui/Paper';
import { SectionNote, Highlighter } from '../../ui/Kit';
import Icon from '../../ui/Icon';
import { semesterWeeks, weekTips, weightFor } from '../../lib/load';
import { dueLabel, metaLine } from '../../lib/time';
import { TERM } from '../../config';

const LEVEL = { free: ['Free', '#BFD8C2'], light: ['Light', '#9CCBFF'], busy: ['Busy', '#FFD36E'], heavy: ['Heavy', '#F28B82'] };

export default function Week() {
  const { t } = useTheme();
  const { assignments, groups, feedEvents, setSheet } = useApp();
  const items = useMemo(() => [
    ...assignments.filter((a) => a.due).map((a) => ({ id: a.id, title: a.title, course: a.course, due: a.due, type: a.type })),
    ...groups.flatMap((g) => (g.deadlines || []).filter((d) => !d.done && d.due).map((d) => ({ id: `${g.id}-${d.id}`, title: d.title, course: g.name, due: d.due }))),
  ], [assignments, groups]);
  const weeks = useMemo(() => semesterWeeks({ firstDay: TERM.firstDay, finalsEnd: TERM.finalsEnd, items }), [items]);
  const tips = weekTips(weeks);
  const cur = weeks.find((w) => w.isNow) || weeks.find((w) => !w.past) || weeks[weeks.length - 1];
  const [pick, setPick] = useState(cur ? cur.n : 1);
  const sel = weeks.find((w) => w.n === pick) || cur;
  const soon = (feedEvents || []).filter((e) => { const d = new Date(e.startsAt); return d > new Date() && d < new Date(Date.now() + 7 * 86400000); }).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  if (!weeks.length) return <Empty icon="calendar" title="Semester dates aren't set" />;
  return (
    <View>
      <Card style={{ marginTop: 6 }}>
        <T kind="tiny" style={{ marginBottom: 8 }}>{TERM.label}, week by week</T>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 96 }}>
          {weeks.map((w) => {
            const on = w.n === sel?.n;
            return (
              <Pressable key={w.n} onPress={() => setPick(w.n)} accessibilityRole="button" accessibilityLabel={`Week of ${w.label}, ${LEVEL[w.level][0]}, ${w.items.length} things due`}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', opacity: w.past && !on ? 0.4 : 1 }}>
                <View style={{ width: '70%', height: Math.max(4, w.pct * 70), backgroundColor: LEVEL[w.level][1], borderWidth: on ? 2 : 1, borderColor: on ? '#1F2A44' : t.border, borderRadius: 3 }} />
                {w.isNow ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.redPen, marginTop: 3 }} /> : <View style={{ height: 9 }} />}
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <T kind="small" style={{ fontSize: 10.5 }}>{weeks[0].label}</T>
          <T kind="small" style={{ fontSize: 10.5 }}>finals</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {Object.entries(LEVEL).map(([k, [label, color]]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
              <View style={{ width: 10, height: 10, backgroundColor: color, borderRadius: 2, marginRight: 4, borderWidth: 1, borderColor: t.border }} /><T kind="small" style={{ fontSize: 11 }}>{label}</T>
            </View>
          ))}
        </View>
      </Card>

      {tips.map((x, i) => (
        <PostIt key={x.id} color={x.id === 'rest' ? 'pink' : x.id === 'light' ? 'green' : 'yellow'} tilt={i % 2 ? 0.8 : -0.8} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><Icon name={x.icon} size={18} color="#1F2A44" /><PT style={{ marginLeft: 8, flex: 1 }}>{x.text}</PT></View>
        </PostIt>
      ))}

      {sel ? (
        <>
          <Section title={sel.isNow ? 'This week' : `Week of ${sel.label}`} icon="calendar" hand={`${LEVEL[sel.level][0]} · ${sel.items.length} ${sel.items.length === 1 ? 'thing' : 'things'} due`} />
          {sel.items.length ? (
            <Card>
              {sel.items.map((it, i) => <Row key={it.id} title={it.title} meta={metaLine(it.course, dueLabel(it.due))} right={weightFor(it) >= 4 ? <Highlighter><T kind="tiny">big one</T></Highlighter> : null} last={i === sel.items.length - 1} />)}
            </Card>
          ) : <Card><T kind="hand">nothing due this week</T></Card>}
        </>
      ) : null}

      <Section title="From your calendars" icon="link" action="connect" onAction={() => setSheet({ type: 'connections' })} hand="Next 7 days" />
      {soon.length ? (
        <Card>
          {soon.slice(0, 12).map((e, i) => (
            <Row key={e.id} title={e.title} meta={metaLine(new Date(e.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(e.allDay ? {} : { hour: 'numeric', minute: '2-digit' }) }), e.location)} last={i === Math.min(soon.length, 12) - 1} />
          ))}
        </Card>
      ) : (
        <Card onPress={() => setSheet({ type: 'connections' })}>
          <T kind="small">Connect a calendar link (Outlook, Google, Canvas, a club calendar) to see it here next to your classes.</T>
        </Card>
      )}
      <Button title="Drop in a syllabus" icon="upload" kind="ghost" small onPress={() => setSheet({ type: 'syllabus' })} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
      <SectionNote icon="info">Exams and projects count more than homework. Group deadlines count too.</SectionNote>
    </View>
  );
}
