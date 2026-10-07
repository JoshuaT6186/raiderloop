import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Page } from '../ui/Page';
import { T } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useApp } from '../state/AppContext';
import Classes from './planner/Classes';
import Assignments from './planner/Assignments';
import Grades from './planner/Grades';
import Finals from './planner/Finals';

const TABS = [
  { id: 'classes', label: 'Classes', icon: 'schedule', color: 'blue' },
  { id: 'due', label: 'Due', icon: 'clipboard', color: 'yellow' },
  { id: 'gpa', label: 'GPA', icon: 'percent', color: 'green' },
  { id: 'finals', label: 'Finals', icon: 'cap', color: 'lavender' },
];

export default function Planner() {
  const { t } = useTheme();
  const { assignments } = useApp();
  const [tab, setTab] = useState('classes');
  const overdue = assignments.some((a) => !a.done && a.due && new Date(a.due) < new Date());
  return (
    <Page eyebrow="your notebook" title="Planner">
      <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 10 }}>
        {TABS.map((x) => {
          const on = tab === x.id;
          return (
            <Pressable key={x.id} onPress={() => setTab(x.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, marginHorizontal: 3, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 1.5, borderBottomWidth: on ? 0 : 1.5, borderColor: on ? '#1F2A44' : t.border, backgroundColor: on ? t.postit[x.color] : t.card, transform: [{ translateY: on ? -3 : 0 }] }}>
              <Icon name={x.icon} size={18} color={on ? '#1F2A44' : t.pencil} />
              <T kind="small" style={{ fontWeight: '700', fontSize: 12 }} color={on ? '#1F2A44' : t.pencil}>{x.label}</T>
              {x.id === 'due' && overdue ? <View style={{ position: 'absolute', top: 5, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: t.redPen }} /> : null}
            </Pressable>
          );
        })}
      </View>
      {tab === 'classes' ? <Classes /> : null}
      {tab === 'due' ? <Assignments /> : null}
      {tab === 'gpa' ? <Grades /> : null}
      {tab === 'finals' ? <Finals /> : null}
    </Page>
  );
}
