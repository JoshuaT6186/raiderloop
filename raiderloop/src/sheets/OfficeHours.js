/**
 * Office hours queue. A professor, TA, or tutor opens a line and puts
 * the code (or QR) on the door or the screen. Students join from
 * anywhere and see their place; Flyer pings them when they're next
 * and when they're up, so nobody has to wait in the hallway.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Field, Loading, Empty, Row,
} from '../ui/Paper';
import { QRCode, SectionNote, StampThunk, RubberStamp } from '../ui/Kit';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, listenDoc, listenQueueEntries } from '../lib/firebase';
import { shareUrl } from '../lib/share';
import { linkFor } from '../lib/deeplinks';
import { ScannerSheet } from './Scanner';

function HostView({ code }) {
  const { t } = useTheme();
  const { showToast, set } = useApp();
  const [q, setQ] = useState(null);
  const [entries, setEntries] = useState([]);
  useEffect(() => listenDoc(`queues/${code}`, setQ), [code]);
  useEffect(() => listenQueueEntries(code, setEntries), [code]);
  if (!q) return <Loading />;
  const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
  const waiting = (q.waiting || []).map((id) => byId[id]).filter(Boolean);
  const serving = q.serving ? byId[q.serving] : null;
  const url = linkFor('queue', code);
  return (
    <View>
      <PostIt color="pink" tilt={-0.8} padding={16} style={{ alignItems: 'center' }}>
        <PT kind="tiny">{q.open ? 'Your line is open' : 'Closed'}</PT>
        <QRCode value={url} size={170} />
        <PT kind="title" style={{ marginTop: 6 }}>Code {code}</PT>
        <PT kind="small">Put this on the door or the screen.</PT>
      </PostIt>
      <Button title="Share the link" icon="share" small kind="ghost" onPress={() => shareUrl(url, `${q.title} line`)} style={{ alignSelf: 'center', marginTop: 10 }} />
      <Card style={{ marginTop: 14 }}>
        <T kind="tiny">With you now</T>
        <T kind="title" style={{ fontSize: 20 }}>{serving ? serving.name : 'Nobody yet'}</T>
        {serving?.note ? <T kind="small">{serving.note}</T> : null}
        <Button title={waiting.length ? `Call next (${waiting[0].name.split(' ')[0]})` : 'Nobody waiting'} icon="megaphone" disabled={!waiting.length || !q.open} onPress={() => api.queueNext({ code }).catch((e) => showToast(e.message))} style={{ marginTop: 10 }} />
      </Card>
      <T kind="tiny" style={{ marginTop: 14, marginBottom: 6 }}>Waiting · {waiting.length}</T>
      {waiting.length ? waiting.map((e, i) => <Row key={e.id} title={`${i + 1}. ${e.name}`} meta={e.note} last={i === waiting.length - 1} />) : <T kind="small">The line is empty.</T>}
      {q.open ? <Button title="Close the line" kind="danger" small onPress={() => api.queueClose({ code }).then(() => set({ hostQueue: null })).catch((e) => showToast(e.message))} style={{ marginTop: 16, alignSelf: 'flex-start' }} /> : null}
      <SectionNote icon="bell">Students get a notification when they're next, and when you call them.</SectionNote>
      <View style={{ height: 1, backgroundColor: t.rule }} />
    </View>
  );
}

function StudentView({ code, entryId }) {
  const { t } = useTheme();
  const { set, showToast } = useApp();
  const [q, setQ] = useState(undefined);
  useEffect(() => listenDoc(`queues/${code}`, setQ), [code]);
  if (q === undefined) return <Loading />;
  if (!q) return <Empty icon="hourglass" title="That line is gone." />;
  const pos = (q.waiting || []).indexOf(entryId);
  const up = q.serving === entryId;
  const leave = async () => { await api.queueLeave({ code, entryId }).catch(() => {}); set({ myQueue: null }); showToast('You left the line'); };
  return (
    <View style={{ alignItems: 'center' }}>
      <T kind="hand">{q.hostName}{q.place ? ` · ${q.place}` : ''}</T>
      {up ? (
        <StampThunk play><RubberStamp label="You're up!" size={150} color={t.ok} /></StampThunk>
      ) : pos >= 0 ? (
        <PostIt color="yellow" tape style={{ alignItems: 'center', marginTop: 10 }} padding={20}>
          <PT kind="tiny">Your place</PT>
          <T kind="marker" color="#1F2A44" style={{ fontSize: 64, lineHeight: 72 }}>{pos + 1}</T>
          <PT kind="small">{pos === 0 ? "You're next. Head over." : `${pos} ahead of you`}</PT>
        </PostIt>
      ) : <T kind="small" style={{ marginTop: 10 }}>{q.open ? "You're not in line right now." : 'The line closed.'}</T>}
      {pos >= 0 || up ? <Button title="Leave the line" kind="ghost" small onPress={leave} style={{ marginTop: 16 }} /> : null}
      <SectionNote icon="bell">Flyer will notify you when you're next and when it's your turn.</SectionNote>
    </View>
  );
}

export function QueueSheet({ code: initialCode, host, onClose }) {
  const { myQueue, hostQueue, set, showToast, userName } = useApp();
  const [code, setCode] = useState(initialCode ? String(initialCode).toUpperCase() : '');
  const [q, setQ] = useState(null);
  const [note, setNote] = useState('');
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(host ? 'host' : null);
  const [title, setTitle] = useState('Office hours');
  const [course, setCourse] = useState('');
  const [place, setPlace] = useState('');
  useEffect(() => (code.length >= 6 && !mode ? listenDoc(`queues/${code}`, setQ) : undefined), [code, mode]);
  if (hostQueue && (host || hostQueue === code)) return <Sheet title="Your office hours" onClose={onClose} height={0.95}><HostView code={hostQueue} /></Sheet>;
  if (myQueue && (!initialCode || myQueue.code === code)) return <Sheet title="In line" onClose={onClose}><StudentView code={myQueue.code} entryId={myQueue.entryId} /></Sheet>;
  const join = async () => {
    setBusy(true);
    try { const r = await api.queueJoin({ code, note, name: userName }); set({ myQueue: { code, entryId: r.data.entryId } }); } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  const open = async () => {
    setBusy(true);
    try { const r = await api.queueOpen({ title, course, place }); set({ hostQueue: r.data.code }); } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  if (mode === 'host') {
    return (
      <Sheet title="Run office hours" hand="For professors, TAs, tutors, and org officers." onClose={onClose} footer={<Button title="Open the line" icon="check" loading={busy} onPress={open} />}>
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Field label="Course (optional)" value={course} onChangeText={setCourse} autoCapitalize="characters" placeholder="MATH 1314" />
        <Field label="Where (optional)" value={place} onChangeText={setPlace} placeholder="Math 201" />
        <SectionNote icon="info">The line closes on its own after 8 hours.</SectionNote>
      </Sheet>
    );
  }
  return (
    <Sheet title="Office hours line" onClose={onClose}
      footer={q && q.open ? <Button title="Get in line" icon="hourglass" loading={busy} onPress={join} /> : null}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Field placeholder="Line code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={8} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Scan" icon="scan" small kind="ghost" onPress={() => setScan(true)} style={{ marginTop: 2 }} />
      </View>
      {q ? (
        <PostIt color="pink" tape>
          <PT kind="title">{q.title}</PT>
          <PT kind="small">{[q.hostName, q.course, q.place].filter(Boolean).join(' · ')}</PT>
          <PT kind="bold" style={{ marginTop: 6 }}>{q.open ? `${(q.waiting || []).length} waiting` : 'This line is closed.'}</PT>
          {q.open ? <Field placeholder="What do you need help with? (optional)" value={note} onChangeText={setNote} maxLength={200} style={{ marginTop: 10, marginBottom: 0 }} /> : null}
        </PostIt>
      ) : code.length >= 6 ? <T kind="small">Looking for that line…</T> : null}
      <Button title="I'm running office hours" kind="ghost" small onPress={() => setMode('host')} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
      {scan ? <ScannerSheet title="Scan the line's QR" onClose={() => setScan(false)} onCode={(text) => { const m = String(text).match(/\/q\/([A-Z0-9]+)/i); if (m) { setCode(m[1].toUpperCase()); return true; } return false; }} /> : null}
    </Sheet>
  );
}
