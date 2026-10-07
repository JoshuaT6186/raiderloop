import React, { useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Sheet, T, Field, Chip, Button } from '../ui/Paper';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { relDayLabel } from '../lib/time';

const TIMES = [
  { label: '9 AM', h: 9, m: 0 }, { label: 'Noon', h: 12, m: 0 }, { label: '5 PM', h: 17, m: 0 },
  { label: '8 PM', h: 20, m: 0 }, { label: '11:59 PM', h: 23, m: 59 },
];

export default function AssignmentForm({ existing, onClose }) {
  const { t } = useTheme();
  const { scheduleItems, addAssignment, updateAssignment, removeAssignment } = useApp();
  const courses = [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => c.title))];
  const init = existing?.due ? new Date(existing.due) : null;
  const [title, setTitle] = useState(existing?.title || '');
  const [course, setCourse] = useState(existing?.course || courses[0] || '');
  const [dayOffset, setDayOffset] = useState(() => {
    if (!init) return 1;
    const a = new Date(init); a.setHours(0, 0, 0, 0); const b = new Date(); b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / 86400000);
  });
  const [time, setTime] = useState(() => (init ? TIMES.findIndex((x) => x.h === init.getHours() && x.m === init.getMinutes()) : 4));
  const [error, setError] = useState(null);

  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return { i, d }; }), []);

  const save = () => {
    if (!title.trim()) { setError('What is it? e.g. "Lab report 3"'); return; }
    const d = new Date(); d.setDate(d.getDate() + dayOffset);
    const tm = TIMES[time >= 0 ? time : 4]; d.setHours(tm.h, tm.m, 0, 0);
    const data = { title: title.trim(), course: course.trim(), due: d.toISOString() };
    if (existing) updateAssignment(existing.id, data); else addAssignment(data);
    onClose();
  };

  return (
    <Sheet title={existing ? 'Edit assignment' : 'New assignment'} hand="You'll get a reminder before it's due." onClose={onClose}
      footer={(
        <View>
          {error ? <T kind="small" color={t.redPen} style={{ marginBottom: 8 }}>{error}</T> : null}
          <Button title="Save" icon="check" onPress={save} />
          {existing ? <Button title="Delete" kind="danger" small onPress={() => { removeAssignment(existing.id); onClose(); }} style={{ marginTop: 10 }} /> : null}
        </View>
      )}>
      <Field label="What's due" placeholder="e.g. Problem set 4" value={title} onChangeText={setTitle} autoFocus={!existing} />
      <T kind="tiny" style={{ marginBottom: 6 }}>Class</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {courses.map((c) => <Chip key={c} label={c} active={course === c} onPress={() => setCourse(c)} />)}
      </View>
      <Field placeholder="Or type a class" value={course} onChangeText={setCourse} autoCapitalize="characters" />
      <T kind="tiny" style={{ marginBottom: 6 }}>Due day</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {days.map(({ i, d }) => <Chip key={i} label={i < 2 ? relDayLabel(d) : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })} active={dayOffset === i} onPress={() => setDayOffset(i)} />)}
      </ScrollView>
      <T kind="tiny" style={{ marginTop: 8, marginBottom: 6 }}>Time</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {TIMES.map((x, i) => <Chip key={x.label} label={x.label} active={time === i} onPress={() => setTime(i)} color="blue" />)}
      </View>
    </Sheet>
  );
}
