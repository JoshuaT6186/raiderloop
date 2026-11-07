/**
 * Finals: the countdown and the term's key dates. Each class's exam
 * time comes from its syllabus, so students add it themselves as an
 * assignment (Flyer never guesses an exam time).
 */
import React from 'react';
import { View } from 'react-native';
import { useApp } from '../../state/AppContext';
import { PostIt, PT, Card, T, Row, Section } from '../../ui/Paper';
import { daysUntil } from '../../lib/time';
import { TERM } from '../../config';

export default function Finals() {
  const { scheduleItems, assignments } = useApp();
  const n = daysUntil(TERM.finalsStart);
  const classes = scheduleItems.filter((c) => !c.oneOff);
  const fmt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const examFor = (title) => (assignments || []).find((a) => !a.done && a.course === title && /final|exam/i.test(a.title || ''));

  return (
    <View>
      <PostIt color="lavender" tilt={-1} tape style={{ marginTop: 6 }}>
        <PT kind="tiny">{TERM.label}</PT>
        <PT kind="title" style={{ fontSize: 30, lineHeight: 36 }}>{n > 0 ? `${n} days` : n === 0 ? 'Finals start today' : 'Finals are underway'}</PT>
        <PT kind="small">Finals run {fmt(TERM.finalsStart)} to {fmt(TERM.finalsEnd)}. Last day of classes is {fmt(TERM.lastDay)}.</PT>
      </PostIt>
      {classes.length ? (
        <>
          <Section title="Your classes" hand="Add each final as an assignment from your syllabus" />
          <Card>
            {classes.map((c, i) => {
              const ex = examFor(c.title);
              return <Row key={c.id} title={c.title} meta={ex && ex.due ? `Final: ${new Date(ex.due).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Final not added yet'} last={i === classes.length - 1} />;
            })}
          </Card>
          <T kind="small" style={{ marginTop: 8 }}>Add a final in Assignments with "Final" in the name and it shows up here.</T>
        </>
      ) : null}
    </View>
  );
}
