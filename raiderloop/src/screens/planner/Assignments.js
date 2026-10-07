import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useApp } from '../../state/AppContext';
import { T, PostIt, PT, Button, Section, Empty, Check, Stamp } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import AssignmentForm from '../../sheets/AssignmentForm';
import CanvasCard from './CanvasCard';
import { dueLabel, metaLine } from '../../lib/time';

function group(list) {
  const now = new Date(); const end = new Date(now); end.setHours(23, 59, 59, 999);
  const week = new Date(end); week.setDate(week.getDate() + 6);
  const g = { Overdue: [], Today: [], 'This week': [], Later: [], Done: [] };
  for (const a of list) {
    if (a.done) { g.Done.push(a); continue; }
    const d = new Date(a.due);
    if (d < now) g.Overdue.push(a);
    else if (d <= end) g.Today.push(a);
    else if (d <= week) g['This week'].push(a);
    else g.Later.push(a);
  }
  return g;
}

const COLORS = { Overdue: 'pink', Today: 'yellow', 'This week': 'blue', Later: 'green', Done: 'lavender' };

export default function Assignments() {
  const { assignments, updateAssignment } = useApp();
  const [form, setForm] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const sorted = [...assignments].filter((a) => a.due).sort((a, b) => new Date(a.due) - new Date(b.due));
  const g = group(sorted);
  const open = sorted.filter((a) => !a.done).length;

  return (
    <View>
      <CanvasCard />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
        <T kind="hand" style={{ flex: 1 }}>{open ? `${open} to do` : 'nothing due — nice'}</T>
        <Button title="Add" icon="plus" small onPress={() => setForm('new')} />
      </View>
      {Object.entries(g).filter(([k, v]) => v.length && (k !== 'Done' || showDone)).map(([k, v]) => (
        <View key={k}>
          <Section title={k} />
          <PostIt color={COLORS[k]} seed={k}>
            {v.map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
                <Check checked={a.done} onPress={() => updateAssignment(a.id, { done: !a.done })} label={a.title} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <PT kind="bold" style={a.done ? { textDecorationLine: 'line-through' } : null} numberOfLines={2}>{a.title}</PT>
                  <PT kind="small">{metaLine(a.course, dueLabel(a.due))}</PT>
                </View>
                {a.source === 'canvas' ? <Stamp label="Canvas" color="#2F5DA8" /> : (
                  <Pressable onPress={() => setForm(a)} hitSlop={10} accessibilityLabel={`Edit ${a.title}`} style={{ marginLeft: 6 }}>
                    <Icon name="pencil" size={16} color="#4B5571" />
                  </Pressable>
                )}
              </View>
            ))}
          </PostIt>
        </View>
      ))}
      {!sorted.length ? <Empty icon="clipboard" title="No assignments yet" body="Add what's due and Flyer will remind you the day before and two hours before." action="Add assignment" onAction={() => setForm('new')} /> : null}
      {g.Done.length ? <Button title={showDone ? 'Hide finished' : `Show ${g.Done.length} finished`} kind="ghost" small onPress={() => setShowDone(!showDone)} style={{ marginTop: 14 }} /> : null}
      {form ? <AssignmentForm existing={form === 'new' ? null : form} onClose={() => setForm(null)} /> : null}
    </View>
  );
}
