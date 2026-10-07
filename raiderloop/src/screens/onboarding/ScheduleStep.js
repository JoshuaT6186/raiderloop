import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, Button, Card, PostIt, PT } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import { Shell, Heading } from './Shell';
import ClassForm from '../../sheets/ClassForm';
import ScanSchedule from '../../sheets/ScanSchedule';

export default function ScheduleStep() {
  const { t } = useTheme();
  const { set, scheduleItems, addClass, updateClass, removeClass } = useApp();
  const [form, setForm] = useState(null); // null | 'new' | item
  return (
    <Shell step="schedule" onBack={() => set({ onboardStep: 'interests' })}
      footer={<Button title={scheduleItems.length ? 'Continue' : 'Skip — add classes later'} kind={scheduleItems.length ? 'primary' : 'ghost'} icon="chevronRight" onPress={() => set({ onboardStep: 'permissions' })} />}>
      <Heading eyebrow="step six" title="Add your classes" sub="Flyer reminds you before each one, with the weather for the walk over." />
      <ScanSchedule onConfirm={(items) => items.forEach((i) => addClass(i))} />
      <Card style={{ marginTop: 12 }} onPress={() => setForm('new')}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: t.postit.yellow, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Icon name="pencil" color="#1F2A44" />
          </View>
          <View style={{ flex: 1 }}>
            <T kind="bold">Add one by hand</T>
            <T kind="small">Course, days, time, building.</T>
          </View>
          <Icon name="plus" color={t.faint} />
        </View>
      </Card>

      {scheduleItems.length ? (
        <PostIt color="yellow" tilt={-0.8} tape style={{ marginTop: 22 }}>
          <PT kind="tiny" style={{ marginBottom: 4 }}>Your week so far</PT>
          {scheduleItems.map((c) => (
            <Pressable key={c.id} onPress={() => setForm(c)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <PT kind="bold">{c.title}</PT>
                <PT kind="small">{(c.days || []).join('/')} · {c.time}–{c.endTime} · {c.place}</PT>
              </View>
              <Icon name="pencil" size={16} color="#4B5571" />
            </Pressable>
          ))}
        </PostIt>
      ) : null}

      {form ? (
        <ClassForm existing={form === 'new' ? null : form} onClose={() => setForm(null)}
          onSave={(c) => { if (form === 'new') addClass(c); else updateClass(form.id, c); setForm(null); }}
          onRemove={form === 'new' ? null : () => { removeClass(form.id); setForm(null); }} />
      ) : null}
    </Shell>
  );
}
