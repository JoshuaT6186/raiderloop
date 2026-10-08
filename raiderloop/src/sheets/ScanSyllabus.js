/**
 * Scan a syllabus → check the list → add to Planner.
 * ------------------------------------------------------------
 * Photos of the pages (camera or library, up to 6) or a PDF go to
 * parseSyllabus, which returns only items whose calendar date is
 * written in the syllabus. Nothing is added until the student checks
 * the list: a wrong or missed due date is worse than none, so every
 * row shows its date and can be fixed or unticked first. Items already
 * in the Planner and dates that have passed start unticked.
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, Pressable, ScrollView, Image } from 'react-native';
import { Sheet, T, PT, PostIt, Button, Field, Chip, Check, Loading, Stamp } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { ImagePicker, DocumentPicker } from '../lib/native';
import { preparePhoto } from '../lib/photos';
import { api, errText } from '../lib/firebase';
import { uid } from '../lib/time';

const MAX_PAGES = 6;
const MAX_PDF_BYTES = 6 * 1024 * 1024;
const KIND_LABEL = { assignment: 'Due', quiz: 'Quiz', exam: 'Exam', project: 'Project', other: 'Due' };
const KIND_COLOR = { exam: '#C0392B', quiz: '#B7791F', project: '#2F5DA8' };
const TIMES = [
  { label: '8 AM', v: '08:00' }, { label: '9 AM', v: '09:00' }, { label: 'Noon', v: '12:00' },
  { label: '5 PM', v: '17:00' }, { label: '11:59 PM', v: '23:59' },
];

/* ---------- date helpers (local time, YYYY-MM-DD strings) ---------- */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const shift = (s, days) => { const d = fromYmd(s); d.setDate(d.getDate() + days); return ymd(d); };
const dateLabel = (s) => fromYmd(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const timeLabel = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === 12 && m === 0) return 'Noon';
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
// When the syllabus gives no time: exams go in the morning so the
// "day before" reminder lands the evening before; work is due 11:59 PM.
const defaultTime = (kind) => (kind === 'exam' || kind === 'quiz' ? '08:00' : '23:59');
const dueIso = (date, time) => { const d = fromYmd(date); const [h, m] = time.split(':').map(Number); d.setHours(h, m, 0, 0); return d.toISOString(); };
const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* global FileReader */
async function fileToBase64(uri) {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error("Couldn't open that file."));
    r.readAsDataURL(blob);
  });
}

