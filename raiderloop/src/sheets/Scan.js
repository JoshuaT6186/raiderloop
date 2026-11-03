/**
 * Flyer scanner and syllabus drop.
 *   • Snap a paper flyer → Flyer reads the event → save it, put it on
 *     your schedule, send it to friends, or post it to Discover.
 *   • Drop in a syllabus (PDF or photos) → Flyer finds every dated
 *     exam and assignment → you check them → they go in your Planner.
 * Nothing is added until you confirm, because reading can be wrong.
 */
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Field, Loading, Check, Chip,
} from '../ui/Paper';
import { Polaroid } from '../ui/Scrap';
import { SectionNote, Pill } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { pickPhoto, pickDocument, upload, uploadError } from '../lib/upload';
import { shareThing } from '../lib/share';
import { toMinutes, uid, metaLine } from '../lib/time';
import { TERM } from '../config';

/* "2026-11-06" + "7:00 PM" → Date, local time. */
export function toDate(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const [y, m, d] = date.split('-').map(Number);
  const mins = toMinutes(time);
  return new Date(y, m - 1, d, mins != null ? Math.floor(mins / 60) : 23, mins != null ? mins % 60 : 59, 0);
}
const prettyDate = (date) => { const d = toDate(date, '12:00 PM'); return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''; };

