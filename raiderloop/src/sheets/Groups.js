/**
 * Group Spaces: one shared page for a project or study group.
 * Deadlines, clipped files (Google Docs, PowerPoint, Canva, PDFs),
 * who's doing what, finding a time everyone's free, presenting on a
 * TV, booking a room, and a teammate photo swap so you can find each
 * other in class.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Chip, Field, Loading, Empty, Check,
} from '../ui/Paper';
import { FolderTabs, QRCode, WhenPicker, PersonRow, Pill } from '../ui/Kit';
import { PaperClip, Washi } from '../ui/Scrap';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { pickPhoto, pickDocument, upload, uploadError } from '../lib/upload';
import { openUrl } from '../lib/links';
import { shareUrl } from '../lib/share';
import { linkFor } from '../lib/deeplinks';
import { toMinutes, dueLabel } from '../lib/time';
import { STUDY_ROOMS_HELP } from '../data/hub';
import { ReportSheet } from './Report';

export function fileKind(url = '') {
  const u = url.toLowerCase();
  if (u.includes('docs.google.com/presentation')) return { label: 'Google Slides', icon: 'tv' };
  if (u.includes('docs.google.com/spreadsheets')) return { label: 'Google Sheets', icon: 'grid' };
  if (u.includes('docs.google.com') || u.includes('drive.google.com')) return { label: 'Google Docs', icon: 'file' };
  if (u.includes('canva.com')) return { label: 'Canva', icon: 'palette' };
  if (u.includes('onedrive') || u.includes('1drv.ms') || u.includes('sharepoint.com')) return { label: 'OneDrive', icon: 'folder' };
  if (u.includes('powerpoint') || u.includes('.pptx')) return { label: 'PowerPoint', icon: 'tv' };
  if (u.includes('figma.com')) return { label: 'Figma', icon: 'palette' };
  if (u.includes('github.com')) return { label: 'GitHub', icon: 'laptop' };
  if (u.includes('notion.')) return { label: 'Notion', icon: 'book' };
  if (u.includes('.pdf')) return { label: 'PDF', icon: 'file' };
  return { label: 'Link', icon: 'link' };
}

const DAYS = ['M', 'T', 'W', 'Th', 'F'];
const DAY_NAME = { M: 'Mon', T: 'Tue', W: 'Wed', Th: 'Thu', F: 'Fri' };
const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const toM = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const label = (mins) => { const h = Math.floor(mins / 60); const ap = h >= 12 ? 'PM' : 'AM'; const hr = h % 12 || 12; return `${hr}${mins % 60 ? `:${String(mins % 60).padStart(2, '0')}` : ''} ${ap}`; };

/** Busy blocks from my class schedule, for "Find a time". */
export function myBusyBlocks(scheduleItems) {
  const out = [];
  scheduleItems.filter((c) => !c.oneOff).forEach((c) => {
    const s = toMinutes(c.time); const e = toMinutes(c.endTime) ?? (s != null ? s + 50 : null);
    if (s == null || e == null) return;
    (c.days || []).forEach((d) => out.push({ day: d, start: hhmm(s), end: hhmm(e) }));
  });
  return out;
}

