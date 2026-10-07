/**
 * Classes: a tappable week strip (bars sized by hours in class), a
 * day timeline with a live "now" line, weekly totals, scan, add,
 * and one-tap calendar export.
 */
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, PostIt, PT, Card, Button, Section, Empty, Highlight } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import ClassForm from '../../sheets/ClassForm';
import ScanSchedule from '../../sheets/ScanSchedule';
import {
  WEEK_DAYS, WEEK_DAY_LABELS, WEEK_DAY_FULL, itemsOnDay, todayCode, toMinutes, sortByTime, metaLine,
} from '../../lib/time';
import { useNow } from '../../lib/hooks';
import { exportToCalendar } from '../../lib/calendarExport';
import { buildingById, walkLabel } from '../../data/campus';
import { openDirections } from '../../lib/links';

function hoursOn(items, d) {
  return itemsOnDay(items, d).reduce((s, c) => s + Math.max(0, (toMinutes(c.endTime) ?? 0) - (toMinutes(c.time) ?? 0)), 0) / 60;
}

export default function Classes() {
  const { t } = useTheme();
  const { scheduleItems, addClass, updateClass, removeClass, assignments, showToast } = useApp();
  const now = useNow(30000);
  const [day, setDay] = useState(todayCode(now));
  const [form, setForm] = useState(null);
  const [exporting, setExporting] = useState(false);
  const classes = scheduleItems.filter((c) => !c.oneOff || (c.days || []).includes(todayCode(now)));
  const max = Math.max(1, ...WEEK_DAYS.map((d) => hoursOn(classes, d)));
  const list = sortByTime(itemsOnDay(classes, day));
  const nowM = now.getHours() * 60 + now.getMinutes();
  const isToday = day === todayCode(now);
  const total = WEEK_DAYS.reduce((s, d) => s + itemsOnDay(classes.filter((c) => !c.oneOff), d).length, 0);
  const hrs = WEEK_DAYS.reduce((s, d) => s + hoursOn(classes.filter((c) => !c.oneOff), d), 0);
  const busiest = WEEK_DAYS.reduce((b, d) => (hoursOn(classes, d) > hoursOn(classes, b) ? d : b), 'M');

  const doExport = async () => {
    setExporting(true);
    try {
      const n = await exportToCalendar({ scheduleItems, assignments });
      showToast(`Added ${n} ${n === 1 ? 'item' : 'items'} to your "Flyer" calendar`);
    } catch (e) { showToast(e.message); }
    setExporting(false);
  };

  return (
    <View>
      {/* week strip */}
      <Card style={{ marginTop: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 104 }}>
          {WEEK_DAYS.map((d) => {
            const h = hoursOn(classes, d); const n = itemsOnDay(classes, d).length; const on = d === day;
            return (
              <Pressable key={d} onPress={() => setDay(d)} accessibilityRole="button" accessibilityLabel={`${WEEK_DAY_FULL[d]}, ${n} classes`}
                style={{ alignItems: 'center', width: 38, paddingTop: 4, borderRadius: 10, backgroundColor: on ? t.highlight : 'transparent' }}>
                <T kind="small" style={{ fontSize: 11 }} color={on ? '#1F2A44' : t.pencil}>{n || ''}</T>
                <View style={{ width: 16, height: Math.max(4, (h / max) * 56), borderRadius: 4, backgroundColor: n ? (on ? '#1F2A44' : t.accent) : t.border, marginVertical: 4 }} />
                <T kind="bold" style={{ fontSize: 12 }} color={on ? '#1F2A44' : d === todayCode(now) ? t.accent : t.inkSoft}>{WEEK_DAY_LABELS[d]}</T>
              </Pressable>
            );
          })}
        </View>
      </Card>
      {total ? (
        <T kind="hand" style={{ marginTop: 8 }}>{total} classes · {hrs.toFixed(1)} hrs a week · busiest on {WEEK_DAY_FULL[busiest]}</T>
      ) : null}

      <Section title={isToday ? 'Today' : WEEK_DAY_FULL[day]} action="add class" onAction={() => setForm('new')} />
      {list.length ? list.map((c) => {
        const s = toMinutes(c.time); const e = toMinutes(c.endTime);
        const live = isToday && nowM >= s && nowM < e; const done = isToday && nowM >= e;
        const b = buildingById(c.buildingId);
        return (
          <View key={c.id} style={{ flexDirection: 'row', marginBottom: 12, opacity: done ? 0.55 : 1 }}>
            <View style={{ width: 62, paddingTop: 10 }}>
              <T kind="num" style={{ fontSize: 13 }}>{c.time}</T>
              <T kind="small" style={{ fontSize: 11 }}>{c.endTime}</T>
            </View>
            <View style={{ flex: 1 }}>
              <PostIt color={c.type === 'event' ? 'pink' : live ? 'yellow' : 'blue'} seed={c.id} onPress={() => setForm(c)} padding={12}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <PT kind="bold" style={{ flex: 1 }}>{c.title}</PT>
                  {live ? <Highlight><PT kind="tiny">now</PT></Highlight> : null}
                </View>
                <PT kind="small">{metaLine(c.place, b ? walkLabel(b) : null)}</PT>
                {b && !done ? (
                  <Pressable onPress={() => openDirections(b)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }} hitSlop={6}>
                    <Icon name="walk" size={15} color="#2F5DA8" /><PT kind="small" style={{ marginLeft: 4, color: '#2F5DA8', fontWeight: '700' }}>Directions</PT>
                  </Pressable>
                ) : null}
              </PostIt>
            </View>
          </View>
        );
      }) : <Empty icon="sun" title={`Nothing on ${WEEK_DAY_FULL[day]}`} body="A free day — or add a class." action="Add a class" onAction={() => setForm('new')} />}

      <Section title="Tools" icon="pencil" />
      <ScanSchedule compact onConfirm={(items) => { items.forEach((i) => addClass(i)); showToast(`Added ${items.length} classes`); }} />
      <Button title="Export week to my calendar" icon="calendarPlus" kind="ghost" small loading={exporting} onPress={doExport} style={{ marginTop: 10 }} />
      <T kind="small" style={{ marginTop: 6 }}>Creates a separate "Flyer" calendar with your classes (repeating through the last day of classes) and assignment due dates. Re-export any time to update it.</T>

      {form ? (
        <ClassForm existing={form === 'new' ? null : form} onClose={() => setForm(null)}
          onSave={(c) => { if (form === 'new') addClass(c); else updateClass(form.id, c); setForm(null); }}
          onRemove={form === 'new' ? null : () => { removeClass(form.id); setForm(null); }} />
      ) : null}
    </View>
  );
}