/* ---------- Flyer scanner ---------- */
export function FlyerScanSheet({ onClose }) {
  const { t } = useTheme();
  const { toggleSave, isSaved, showToast, setSheet, user } = useApp();
  const [photo, setPhoto] = useState(null);
  const [ev, setEv] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const scan = async (camera) => {
    setError(null);
    try {
      const p = await pickPhoto({ camera, base64: true, maxSide: 1600 });
      if (!p) return;
      setPhoto(p); setBusy(true);
      const r = await api.scanFlyer({ imageBase64: p.base64, mediaType: 'image/jpeg' });
      const e = r.data.event;
      if (!e.isEvent) setError("That doesn't look like an event flyer. Try a straight-on photo of the whole poster.");
      setEv(e);
    } catch (e) { setError(uploadError(e)); }
    setBusy(false);
  };
  const set = (patch) => setEv((p) => ({ ...p, ...patch }));
  const when = ev ? toDate(ev.date, ev.time) : null;
  const savedEvent = ev ? {
    id: `scan-${ev.title}-${ev.date}`.replace(/[^A-Za-z0-9-]/g, '').slice(0, 60), title: ev.title, date: prettyDate(ev.date), time: ev.time,
    location: ev.location, org: ev.host, desc: ev.description, startsAt: when ? when.toISOString() : null, sourceUrl: ev.url || null,
  } : null;
  const post = () => setSheet({ type: 'publicNew', kind: 'event', draft: { title: ev.title, body: ev.description, when: when ? when.toISOString() : null, placeName: ev.location, photo } });
  return (
    <Sheet title="Scan a flyer" hand="Point at a poster. Flyer reads the event for you." onClose={onClose} height={0.95}
      footer={ev && ev.isEvent ? (
        <View>
          <View style={{ flexDirection: 'row' }}>
            <Button title={isSaved(savedEvent.id) ? 'Saved' : 'Save event'} icon="bookmark" kind={isSaved(savedEvent.id) ? 'highlight' : 'primary'} disabled={!ev.title} onPress={() => { toggleSave(savedEvent); showToast(isSaved(savedEvent.id) ? 'Removed' : "Saved. You'll get a reminder."); }} style={{ flex: 1, marginRight: 8 }} />
            <Button title="Send" icon="share" kind="ghost" onPress={() => shareThing('event', { title: ev.title, when: metaLine(prettyDate(ev.date), ev.time), where: ev.location, desc: ev.description, url: ev.url, startsAt: savedEvent.startsAt })} style={{ flex: 0.7 }} />
          </View>
          {user && !user.isAnonymous ? <Button title="Post it to Discover" icon="megaphone" kind="ghost" small onPress={post} style={{ marginTop: 10 }} /> : null}
        </View>
      ) : null}>
      {!photo ? (
        <PostIt color="yellow" tilt={-1} style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Icon name="scan" size={44} color="#1F2A44" />
          <PT kind="bold" style={{ marginTop: 8, textAlign: 'center' }}>Snap the whole flyer, straight on</PT>
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <Button title="Take a photo" icon="camera" small onPress={() => scan(true)} style={{ marginRight: 8 }} />
            <Button title="Library" icon="image" small kind="ghost" onPress={() => scan(false)} style={{ backgroundColor: '#fff' }} />
          </View>
        </PostIt>
      ) : (
        <Polaroid uri={photo.uri} caption={ev?.title || 'Reading…'} photoHeight={180} tilt={-1.5} onPress={() => { setPhoto(null); setEv(null); }} />
      )}
      {busy ? <Loading label="Reading the flyer…" /> : null}
      {error ? <T kind="small" color={t.redPen} style={{ marginTop: 10 }}>{error}</T> : null}
      {ev && ev.isEvent ? (
        <View style={{ marginTop: 16 }}>
          <T kind="small" style={{ marginBottom: 8 }}>Check what Flyer read. Fix anything that's off.</T>
          <Field label="Event" value={ev.title} onChangeText={(v) => set({ title: v })} />
          <View style={{ flexDirection: 'row' }}>
            <Field label="Date (YYYY-MM-DD)" value={ev.date} onChangeText={(v) => set({ date: v })} style={{ flex: 1, marginRight: 8 }} />
            <Field label="Time" value={ev.time} onChangeText={(v) => set({ time: v })} placeholder="7:00 PM" style={{ flex: 0.8 }} />
          </View>
          {ev.date && !when ? <T kind="small" color={t.redPen}>Use a date like 2026-11-06.</T> : null}
          <Field label="Where" value={ev.location} onChangeText={(v) => set({ location: v })} />
          <Field label="Host" value={ev.host} onChangeText={(v) => set({ host: v })} />
          <Field label="About" value={ev.description} onChangeText={(v) => set({ description: v })} multiline inputStyle={{ minHeight: 70 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {ev.price ? <Pill label={ev.price} icon="tag" /> : null}
            {ev.rsvp ? <Pill label={`RSVP: ${ev.rsvp}`} icon="ticket" /> : null}
          </View>
        </View>
      ) : null}
      <SectionNote icon="lock">The photo is read and then thrown away. It isn't saved or posted unless you post it.</SectionNote>
    </Sheet>
  );
}

/* ---------- Syllabus drop ---------- */
const TYPE_COLOR = { exam: 'pink', quiz: 'orange', project: 'lavender', paper: 'lavender', presentation: 'blue', lab: 'green', assignment: 'yellow', other: 'yellow' };

export function SyllabusSheet({ course: initialCourse, onClose }) {
  const { t } = useTheme();
  const { addAssignment, assignments, set, syllabi, showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState({});
  const [course, setCourse] = useState(initialCourse || '');
  const read = async (fn) => {
    setError(null);
    try {
      const f = await fn();
      if (!f) return;
      setBusy(true);
      const path = await upload(f);
      const r = await api.parseSyllabus({ uploadPath: path, term: TERM.label });
      setResult(r.data);
      if (r.data.course) setCourse(r.data.course);
      setPicked(Object.fromEntries((r.data.items || []).map((i, k) => [k, true])));
      if (!(r.data.items || []).length) setError("Flyer couldn't find dated assignments in that file. Some syllabi only list a weekly schedule.");
    } catch (e) { setError(uploadError(e)); }
    setBusy(false);
  };
  const add = () => {
    const items = (result.items || []).filter((_, k) => picked[k]);
    let n = 0;
    items.forEach((i) => {
      const due = toDate(i.due, i.time || '11:59 PM');
      if (!due) return;
      const id = uid('syl');
      if (assignments.some((a) => a.title === i.title && a.due && a.due.slice(0, 10) === due.toISOString().slice(0, 10))) return;
      addAssignment({ id, title: i.title, course: course.toUpperCase(), due: due.toISOString(), type: i.type, weight: i.weight, source: 'syllabus' });
      n++;
    });
    const meta = { course: course.toUpperCase(), title: result.title || '', instructor: result.instructor || '', officeHours: result.officeHours || '', addedAt: new Date().toISOString() };
    set({ syllabi: [...syllabi.filter((s) => s.course !== meta.course), meta].slice(-20) });
    showToast(`Added ${n} to your Planner`);
    onClose();
  };
  const count = Object.values(picked).filter(Boolean).length;
  return (
    <Sheet title="Drop in a syllabus" hand="Flyer finds every dated exam and assignment." onClose={onClose} height={0.95}
      footer={result && (result.items || []).length ? <Button title={`Add ${count} to my Planner`} icon="check" disabled={!count || !course.trim()} onPress={add} /> : null}>
      {!result ? (
        <PostIt color="lavender" tilt={-1} style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="file" size={44} color="#1F2A44" />
          <PT kind="bold" style={{ marginTop: 8, textAlign: 'center' }}>The PDF from Canvas works best</PT>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
            <Button title="Choose PDF" icon="file" small disabled={busy} onPress={() => read(() => pickDocument({ types: ['application/pdf'] }))} style={{ marginRight: 8, marginBottom: 6 }} />
            <Button title="Photo of it" icon="camera" small kind="ghost" disabled={busy} onPress={() => read(() => pickPhoto({ camera: true }))} style={{ backgroundColor: '#fff', marginBottom: 6 }} />
          </View>
        </PostIt>
      ) : null}
      {busy ? <Loading label="Reading the syllabus… (this can take a minute)" /> : null}
      {error ? <T kind="small" color={t.redPen} style={{ marginTop: 10 }}>{error}</T> : null}
      {result ? (
        <View>
          <Field label="Course" value={course} onChangeText={setCourse} autoCapitalize="characters" placeholder="MATH 1314" />
          {result.instructor || result.officeHours ? (
            <Card style={{ marginBottom: 12 }}>
              {result.instructor ? <T kind="bold">{result.instructor}</T> : null}
              {result.officeHours ? <T kind="small">Office hours: {result.officeHours}</T> : null}
              <T kind="small" color={t.pencil} style={{ marginTop: 4 }}>Saved on the class page so you can find it later.</T>
            </Card>
          ) : null}
          {(result.items || []).map((i, k) => (
            <Pressable key={k} onPress={() => setPicked((p) => ({ ...p, [k]: !p[k] }))} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: t.rule, borderStyle: 'dashed' }}>
              <Check checked={!!picked[k]} onPress={() => setPicked((p) => ({ ...p, [k]: !p[k] }))} label={i.title} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <T kind="bold" numberOfLines={2}>{i.title}</T>
                <T kind="small">{[prettyDate(i.due), i.time, i.weight].filter(Boolean).join(' · ')}</T>
              </View>
              <Chip label={i.type} color={TYPE_COLOR[i.type] || 'yellow'} active style={{ marginRight: 0, marginBottom: 0 }} />
            </Pressable>
          ))}
          <SectionNote icon="info">Double-check against Canvas. If your professor changes a date, update it in the Planner.</SectionNote>
        </View>
      ) : null}
    </Sheet>
  );
}