/** One-hour slots (8 AM–10 PM, weekdays) when everyone who shared is free. */
export function commonFree(busy = {}, { from = 8 * 60, to = 22 * 60, len = 60 } = {}) {
  const people = Object.keys(busy);
  const slots = [];
  DAYS.forEach((d) => {
    for (let m = from; m + len <= to; m += 30) {
      const clash = people.some((p) => (busy[p] || []).some((b) => b.day === d && toM(b.start) < m + len && toM(b.end) > m));
      if (!clash) slots.push({ day: d, start: m, end: m + len });
    }
  });
  // Merge overlapping half-hour steps into readable windows.
  const merged = [];
  slots.forEach((s) => {
    const last = merged[merged.length - 1];
    if (last && last.day === s.day && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  });
  return merged.map((s) => ({ ...s, label: `${DAY_NAME[s.day]} ${label(s.start)}–${label(s.end)}` }));
}

/* ---------- List + create ---------- */
/** The list of your groups, invites, and "join with a code". Used in
    the Groups sheet and the Planner's Groups tab. */
export function GroupsBody() {
  const { t } = useTheme();
  const { groups, groupInvites, setSheet, showToast } = useApp();
  const [code, setCode] = useState('');
  const join = async (args) => {
    try { const r = await api.groupJoin(args); setSheet({ type: 'group', id: r.data.id }); } catch (e) { showToast(e.message); }
  };
  return (
    <View>
      {groupInvites.map((g) => (
        <PostIt key={g.id} color="green" seed={g.id} style={{ marginBottom: 12 }}>
          <PT kind="tiny">Invite</PT><PT kind="title">{g.name}</PT><PT kind="small">{g.members.length} {g.members.length === 1 ? 'person' : 'people'}{g.course ? ` · ${g.course}` : ''}</PT>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Button title="Join" small onPress={() => join({ id: g.id })} style={{ marginRight: 8 }} />
            <Button title="No thanks" small kind="ghost" onPress={() => api.groupLeave({ id: g.id, decline: true }).catch(() => {})} style={{ backgroundColor: '#fff' }} />
          </View>
        </PostIt>
      ))}
      {groups.length ? groups.map((g, i) => {
        const next = (g.deadlines || []).filter((d) => !d.done && new Date(d.due) > new Date()).sort((a, b) => new Date(a.due) - new Date(b.due))[0];
        return (
          <PostIt key={g.id} color={['blue', 'yellow', 'pink', 'lavender', 'orange'][i % 5]} seed={g.id} style={{ marginBottom: 12 }} onPress={() => setSheet({ type: 'group', id: g.id })} accessibilityLabel={g.name}>
            {i % 2 === 0 ? <Washi width={56} angle={-5} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <PT kind="bold">{g.name}</PT>
                <PT kind="small">{[g.course, `${g.members.length} ${g.members.length === 1 ? 'person' : 'people'}`].filter(Boolean).join(' · ')}</PT>
                {next ? <PT kind="small" style={{ marginTop: 2, fontWeight: '700' }}>Next: {next.title}, {dueLabel(next.due)}</PT> : null}
              </View>
              <View style={{ flexDirection: 'row' }}>{g.members.slice(0, 3).map((m, k) => <Avatar key={m} config={g.memberCards?.[m]?.avatar || {}} size={30} style={{ marginLeft: k ? -10 : 0 }} />)}</View>
            </View>
          </PostIt>
        );
      }) : <Empty icon="users" title="No groups yet" body="Make one for a class project, a study group, or an org committee. Shared deadlines, files, polls, and a free time finder." />}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 }}>
        <Field placeholder="Have a group code?" value={code} onChangeText={setCode} autoCapitalize="characters" style={{ flex: 1, marginRight: 8 }} />
        <Button title="Join" small disabled={code.trim().length < 4} onPress={() => join({ code: code.trim() })} style={{ marginTop: 2 }} />
      </View>
      <T kind="small" color={t.pencil}>Or scan a group QR code (Home → Scan).</T>
    </View>
  );
}

export function GroupsSheet({ onClose }) {
  const { setSheet, user } = useApp();
  if (!user || user.isAnonymous) {
    return <Sheet title="Groups" onClose={onClose}><PostIt color="yellow" tape><PT kind="bold">Groups need an account</PT><Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10 }} /></PostIt></Sheet>;
  }
  return (
    <Sheet title="Group Spaces" hand="One page for every project." onClose={onClose} height={0.92}
      footer={<Button title="New group" icon="plus" onPress={() => setSheet({ type: 'groupNew' })} />}>
      <GroupsBody />
    </Sheet>
  );
}

export function GroupNewSheet({ onClose }) {
  const { scheduleItems, friends, showToast, setSheet } = useApp();
  const courses = [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => c.title))];
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [endsAt, setEndsAt] = useState(null);
  const [invite, setInvite] = useState([]);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try { const r = await api.groupCreate({ name, course, endsAt, invite }); showToast('Group made'); setSheet({ type: 'group', id: r.data.id }); } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  return (
    <Sheet title="New group" onClose={onClose} height={0.92} footer={<Button title="Make the group" icon="check" loading={busy} disabled={name.trim().length < 2} onPress={create} />}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="ENGL 1301 Project" maxLength={60} />
      {courses.length ? (
        <>
          <T kind="tiny" style={{ marginBottom: 6 }}>Class (optional)</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>{courses.map((c) => <Chip key={c} label={c} active={course === c} onPress={() => { setCourse(course === c ? '' : c); if (!name) setName(`${c} Project`); }} />)}</View>
        </>
      ) : null}
      <WhenPicker label="Project ends (optional)" value={endsAt} onChange={setEndsAt} days={120} withTime={false} />
      <T kind="tiny" style={{ marginBottom: 6 }}>Invite friends</T>
      {friends.length ? friends.map((f, i) => (
        <PersonRow key={f.uid} person={f} last={i === friends.length - 1} onPress={() => setInvite((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))}
          right={<Check checked={invite.includes(f.uid)} onPress={() => setInvite((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))} label={f.name} />} />
      )) : <T kind="small">You can also invite people with a link or QR after you make it.</T>}
    </Sheet>
  );
}