/* ---------- Step 1: collect pages or a PDF ---------- */
function Pick({ onRead, busy, error }) {
  const { t } = useTheme();
  const [pages, setPages] = useState([]);
  const [msg, setMsg] = useState(null);
  const addPhotos = async (camera) => {
    setMsg(null);
    if (!ImagePicker) { setMsg("Photos aren't available in this build."); return; }
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setMsg(camera ? 'Camera is off for Flyer. Turn it on in Settings, or pick photos.' : 'Photo access is off. Turn it on in Settings, or use a PDF.'); return; }
      const left = MAX_PAGES - pages.length;
      const res = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: left, quality: 1 });
      if (res.canceled) return;
      const ready = [];
      for (const a of res.assets.slice(0, left)) {
        const p = await preparePhoto(a, { base64: true });
        if (p?.base64) ready.push({ id: uid('pg'), uri: p.uri, base64: p.base64, mediaType: p.mimeType });
      }
      setPages((prev) => [...prev, ...ready].slice(0, MAX_PAGES));
      if (ready.length < Math.min(res.assets.length, left)) setMsg("Some photos couldn't be opened. Try again.");
    } catch (e) { setMsg(errText(e, "Couldn't open those photos.")); }
  };
  const pickPdf = async () => {
    setMsg(null);
    if (!DocumentPicker) { setMsg("PDFs aren't available in this build. Use photos instead."); return; }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.length) return;
      const f = res.assets[0];
      if (f.size && f.size > MAX_PDF_BYTES) { setMsg('That PDF is over 6 MB. Screenshot the pages with dates on them and use photos instead.'); return; }
      const base64 = await fileToBase64(f.uri);
      onRead({ pdf: base64 });
    } catch (e) { setMsg(errText(e, "Couldn't open that PDF.")); }
  };

  if (busy) return <Loading label="Reading your syllabus… this can take about 30 seconds." />;
  return (
    <View>
      <PostIt color="blue" tilt={-0.5} padding={16}>
        <PT kind="bold">Pull every due date out of a syllabus</PT>
        <PT kind="small" style={{ marginTop: 4 }}>Use the PDF from Canvas, or take photos of the pages with the schedule. You'll check the list before anything is added.</PT>
      </PostIt>
      <Button title="Choose a PDF" icon="clipboard" onPress={pickPdf} style={{ marginTop: 16 }} />
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <Button title="Take a photo" icon="camera" kind="ghost" small onPress={() => addPhotos(true)} disabled={pages.length >= MAX_PAGES} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Pick photos" icon="image" kind="ghost" small onPress={() => addPhotos(false)} disabled={pages.length >= MAX_PAGES} style={{ flex: 1 }} />
      </View>
      {pages.length ? (
        <View style={{ marginTop: 14 }}>
          <T kind="tiny" style={{ marginBottom: 6 }}>{`${pages.length} of ${MAX_PAGES} pages`}</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {pages.map((p, i) => (
              <View key={p.id} style={{ marginRight: 10 }}>
                <Image source={{ uri: p.uri }} style={{ width: 74, height: 96, borderRadius: 6, borderWidth: 2, borderColor: '#1F2A44' }} accessibilityLabel={`Page ${i + 1}`} />
                <Pressable onPress={() => setPages((prev) => prev.filter((x) => x.id !== p.id))} hitSlop={10} accessibilityLabel={`Remove page ${i + 1}`}
                  style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: t.card, borderWidth: 2, borderColor: '#1F2A44', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={12} color="#1F2A44" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <Button title={`Read ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`} icon="scan" onPress={() => onRead({ pages: pages.map(({ base64, mediaType }) => ({ base64, mediaType })) })} style={{ marginTop: 14 }} />
        </View>
      ) : null}
      {msg || error ? <T kind="small" color={t.redPen} style={{ marginTop: 12 }}>{msg || error}</T> : null}
      <T kind="small" color={t.pencil} style={{ marginTop: 14 }}>Only dates written in the syllabus are pulled out. "Week 5" or "TBA" items are skipped, never guessed.</T>
    </View>
  );
}

/* ---------- Step 2: check the list ---------- */
function Review({ result, onDone, onBack }) {
  const { t } = useTheme();
  const { scheduleItems, assignments, addAssignment, showToast } = useApp();
  const courses = useMemo(() => [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => c.title))], [scheduleItems]);
  const [course, setCourse] = useState(() => {
    const read = squash(result.course);
    return (read && courses.find((c) => squash(c).includes(read) || read.includes(squash(c)))) || result.course || '';
  });
  const today = ymd(new Date());
  const [items, setItems] = useState(() => result.items.map((i) => ({
    id: uid('syl'), title: i.title, kind: i.kind, date: i.date, time: i.time || defaultTime(i.kind), timeListed: !!i.time, past: i.date < today,
  })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
  const isDup = (i) => assignments.some((a) => a.due && squash(a.title) === squash(i.title) && squash(a.course) === squash(course) && ymd(new Date(a.due)) === i.date);
  const [on, setOn] = useState(() => new Set(items.filter((i) => !i.past && !isDup(i)).map((i) => i.id)));
  const [editing, setEditing] = useState(null);
  const toggle = (id) => setOn((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const patch = (id, p) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...p, past: (p.date || x.date) < today } : x)));
  const chosen = items.filter((i) => on.has(i.id) && i.title.trim());

  const adding = useRef(false);
  const add = () => {
    if (adding.current) return;
    adding.current = true;
    chosen.forEach((i) => addAssignment({ title: i.title.trim(), course: course.trim(), due: dueIso(i.date, i.time), source: 'syllabus' }));
    showToast(`Added ${chosen.length} to your Planner`);
    onDone();
  };

  if (!items.length) {
    return (
      <View>
        <PostIt color="yellow"><PT kind="bold">No dated items found.</PT><PT kind="small" style={{ marginTop: 4 }}>The syllabus may only say "Week 5" or "see Canvas", or the photo may be hard to read. Try the PDF, or clearer photos of the schedule pages.</PT></PostIt>
        <Button title="Try again" icon="refresh" kind="ghost" onPress={onBack} style={{ marginTop: 14 }} />
      </View>
    );
  }
  return (
    <View>
      <T kind="tiny" style={{ marginBottom: 6 }}>Class</T>
      {courses.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {courses.map((c) => <Chip key={c} label={c} active={course === c} onPress={() => setCourse(c)} />)}
        </View>
      ) : null}
      <Field placeholder="e.g. MATH 1314" value={course} onChangeText={setCourse} autoCapitalize="characters" />
      <T kind="small" style={{ marginBottom: 8 }}>{`Found ${items.length}. Check each date against the syllabus. Tap a row to fix it.`}</T>
      {items.map((i) => {
        const dup = isDup(i);
        const open = editing === i.id;
        return (
          <View key={i.id} style={{ borderBottomWidth: 1, borderColor: t.border, paddingVertical: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Check checked={on.has(i.id)} onPress={() => toggle(i.id)} label={`Include ${i.title}`} />
              <Pressable onPress={() => setEditing(open ? null : i.id)} style={{ flex: 1, marginLeft: 10 }} accessibilityLabel={`Edit ${i.title}`}>
                <T kind="bold" numberOfLines={2} style={!on.has(i.id) ? { opacity: 0.5 } : null}>{i.title || '(no title)'}</T>
                <T kind="small" style={!on.has(i.id) ? { opacity: 0.5 } : null}>
                  {`${dateLabel(i.date)} · ${i.timeListed ? timeLabel(i.time) : `no time listed, set to ${timeLabel(i.time)}`}${i.past ? ' · already passed' : ''}${dup ? ' · already in Planner' : ''}`}
                </T>
              </Pressable>
              <Stamp label={KIND_LABEL[i.kind] || 'Due'} color={KIND_COLOR[i.kind] || t.pencil} />
            </View>
            {open ? (
              <View style={{ marginTop: 10, marginLeft: 34 }}>
                <Field value={i.title} onChangeText={(v) => patch(i.id, { title: v })} placeholder="What's due" />
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip label="−1 wk" onPress={() => patch(i.id, { date: shift(i.date, -7) })} />
                  <Chip label="−1 day" onPress={() => patch(i.id, { date: shift(i.date, -1) })} />
                  <T kind="bold" style={{ marginHorizontal: 6 }}>{dateLabel(i.date)}</T>
                  <Chip label="+1 day" onPress={() => patch(i.id, { date: shift(i.date, 1) })} />
                  <Chip label="+1 wk" onPress={() => patch(i.id, { date: shift(i.date, 7) })} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                  {TIMES.map((x) => <Chip key={x.v} label={x.label} color="blue" active={i.time === x.v} onPress={() => patch(i.id, { time: x.v, timeListed: true })} />)}
                </View>
                <Button title="Done" small kind="ghost" onPress={() => setEditing(null)} style={{ marginTop: 6, alignSelf: 'flex-start' }} />
              </View>
            ) : null}
          </View>
        );
      })}
      <Button title={chosen.length ? `Add ${chosen.length} to Planner` : 'Tick what to add'} icon="check" disabled={!chosen.length} onPress={add} style={{ marginTop: 16 }} />
      <Button title="Scan something else" small kind="ghost" onPress={onBack} style={{ marginTop: 10 }} />
    </View>
  );
}

export default function SyllabusSheet({ onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const read = async (payload) => {
    setBusy(true); setError(null);
    try {
      const r = await api.parseSyllabus(payload);
      setResult({ course: r.data.course, items: r.data.items || [] });
    } catch (e) { setError(errText(e, "Couldn't read that syllabus. Try again, or use clearer photos.")); }
    setBusy(false);
  };
  return (
    <Sheet title="Scan a syllabus" hand="Due dates straight into your Planner" onClose={onClose} height={0.94}>
      {result ? <Review result={result} onDone={onClose} onBack={() => setResult(null)} /> : <Pick onRead={read} busy={busy} error={error} />}
    </Sheet>
  );
}
