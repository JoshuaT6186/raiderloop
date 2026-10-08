/**
 * Scan a schedule screenshot → review → add.
 * Nothing is saved until the student confirms each class, because a
 * vision model can misread an image. Rows that can't be trusted yet
 * (missing time, unmatched building) must be fixed before adding.
 */
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Sheet, T, Button, Row, Loading, Card } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { ImagePicker } from '../lib/native';
import { api } from '../lib/firebase';
import { toMinutes, uid } from '../lib/time';
import { buildingById, matchBuildingName } from '../data/campus';
import ClassForm from './ClassForm';

function sniffImageMediaType(base64) {
  const head = (base64 || '').slice(0, 16);
  if (head.startsWith('iVBORw0KGgo')) return 'image/png';
  if (head.startsWith('/9j/')) return 'image/jpeg';
  if (head.startsWith('R0lGOD')) return 'image/gif';
  if (head.startsWith('UklGR')) return 'image/webp';
  return null;
}

const isValid = (i) => i.title && toMinutes(i.time) != null && toMinutes(i.endTime) != null && i.days?.length && i.buildingId;

function ReviewSheet({ raw, onConfirm, onClose }) {
  const { t } = useTheme();
  const [items, setItems] = useState(() => raw.map((c) => ({
    id: uid('scan'), title: c.title || '', time: c.time || '', endTime: c.endTime || '',
    days: Array.isArray(c.days) ? c.days : [], buildingId: matchBuildingName(c.building), buildingRaw: c.building || '',
  })));
  const [editing, setEditing] = useState(null);
  const valid = items.filter(isValid).map((i) => ({ ...i, place: `${buildingById(i.buildingId)?.name || ''}${i.room ? ` ${i.room}` : ''}`.trim(), type: 'class' }));

  return (
    <Sheet title="Check these first" hand="Scanning can misread a screenshot. Tap any class to fix it." onClose={onClose}
      footer={<Button title={`Add ${valid.length} ${valid.length === 1 ? 'class' : 'classes'}`} icon="check" disabled={!valid.length} onPress={() => onConfirm(valid)} />}>
      {items.length ? items.map((i, idx) => {
        const b = i.buildingId ? buildingById(i.buildingId) : null;
        return (
          <Row key={i.id} title={i.title || '(no title read)'} last={idx === items.length - 1}
            meta={`${i.days.join('/') || 'no days'} · ${i.time || '?'}–${i.endTime || '?'} · ${b ? b.name : i.buildingRaw ? `"${i.buildingRaw}" didn't match` : 'no building'}`}
            note={!isValid(i) ? 'Tap to fix before adding' : undefined}
            onPress={() => setEditing(i)}
            right={<Pressable onPress={() => setItems((p) => p.filter((x) => x.id !== i.id))} hitSlop={10}><Icon name="trash" size={18} color={t.redPen} /></Pressable>} />
        );
      }) : <T>Nothing readable came back from that image.</T>}
      {editing ? (
        <ClassForm existing={editing} onClose={() => setEditing(null)}
          onSave={(c) => { setItems((p) => p.map((x) => (x.id === editing.id ? { ...c, id: editing.id, buildingRaw: '' } : x))); setEditing(null); }}
          onRemove={() => { setItems((p) => p.filter((x) => x.id !== editing.id)); setEditing(null); }} />
      ) : null}
    </Sheet>
  );
}

export default function ScanSchedule({ onConfirm, compact }) {
  const { t } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [raw, setRaw] = useState(null);

  const start = async () => {
    setError(null);
    if (!ImagePicker) { setError("Scanning isn't available in this build."); return; }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError('Photo access is off. You can allow it in Settings, or add classes by hand.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ['images'] });
      if (result.canceled) return;
      setBusy(true);
      const asset = result.assets[0];
      const mediaType = sniffImageMediaType(asset.base64) || asset.mimeType || 'image/jpeg';
      const res = await api.parseSchedule({ imageBase64: asset.base64, mediaType });
      const classes = res?.data?.classes || [];
      setBusy(false);
      if (!classes.length) { setError("Couldn't find any classes. Try a clearer, full-screen screenshot."); return; }
      setRaw(classes);
    } catch (e) {
      setBusy(false);
      setError(e?.code === 'functions/resource-exhausted' ? e.message : `Couldn't read that image: ${e?.message || 'unknown error'}`);
    }
  };

  return (
    <View>
      {busy ? <Loading label="Reading your schedule…" /> : compact ? (
        <Button title="Scan a screenshot" icon="scan" kind="ghost" onPress={start} small />
      ) : (
        <Card onPress={start}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: t.postit.blue, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Icon name="scan" color="#1F2A44" />
            </View>
            <View style={{ flex: 1 }}>
              <T kind="bold">Scan your schedule</T>
              <T kind="small">Screenshot your schedule in Raiderlink, then pick it here.</T>
            </View>
            <Icon name="chevronRight" color={t.faint} />
          </View>
        </Card>
      )}
      {error ? <T kind="small" color={t.redPen} style={{ marginTop: 8 }}>{error}</T> : null}
      {raw ? <ReviewSheet raw={raw} onClose={() => setRaw(null)} onConfirm={(items) => { setRaw(null); onConfirm(items); }} /> : null}
    </View>
  );
}