/* ---------- The space ---------- */
function Deadlines({ g }) {
  const { t } = useTheme();
  const { assignments, showToast } = useApp();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(null);
  const [fromPlanner, setFromPlanner] = useState(false);
  const act = (op, extra) => api.groupAction({ id: g.id, op, ...extra }).catch((e) => showToast(e.message));
  const mine = assignments.filter((a) => !a.done && a.due && new Date(a.due) > new Date() && (!g.course || (a.course || '').toUpperCase().includes(g.course)));
  return (
    <View>
      {(g.deadlines || []).length ? (g.deadlines || []).map((d) => {
        const past = new Date(d.due) < new Date();
        return (
          <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
            <Check checked={d.done} onPress={() => act('toggleDeadline', { itemId: d.id })} label={d.title} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <PT kind="bold" style={d.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : null}>{d.title}</PT>
              <T kind="small" color={past && !d.done ? t.redPen : '#4B5571'}>{new Date(d.due).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{d.done ? ' · done' : ''}</T>
            </View>
            <Pressable onPress={() => act('removeDeadline', { itemId: d.id })} hitSlop={10} accessibilityLabel="Remove"><Icon name="close" size={16} color="#7D786B" /></Pressable>
          </View>
        );
      }) : <PT kind="small">No deadlines yet.</PT>}
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <Button title="Add" icon="plus" small kind="ghost" onPress={() => setAdding(true)} style={{ marginRight: 8, backgroundColor: '#fff' }} />
        {mine.length ? <Button title="From my Planner" icon="clipboard" small kind="ghost" onPress={() => setFromPlanner(true)} style={{ backgroundColor: '#fff' }} /> : null}
      </View>
      {adding ? (
        <Sheet title="Add a deadline" onClose={() => setAdding(false)} height={0.7}
          footer={<Button title="Add for everyone" icon="check" disabled={!title.trim() || !due} onPress={async () => { await act('addDeadline', { title, due }); setAdding(false); setTitle(''); setDue(null); }} />}>
          <Field label="What's due" value={title} onChangeText={setTitle} placeholder="Draft" />
          <WhenPicker value={due} onChange={setDue} days={90} withTime={false} label="Due" />
        </Sheet>
      ) : null}
      {fromPlanner ? (
        <Sheet title="From your Planner" onClose={() => setFromPlanner(false)} height={0.7}>
          {mine.map((a) => <Row key={a.id} title={a.title} meta={`${a.course} · ${dueLabel(a.due)}`} onPress={async () => { await act('addDeadline', { title: a.title, due: a.due }); setFromPlanner(false); }} />)}
        </Sheet>
      ) : null}
    </View>
  );
}

function Files({ g }) {
  const { t } = useTheme();
  const { showToast, connections, setSheet, user } = useApp();
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const act = (op, extra) => api.groupAction({ id: g.id, op, ...extra });
  const addLink = async () => {
    setBusy(true);
    try { const u = /^https?:\/\//.test(url.trim()) ? url.trim() : `https://${url.trim()}`; await act('addFile', { url: u, title, kind: fileKind(u).label }); setAdding(false); setUrl(''); setTitle(''); } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  const addUpload = async (fn) => {
    setBusy(true);
    try { const f = await fn(); if (f) { const path = await upload(f); await act('addFile', { uploadPath: path, title: title || f.name || '' }); setAdding(false); setTitle(''); } } catch (e) { showToast(uploadError(e)); }
    setBusy(false);
  };
  return (
    <View>
      {(g.files || []).length ? (g.files || []).map((f) => {
        const k = f.stored ? { label: f.kind === 'pdf' ? 'PDF' : 'Photo', icon: f.kind === 'pdf' ? 'file' : 'image' } : fileKind(f.url);
        return (
          <Row key={f.id} title={f.title} meta={`${k.label} · added by ${f.by === user?.uid ? 'you' : (g.memberCards?.[f.by]?.name || '').split(' ')[0] || 'someone'}`}
            left={<Icon name={k.icon} color={t.ink} />} onPress={() => openUrl(f.url)}
            right={<Pressable onPress={() => Alert.alert('Remove this file?', f.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => act('removeFile', { itemId: f.id }).catch((e) => showToast(e.message)) }])} hitSlop={10}><Icon name="close" size={16} color={t.faint} /></Pressable>} />
        );
      }) : <T kind="small">Clip the doc, slides, or poster so nobody has to dig through texts for the link.</T>}
      <Button title="Clip a file" icon="plus" small kind="ghost" onPress={() => setAdding(true)} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
      {adding ? (
        <Sheet title="Clip a file" hand="Links stay where they are; Flyer just keeps them handy." onClose={() => setAdding(false)} height={0.8}
          footer={<Button title="Add link" icon="link" loading={busy} disabled={!/\S+\.\S+/.test(url)} onPress={addLink} />}>
          <Field label="Link" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="Google Docs, PowerPoint, Canva…" />
          <Field label="Name (optional)" value={title} onChangeText={setTitle} placeholder="Final slides" />
          {url ? <Pill label={fileKind(url).label} icon={fileKind(url).icon} color="blue" /> : null}
          <T kind="tiny" style={{ marginTop: 14, marginBottom: 6 }}>Or upload</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Button title="PDF" icon="file" small kind="ghost" disabled={busy} onPress={() => addUpload(() => pickDocument({ types: ['application/pdf'] }))} style={{ marginRight: 8, marginBottom: 8 }} />
            <Button title="Photo" icon="image" small kind="ghost" disabled={busy} onPress={() => addUpload(() => pickPhoto())} style={{ marginRight: 8, marginBottom: 8 }} />
            {connections.canva ? <Button title="From Canva" icon="palette" small kind="ghost" onPress={() => setSheet({ type: 'connections', pick: { kind: 'canva', groupId: g.id } })} style={{ marginBottom: 8 }} /> : null}
            {connections.microsoft ? <Button title="From OneDrive" icon="folder" small kind="ghost" onPress={() => setSheet({ type: 'connections', pick: { kind: 'onedrive', groupId: g.id } })} style={{ marginBottom: 8 }} /> : null}
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

function Tasks({ g }) {
  const { t } = useTheme();
  const { user, showToast } = useApp();
  const [title, setTitle] = useState('');
  const act = (op, extra) => api.groupAction({ id: g.id, op, ...extra }).catch((e) => showToast(e.message));
  return (
    <View>
      {(g.tasks || []).map((k) => {
        const who = k.who === user?.uid ? 'You' : k.who ? (g.memberCards?.[k.who]?.name || '').split(' ')[0] : null;
        return (
          <View key={k.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
            <Check checked={k.done} onPress={() => act('toggleTask', { itemId: k.id })} label={k.title} />
            <T kind="body" style={[{ flex: 1, marginLeft: 10 }, k.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : null]}>{k.title}</T>
            <Pressable onPress={() => act('claimTask', { itemId: k.id })} hitSlop={8} accessibilityLabel={who ? `Assigned to ${who}` : 'Claim this task'}>
              {who ? <Pill label={who} color={k.who === user?.uid ? 'yellow' : 'blue'} /> : <T kind="hand" color={t.accent}>claim</T>}
            </Pressable>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 }}>
        <Field placeholder="Add a task…" value={title} onChangeText={setTitle} style={{ flex: 1, marginRight: 8, marginBottom: 0 }} />
        <Button title="Add" small disabled={!title.trim()} onPress={() => { act('addTask', { title }); setTitle(''); }} style={{ marginTop: 2 }} />
      </View>
    </View>
  );
}

function FindTime({ g }) {
  const { t } = useTheme();
  const { user, scheduleItems, showToast, setSheet } = useApp();
  const shared = Object.keys(g.busy || {});
  const iShared = shared.includes(user?.uid);
  const free = useMemo(() => commonFree(g.busy || {}), [g.busy]);
  const share = async () => {
    try { await api.groupAction({ id: g.id, op: 'setBusy', blocks: myBusyBlocks(scheduleItems) }); showToast('Shared your class times with the group'); } catch (e) { showToast(e.message); }
  };
  return (
    <View>
      <T kind="small">{shared.length} of {g.members.length} shared their class times. Only busy blocks are shared, not class names.</T>
      {!iShared ? <Button title="Share my class times" icon="schedule" small onPress={share} disabled={!scheduleItems.length} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
        : <Pressable onPress={() => api.groupAction({ id: g.id, op: 'setBusy', clear: true }).catch(() => {})}><T kind="hand" color={t.accent} style={{ marginTop: 6 }}>stop sharing my times</T></Pressable>}
      {shared.length ? (
        <View style={{ marginTop: 10 }}>
          {free.slice(0, 8).map((s) => <Row key={s.label} title={s.label} meta={shared.length === g.members.length ? 'Everyone is free' : `Free for the ${shared.length} who shared`} left={<Icon name="clock" color={t.ink} />}
            onPress={() => setSheet({ type: 'planNew', groupId: g.id, title: `Meet ${s.label}?`, options: [s.label, 'Another time'] })} />)}
          {!free.length ? <T kind="small">No shared free hour this week. Try a weekend, or meet online.</T> : null}
        </View>
      ) : null}
    </View>
  );
}

function Swaps({ g }) {
  const { t } = useTheme();
  const { user, showToast } = useApp();
  const [swaps, setSwaps] = useState({});
  const load = () => api.faceSwapStatus({ groupId: g.id }).then((r) => setSwaps(r.data.swaps || {})).catch(() => {});
  useEffect(() => { load(); }, [g.id]);
  const others = g.members.filter((m) => m !== user?.uid);
  if (!others.length) return null;
  return (
    <View>
      <T kind="small" style={{ marginBottom: 6 }}>So you can find each other in class. Faces show until {g.endsAt ? new Date(g.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'the project ends'}, and only if you both agree.</T>
      {others.map((m, i) => {
        const s = swaps[m] || {};
        return (
          <PersonRow key={m} person={{ ...g.memberCards?.[m], name: g.memberCards?.[m]?.name || 'Teammate' }} last={i === others.length - 1}
            meta={s.active ? 'Photos swapped' : s.meOk ? 'Waiting for them' : s.themOk ? 'They asked to swap' : null}
            right={s.active ? <Pressable onPress={() => api.faceSwap({ uid: m, groupId: g.id, stop: true }).then(load)}><T kind="hand" color={t.pencil}>stop</T></Pressable>
              : <Button title={s.themOk ? 'Swap back' : 'Swap photos'} small kind={s.meOk ? 'ghost' : 'primary'} disabled={s.meOk} onPress={async () => { try { await api.faceSwap({ uid: m, groupId: g.id }); load(); showToast(s.themOk ? 'Photos swapped' : 'Asked to swap'); } catch (e) { showToast(e.message); } }} />} />
        );
      })}
    </View>
  );
}

export function GroupSheet({ id, code, onClose }) {
  const { t } = useTheme();
  const { groups, user, setSheet, showToast } = useApp();
  const [tab, setTab] = useState('work');
  const [joining, setJoining] = useState(false);
  const [invite, setInvite] = useState(false);
  const [report, setReport] = useState(false);
  const g = groups.find((x) => x.id === id || (code && x.code === String(code).toUpperCase()));
  const join = async () => {
    setJoining(true);
    try { await api.groupJoin({ code }); showToast('Joined'); } catch (e) { showToast(e.message); }
    setJoining(false);
  };
  if (!g) {
    return (
      <Sheet title="Group" onClose={onClose} height={0.6}>
        {code ? (
          !user || user.isAnonymous ? <Button title="Make an account to join" onPress={() => setSheet({ type: 'account' })} />
            : <PostIt color="blue" tape><PT kind="bold">Join this group?</PT><PT kind="small">Code {String(code).toUpperCase()}</PT><Button title="Join" small loading={joining} onPress={join} style={{ marginTop: 10 }} /></PostIt>
        ) : <Loading label="Opening the group…" />}
      </Sheet>
    );
  }
  const names = g.members.map((m) => (m === user?.uid ? 'You' : (g.memberCards?.[m]?.name || '').split(' ')[0])).filter(Boolean);
  const leave = () => Alert.alert(`Leave ${g.name}?`, 'You can rejoin with the code.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => api.groupLeave({ id: g.id }).then(onClose).catch((e) => showToast(e.message)) }]);
  const url = linkFor('group', g.code);
  return (
    <Sheet title={g.name} hand={names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : 'Just you so far'} onClose={onClose} height={0.95}
      headerRight={<Pressable onPress={() => setInvite(true)} hitSlop={10} accessibilityLabel="Invite" style={{ marginTop: 8 }}><Icon name="userPlus" size={20} color={t.ink} /></Pressable>}>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {g.members.slice(0, 8).map((m, k) => <Avatar key={m} config={g.memberCards?.[m]?.avatar || {}} size={38} style={{ marginLeft: k ? -10 : 0 }} />)}
      </View>
      <FolderTabs small value={tab} onChange={setTab} tabs={[
        { id: 'work', label: 'Work', icon: 'clipboard', color: 'yellow' },
        { id: 'meet', label: 'Meet', icon: 'clock', color: 'green' },
        { id: 'people', label: 'People', icon: 'users', color: 'pink' },
      ]} />
      {tab === 'work' ? (
        <>
          <PostIt color="yellow" tilt={-0.6} tape style={{ marginBottom: 18 }}>
            <PT kind="title" style={{ fontSize: 20 }}>Deadlines</PT>
            <Deadlines g={g} />
          </PostIt>
          <Card style={{ marginBottom: 18 }}>
            <View style={{ position: 'absolute', right: 14, top: -14 }}><PaperClip size={36} /></View>
            <T kind="title" style={{ fontSize: 20, marginBottom: 6 }}>Clipped files</T>
            <Files g={g} />
          </Card>
          <Card>
            <T kind="title" style={{ fontSize: 20, marginBottom: 6 }}>Who's doing what</T>
            <Tasks g={g} />
          </Card>
        </>
      ) : null}
      {tab === 'meet' ? (
        <>
          <Card style={{ marginBottom: 14 }}><T kind="title" style={{ fontSize: 20, marginBottom: 6 }}>Find a time</T><FindTime g={g} /></Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Button title="Present on a TV" icon="tv" small onPress={() => setSheet({ type: 'present', groupId: g.id })} style={{ marginRight: 8, marginBottom: 8 }} />
            <Button title="Book a room" icon="door" small kind="ghost" onPress={() => openUrl(STUDY_ROOMS_HELP.source)} style={{ marginRight: 8, marginBottom: 8 }} />
            <Button title="Ask the group" icon="calendarPlus" small kind="ghost" onPress={() => setSheet({ type: 'planNew', groupId: g.id })} style={{ marginBottom: 8 }} />
          </View>
        </>
      ) : null}
      {tab === 'people' ? (
        <>
          <Card style={{ marginBottom: 14 }}><T kind="title" style={{ fontSize: 20, marginBottom: 6 }}>Swap face photos?</T><Swaps g={g} /></Card>
          <Button title="Invite people" icon="userPlus" small onPress={() => setInvite(true)} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
          <View style={{ flexDirection: 'row' }}>
            <Button title="Leave group" small kind="danger" onPress={leave} style={{ marginRight: 8 }} />
            <Button title="Report" small kind="ghost" onPress={() => setReport(true)} />
          </View>
        </>
      ) : null}
      {invite ? (
        <Sheet title="Invite people" hand="Anyone with the code can join." onClose={() => setInvite(false)} height={0.85}>
          <View style={{ alignItems: 'center' }}>
            <PostIt color="blue" tilt={-1} padding={16} style={{ alignItems: 'center' }}>
              <QRCode value={url} size={180} />
              <PT kind="title" style={{ marginTop: 8 }}>Code {g.code}</PT>
            </PostIt>
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <Button title="Share link" icon="share" small onPress={() => shareUrl(url, `Join ${g.name} on Flyer`)} style={{ marginRight: 8 }} />
              <Button title="Flyer Drop" icon="plane" small kind="ghost" onPress={() => { setInvite(false); setSheet({ type: 'drop' }); }} />
            </View>
          </View>
          <InviteFriends g={g} onDone={() => setInvite(false)} />
        </Sheet>
      ) : null}
      {report ? <ReportSheet kind="group" id={g.id} onClose={() => setReport(false)} /> : null}
    </Sheet>
  );
}

function InviteFriends({ g, onDone }) {
  const { friends, showToast } = useApp();
  const [picked, setPicked] = useState([]);
  const list = friends.filter((f) => !g.members.includes(f.uid));
  if (!list.length) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <T kind="tiny" style={{ marginBottom: 6 }}>Or pick friends</T>
      {list.map((f, i) => (
        <PersonRow key={f.uid} person={f} last={i === list.length - 1} onPress={() => setPicked((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))}
          right={<Icon name={picked.includes(f.uid) ? 'check' : 'plus'} />} />
      ))}
      <Button title={`Invite ${picked.length || ''}`} small disabled={!picked.length} onPress={async () => { try { await api.groupAction({ id: g.id, op: 'invite', uids: picked }); showToast('Invited'); onDone(); } catch (e) { showToast(e.message); } }} style={{ marginTop: 10 }} />
    </View>
  );
}

