/**
 * GPA calculator — term and cumulative, on the 4.0 plus/minus scale.
 * Runs entirely on the phone; nothing here is ever uploaded.
 */
import React from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, PostIt, PT, Card, Button, Section, Field, Chip } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import { GRADE_OPTIONS, termGpa, cumulativeGpa, fmtGpa } from '../../lib/gpa';
import { uid } from '../../lib/time';

export default function Grades() {
  const { t } = useTheme();
  const { gradeCourses, priorGpa, priorCredits, scheduleItems, set } = useApp();
  const courses = gradeCourses;
  const update = (id, patch) => set((p) => ({ gradeCourses: p.gradeCourses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const add = (name = '') => set((p) => ({ gradeCourses: [...p.gradeCourses, { id: uid('g'), name, credits: '3', grade: '' }] }));
  const remove = (id) => set((p) => ({ gradeCourses: p.gradeCourses.filter((c) => c.id !== id) }));
  const importClasses = () => {
    const have = new Set(courses.map((c) => c.name));
    const titles = [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => c.title))].filter((x) => !have.has(x));
    set((p) => ({ gradeCourses: [...p.gradeCourses, ...titles.map((name) => ({ id: uid('g'), name, credits: '3', grade: '' }))] }));
  };
  const term = termGpa(courses);
  const cum = cumulativeGpa(courses, priorGpa, priorCredits);

  return (
    <View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        <PostIt color="yellow" tilt={-1.5} style={{ flex: 1, marginRight: 10 }} tape>
          <PT kind="tiny">This term</PT>
          <PT kind="title" style={{ fontSize: 34, lineHeight: 40 }}>{fmtGpa(term.gpa)}</PT>
          <PT kind="small">{term.hours} credit hours</PT>
        </PostIt>
        <PostIt color="green" tilt={1.2} style={{ flex: 1 }} tape>
          <PT kind="tiny">Cumulative</PT>
          <PT kind="title" style={{ fontSize: 34, lineHeight: 40 }}>{fmtGpa(cum)}</PT>
          <PT kind="small">{priorCredits ? 'with past terms' : 'add past terms below'}</PT>
        </PostIt>
      </View>

      <Section title="Courses" action={scheduleItems.length ? 'import classes' : undefined} onAction={importClasses} />
      {courses.map((c) => {
        return (
          <Card key={c.id} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Field placeholder="Course" value={c.name} onChangeText={(v) => update(c.id, { name: v })} style={{ flex: 1, marginBottom: 0, marginRight: 8 }} autoCapitalize="characters" />
              <Field placeholder="Cr" value={String(c.credits)} onChangeText={(v) => update(c.id, { credits: v.replace(/[^\d.]/g, '') })} style={{ width: 58, marginBottom: 0 }} keyboardType="decimal-pad" />
              <Pressable onPress={() => remove(c.id)} hitSlop={10} style={{ marginLeft: 10 }} accessibilityLabel="Remove course"><Icon name="trash" size={18} color={t.redPen} /></Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {GRADE_OPTIONS.map((g) => <Chip key={g} label={g} active={c.grade === g} onPress={() => update(c.id, { grade: c.grade === g ? '' : g })} />)}
            </ScrollView>
          </Card>
        );
      })}
      <Button title="Add a course" icon="plus" kind="ghost" small onPress={() => add()} />

      <Section title="Past terms" hand="From your transcript in Raiderlink" />
      <View style={{ flexDirection: 'row' }}>
        <Field label="GPA so far" placeholder="e.g. 3.42" value={priorGpa} onChangeText={(v) => set({ priorGpa: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" style={{ flex: 1, marginRight: 10 }} />
        <Field label="Credits so far" placeholder="e.g. 30" value={priorCredits} onChangeText={(v) => set({ priorCredits: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" style={{ flex: 1 }} />
      </View>
      <T kind="small">Estimates only. Your official GPA is on your transcript. Pass/fail, withdrawn, and incomplete courses don't count toward GPA.</T>
    </View>
  );
}
