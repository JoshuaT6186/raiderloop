/**
 * Finals: countdown plus a per-class exam lookup.
 * The exam grid comes from the getFinals function, which reads the
 * university's own published "by class time" schedule and returns
 * nothing until that page exists — Flyer never guesses an exam time.
 */
import React from 'react';
import { View } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, PostIt, PT, Card, Button, Section, Loading, Row, Stamp } from '../../ui/Paper';
import { useCallable } from '../../lib/hooks';
import { api } from '../../lib/firebase';
import { daysUntil, toMinutes, metaLine } from '../../lib/time';
import { openUrl } from '../../lib/links';
import { TERM } from '../../config';

/* Match a class to a grid row: same meeting-day pattern + same start. */
function findExam(grid, cls) {
  const days = (cls.days || []).join('');
  const start = toMinutes(cls.time);
  return grid.find((r) => {
    const rd = (r.days || []).join('');
    return rd === days && toMinutes(r.classStart) === start;
  }) || null;
}

export default function Finals() {
  const { t } = useTheme();
  const { scheduleItems } = useApp();
  const finals = useCallable(api.getFinals, { term: TERM.id }, null, { asArray: false });
  const grid = finals.data?.grid || [];
  const n = daysUntil(TERM.finalsStart);
  const classes = scheduleItems.filter((c) => !c.oneOff);
  const fmt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <View>
      <PostIt color="lavender" tilt={-1} tape style={{ marginTop: 6 }}>
        <PT kind="tiny">{TERM.label}</PT>
        <PT kind="title" style={{ fontSize: 30, lineHeight: 36 }}>{n > 0 ? `${n} days` : n === 0 ? 'Finals start today' : 'Finals are underway'}</PT>
        <PT kind="small">Finals run {fmt(TERM.finalsStart)} – {fmt(TERM.finalsEnd)} · last day of classes {fmt(TERM.lastDay)}</PT>
      </PostIt>

      <Section title="Your exams" hand="Matched by meeting days and start time" />
      {finals.loading ? <Loading label="Checking the official exam schedule…" /> : null}
      {!finals.loading && !grid.length ? (
        <Card>
          <T kind="bold">The by-class-time exam grid isn't posted yet.</T>
          <T kind="small" style={{ marginTop: 4 }}>
            So far the university has only published common (department-wide) finals for {TERM.label}. Flyer checks again automatically and fills these in once the official grid is up.
          </T>
          <Button title="See official finals page" icon="link" kind="ghost" small onPress={() => openUrl(TERM.officialFinalsUrl)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        </Card>
      ) : null}
      {grid.length ? (
        <Card>
          {classes.map((c, i) => {
            const ex = findExam(grid, c);
            return (
              <Row key={c.id} title={c.title} last={i === classes.length - 1}
                meta={ex ? metaLine(ex.examDate, ex.examTime) : `${(c.days || []).join('/')} ${c.time} · no grid match (could be a common final or arranged exam)`}
                right={ex ? <Stamp label="Found" color={t.ok} /> : null} />
            );
          })}
          <T kind="small" style={{ marginTop: 8 }}>Always confirm with your syllabus. Some classes use common finals or arranged times.</T>
        </Card>
      ) : null}
      {finals.data?.sourceUrl ? <T kind="small" color={t.accent} style={{ marginTop: 8 }} onPress={() => openUrl(finals.data.sourceUrl)}>Source: official TTU schedule</T> : null}
    </View>
  );
}
