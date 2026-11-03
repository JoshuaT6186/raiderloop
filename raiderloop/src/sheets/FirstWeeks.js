/**
 * Your first 30 days: a friendly checklist for new students. Each item
 * opens the right place (in Flyer, or the official TTU page).
 */
import React from 'react';
import { View, Pressable } from 'react-native';
import { Sheet, T, PostIt, PT, Check, Button } from '../ui/Paper';
import { Highlighter, SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { openUrl } from '../lib/links';
import { FIRST_WEEKS } from '../data/firstweeks';

export function FirstWeeksSheet({ onClose }) {
  const { t } = useTheme();
  const { firstWeeks, set, setTab, setSheet, setCampusMode } = useApp();
  const done = new Set(firstWeeks.done || []);
  const toggle = (id) => set((p) => ({ firstWeeks: { ...p.firstWeeks, on: p.firstWeeks.on === false ? false : true, done: done.has(id) ? p.firstWeeks.done.filter((x) => x !== id) : [...(p.firstWeeks.done || []), id] } }));
  const go = (item) => {
    if (item.url) { openUrl(item.url); return; }
    const o = item.open || {};
    if (o.tab) { onClose(); if (o.hub) setCampusMode('hub'); setTab(o.tab); }
    if (o.sheet) setSheet(o.sheet);
  };
  return (
    <Sheet title="Your first 30 days" hand="One thing at a time. You've got this." onClose={onClose} height={0.95}
      footer={<Button title="Hide this checklist" kind="ghost" small onPress={() => { set((p) => ({ firstWeeks: { ...p.firstWeeks, on: false } })); onClose(); }} />}>
      <Highlighter><T kind="handBig">{done.size} of {FIRST_WEEKS.length} done</T></Highlighter>
      {FIRST_WEEKS.map((item, i) => (
        <PostIt key={item.id} color={done.has(item.id) ? 'green' : ['yellow', 'blue', 'pink', 'orange', 'lavender'][i % 5]} seed={item.id} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Check checked={done.has(item.id)} onPress={() => toggle(item.id)} label={item.title} />
            <Pressable onPress={() => go(item)} style={{ flex: 1, marginLeft: 10 }} accessibilityRole="button">
              <PT kind="bold" style={done.has(item.id) ? { textDecorationLine: 'line-through', opacity: 0.7 } : null}>{item.title}</PT>
              <PT kind="small">{item.why}</PT>
            </Pressable>
            <Icon name={item.url ? 'link' : 'chevronRight'} size={18} color="#4B5571" />
          </View>
        </PostIt>
      ))}
      <SectionNote icon="info">Links go to official Texas Tech pages. You can bring this back in You → Settings.</SectionNote>
      <View style={{ height: 6, backgroundColor: t.paper }} />
    </Sheet>
  );
}
