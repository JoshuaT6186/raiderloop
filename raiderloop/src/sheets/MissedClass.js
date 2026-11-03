/**
 * Missed-class kit: everything you need after missing a class, on one
 * page. What's due for that class, notes classmates chose to share, a
 * one-tap "anyone have notes?" ask, your group, and the professor's
 * office hours from your syllabus. You can share your own notes here
 * too, to help the next person.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, Linking } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Chip, Field, Loading, Toggle,
} from '../ui/Paper';
import { SectionNote, FolderTabs } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { pickPhoto, pickDocument, upload, uploadError } from '../lib/upload';
import { openUrl } from '../lib/links';
import { dueLabel } from '../lib/time';
import { SCHOOLS } from '../config';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DAY_JS = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };

/** The last few days this class met (from your schedule). */
export function recentMeetings(cls, n = 4, now = new Date()) {
  const out = [];
  const days = (cls?.days || []).map((d) => DAY_JS[d]);
  for (let i = 0; i < 21 && out.length < n; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    if (!days.length || days.includes(d.getDay())) out.push(ymd(d));
  }
  return out;
}
const pretty = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function ShareNotes({ course, date, onShared }) {
  const { showToast } = useApp();
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (args) => {
    setBusy(true);
    try { const r = await api.shareNotes({ course, date, ...args }); showToast(r.data.points ? `Shared · +${r.data.points}` : 'Shared'); setText(''); setUrl(''); onShared && onShared(); } catch (e) { showToast(uploadError(e)); }
    setBusy(false);
  };
  const file = async (fn) => { try { const f = await fn(); if (f) { setBusy(true); const path = await upload(f); await send({ uploadPath: path, title: f.name || '' }); } } catch (e) { showToast(uploadError(e)); setBusy(false); } };
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Button title="Photo of notes" icon="camera" small kind="ghost" disabled={busy} onPress={() => file(() => pickPhoto({ camera: true }))} style={{ marginRight: 8, marginBottom: 8 }} />
        <Button title="PDF" icon="file" small kind="ghost" disabled={busy} onPress={() => file(() => pickDocument({ types: ['application/pdf'] }))} style={{ marginBottom: 8 }} />
      </View>
      <Field placeholder="Or paste a link (slides, a doc)" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
      <Field placeholder="Or type a quick summary" value={text} onChangeText={setText} multiline inputStyle={{ minHeight: 70 }} />
      <Button title="Share with classmates" icon="send" small loading={busy} disabled={!text.trim() && !/\S+\.\S+/.test(url)} onPress={() => send({ text, url: url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : '' })} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

export function MissedClassSheet({ course: initialCourse, date: initialDate, onClose }) {
  const { t } = useTheme();
  const { scheduleItems, assignments, syllabi, groups, classmatesOptIn, set, showToast, setSheet, user, schoolId } = useApp();
  const classes = scheduleItems.filter((c) => !c.oneOff);
  const [course, setCourse] = useState(initialCourse || classes[0]?.title || '');
  const cls = classes.find((c) => c.title === course);
  const dates = useMemo(() => recentMeetings(cls), [course]);
  const [date, setDate] = useState(initialDate || dates[0] || ymd(new Date()));
  const [notes, setNotes] = useState(null);
  const [tab, setTab] = useState('kit');
  const [asked, setAsked] = useState(false);
  const signedIn = user && !user.isAnonymous;
  const code = (course || '').toUpperCase().replace(/\s+/g, ' ');
  const validCode = /^[A-Z]{2,5} \d{4}$/.test(code);
  const load = () => (signedIn && validCode ? api.getClassNotes({ course: code }).then((r) => setNotes(r.data)).catch(() => setNotes({ notes: [] })) : setNotes({ notes: [] }));
  useEffect(() => { setNotes(null); load(); }, [code, signedIn]);
  const due = assignments.filter((a) => !a.done && a.due && new Date(a.due) > new Date(Date.now() - 86400000) && (a.course || '').toUpperCase().replace(/\s+/g, ' ') === code).sort((a, b) => new Date(a.due) - new Date(b.due));
  const syl = syllabi.find((s) => s.course === code);
  const group = groups.find((g) => g.course === code);
  const dayNotes = (notes?.notes || []).filter((n) => n.date === date);
  const otherNotes = (notes?.notes || []).filter((n) => n.date !== date).slice(0, 10);
  const canvas = `https://${(SCHOOLS.find((s) => s.id === schoolId) || SCHOOLS[0]).canvasDomain}/`;
  const ask = async () => {
    try { const r = await api.askNotes({ course: code, date }); setAsked(true); showToast(r.data.asked ? `Asked ${r.data.asked} classmates` : 'Nobody else in that class is on Flyer yet'); } catch (e) { showToast(e.message); }
  };
  const optIn = async (v) => {
    set({ classmatesOptIn: v });
    try { await api.setClassmateOptIn({ optIn: v, courses: [...new Set(classes.map((c) => c.title))] }); load(); } catch (e) { showToast(e.message); }
  };
  const NoteCard = ({ n }) => (
    <Card key={n.id} style={{ marginBottom: 10 }}>
      <T kind="tiny">{n.name} · {pretty(n.date)}</T>
      {n.title ? <T kind="bold">{n.title}</T> : null}
      {n.text ? <T style={{ marginTop: 2 }}>{n.text}</T> : null}
      {n.kind === 'photo' ? <Image source={{ uri: n.url }} style={{ width: '100%', height: 220, marginTop: 8, borderRadius: 4, backgroundColor: t.paperDeep }} resizeMode="contain" /> : null}
      {n.kind === 'pdf' || n.kind === 'link' ? <Button title={n.kind === 'pdf' ? 'Open PDF' : 'Open link'} icon={n.kind === 'pdf' ? 'file' : 'link'} small kind="ghost" onPress={() => openUrl(n.url)} style={{ marginTop: 8, alignSelf: 'flex-start' }} /> : null}
    </Card>
  );
  return (
    <Sheet title="Missed a class?" hand="Get notes and links classmates chose to share." onClose={onClose} height={0.95}>
      {classes.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[...new Set(classes.map((c) => c.title))].map((c) => <Chip key={c} label={c} active={course === c} onPress={() => setCourse(c)} />)}</View>
      ) : <Field label="Class" value={course} onChangeText={setCourse} autoCapitalize="characters" placeholder="MATH 1314" />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>{dates.map((d) => <Chip key={d} label={pretty(d)} color="blue" active={date === d} onPress={() => setDate(d)} />)}</View>
      {!validCode ? <T kind="small" color={t.redPen}>Use the course code (like MATH 1314) so classmates can match it.</T> : null}
      <FolderTabs small value={tab} onChange={setTab} tabs={[{ id: 'kit', label: 'Catch up', icon: 'clipboard', color: 'yellow' }, { id: 'share', label: 'Share notes', icon: 'upload', color: 'green' }]} />
      {tab === 'kit' ? (
        <>
          <PostIt color="yellow" tape tilt={-0.6} style={{ marginBottom: 16 }}>
            <PT kind="title" style={{ fontSize: 19 }}>Due for {code || 'this class'}</PT>
            {due.length ? due.slice(0, 5).map((a) => <PT key={a.id} style={{ marginTop: 4 }}>• {a.title} · {dueLabel(a.due)}</PT>) : <PT kind="small">Nothing in your Planner for this class. Check Canvas to be sure.</PT>}
            <Button title="Open Canvas" icon="link" small kind="ghost" onPress={() => openUrl(canvas)} style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#fff' }} />
          </PostIt>
          <T kind="tiny" style={{ marginBottom: 6 }}>Notes from {pretty(date)}</T>
          {!signedIn ? <Card><T kind="small">Make an account to see notes classmates shared.</T></Card>
            : notes === null ? <Loading /> : dayNotes.length ? dayNotes.map((n) => <NoteCard key={n.id} n={n} />) : (
              <Card>
                <T kind="small">No notes for that day yet.</T>
                <Button title={asked ? 'Asked!' : 'Ask classmates for notes'} icon="hand" small disabled={asked || !validCode} onPress={ask} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
              </Card>
            )}
          {notes && !notes.optedIn && signedIn ? (
            <Card style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T kind="small" style={{ flex: 1 }}>Turn on "Find classmates" to see notes from everyone in your classes, not just friends. It shares your course codes, never your times or rooms.</T>
                <Toggle value={classmatesOptIn} onChange={optIn} label="Find classmates" />
              </View>
            </Card>
          ) : null}
          {otherNotes.length ? (
            <>
              <T kind="tiny" style={{ marginTop: 14, marginBottom: 6 }}>Other recent notes</T>
              {otherNotes.map((n) => <NoteCard key={n.id} n={n} />)}
            </>
          ) : null}
          <T kind="tiny" style={{ marginTop: 14, marginBottom: 6 }}>More help</T>
          <Card>
            {group ? <Row title={`Your group: ${group.name}`} meta="Ask what you missed" left={<Icon name="users" color={t.ink} />} onPress={() => setSheet({ type: 'group', id: group.id })} /> : null}
            {syl && syl.officeHours ? <Row title={`Office hours${syl.instructor ? ` · ${syl.instructor}` : ''}`} meta={syl.officeHours} left={<Icon name="clock" color={t.ink} />} /> : null}
            <Row title="Join an office hours line" meta="If your professor uses a Flyer queue" left={<Icon name="hourglass" color={t.ink} />} onPress={() => setSheet({ type: 'queue' })} />
            <Row title="Email your professor" meta="Opens Mail with a short note to edit" left={<Icon name="message" color={t.ink} />} last
              onPress={() => Linking.openURL(`mailto:?subject=${encodeURIComponent(`${code}: missed class ${pretty(date)}`)}&body=${encodeURIComponent(`Hi Professor,\n\nI missed class on ${pretty(date)}. Is there anything I should catch up on besides the posted material?\n\nThank you,\n`)}`).catch(() => {})} />
          </Card>
        </>
      ) : (
        <>
          {!signedIn ? <Card><T kind="small">Make an account to share notes.</T></Card> : validCode ? <ShareNotes course={code} date={date} onShared={load} /> : null}
          <SectionNote icon="heart">Shared notes are visible to classmates who opted in and to your friends. Photos are checked first. You can delete them any time in You → Me → What Flyer knows.</SectionNote>
        </>
      )}
    </Sheet>
  );
}
