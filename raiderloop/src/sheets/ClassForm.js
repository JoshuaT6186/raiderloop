/**
 * Add / edit a class. Used by onboarding, the Schedule tab, and the
 * scan review step, so every class in the app is validated the same
 * way: a title, at least one day, a real start before a real end,
 * and a building picked from the real list (never free text).
 */
import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Sheet, T, Field, Chip, Button, Row } from '../ui/Paper';
import { useTheme } from '../theme/ThemeContext';
import { WEEK_DAYS, WEEK_DAY_LABELS, toMinutes, minutesToLabel } from '../lib/time';
import { BUILDINGS, buildingById, catLabel } from '../data/campus';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am–10pm
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function TimePicker({ label, value, onChange }) {
  const { t } = useTheme();
  const mins = toMinutes(value);
  const h = mins != null ? Math.floor(mins / 60) : null;
  const m = mins != null ? mins % 60 : null;
  const setH = (nh) => onChange(minutesToLabel(nh * 60 + (m ?? 0)));
  const setM = (nm) => onChange(minutesToLabel((h ?? 9) * 60 + nm));
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T kind="tiny">{label}</T>
        <T kind="hand" color={value ? t.accent : t.faint}>{value || 'pick a time'}</T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
        {HOURS.map((hr) => (
          <Chip key={hr} label={`${hr % 12 === 0 ? 12 : hr % 12}${hr < 12 ? 'a' : 'p'}`} active={h === hr} onPress={() => setH(hr)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {MINUTES.map((mn) => (
          <Chip key={mn} label={`:${String(mn).padStart(2, '0')}`} active={m === mn && h != null} onPress={() => setM(mn)} color="blue" />
        ))}
      </ScrollView>
    </View>
  );
}

export default function ClassForm({ existing, onSave, onRemove, onClose }) {
  const { t } = useTheme();
  const [title, setTitle] = useState(existing?.title || '');
  const [days, setDays] = useState(existing?.days || []);
  const [time, setTime] = useState(existing?.time || '');
  const [endTime, setEndTime] = useState(existing?.endTime || '');
  const [buildingId, setBuildingId] = useState(existing?.buildingId || null);
  const [room, setRoom] = useState(existing?.room || '');
  const [section, setSection] = useState(existing?.section || '');
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return BUILDINGS.filter((b) => b.name.toLowerCase().includes(s) || (b.short || '').toLowerCase().includes(s)).slice(0, 6);
  }, [q]);
  const b = buildingId ? buildingById(buildingId) : null;

  const toggleDay = (d) => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : WEEK_DAYS.filter((x) => p.includes(x) || x === d)));

  const save = () => {
    if (!title.trim()) return setError('Add the course name or code, like "CS 1412".');
    if (!days.length) return setError('Pick at least one day.');
    const s = toMinutes(time); const e = toMinutes(endTime);
    if (s == null || e == null) return setError('Pick a start and end time.');
    if (e <= s) return setError('The class has to end after it starts.');
    if (!buildingId) return setError('Pick the building from the list so directions work.');
    onSave({
      ...(existing || {}), title: title.trim().toUpperCase().replace(/\s+/g, ' '), days, time, endTime, buildingId, room: room.trim(), section: section.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
      place: `${buildingById(buildingId)?.name || ''}${room.trim() ? ` ${room.trim()}` : ''}`, type: 'class',
    });
  };

  return (
    <Sheet title={existing?.title ? 'Edit class' : 'Add a class'} hand="Exactly as it shows on your schedule." onClose={onClose}
      footer={(
        <View>
          {error ? <T kind="small" color={t.redPen} style={{ marginBottom: 8 }}>{error}</T> : null}
          <Button title="Save class" icon="check" onPress={save} />
          {onRemove ? <Button title="Remove class" kind="danger" onPress={onRemove} style={{ marginTop: 10 }} small /> : null}
        </View>
      )}>
      <Field label="Course" placeholder="e.g. MATH 1320" value={title} onChangeText={setTitle} autoCapitalize="characters" />
      <T kind="tiny" style={{ marginBottom: 6 }}>Days</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {WEEK_DAYS.map((d) => <Chip key={d} label={WEEK_DAY_LABELS[d]} active={days.includes(d)} onPress={() => toggleDay(d)} />)}
      </View>
      <TimePicker label="Starts" value={time} onChange={setTime} />
      <TimePicker label="Ends" value={endTime} onChange={setEndTime} />
      <T kind="tiny" style={{ marginBottom: 6 }}>Building</T>
      {b ? (
        <Row title={b.name} meta={catLabel(b.kind)} right={(
          <Pressable onPress={() => { setBuildingId(null); setQ(''); }} hitSlop={10}><T kind="hand" color={t.redPen}>change</T></Pressable>
        )} />
      ) : (
        <View>
          <Field placeholder="Search buildings…" value={q} onChangeText={setQ} style={{ marginBottom: 4 }} />
          {matches.map((x, i) => <Row key={x.id} title={x.name} meta={catLabel(x.kind)} onPress={() => { setBuildingId(x.id); setQ(''); }} last={i === matches.length - 1} />)}
          {q && !matches.length ? <T kind="small">No building matches "{q}".</T> : null}
        </View>
      )}
      <Field label="Room (optional)" placeholder="e.g. 00077" value={room} onChangeText={setRoom} style={{ marginTop: 12 }} />
      <Field label="Section (optional)" placeholder="e.g. 012. Matches you with your exact section" value={section} onChangeText={setSection} autoCapitalize="characters" maxLength={6} />
    </Sheet>
  );
}
