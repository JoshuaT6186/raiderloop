/**
 * Flyer Drop: send your card, a link, a note, a photo, a PDF, an
 * event, or a group invite to someone right next to you, to a friend,
 * or to anyone who scans your QR (great for "here's what you missed").
 *
 * "Nearby" works while both phones have Flyer open on this screen:
 * each phone checks in with a rough location every few seconds, and
 * only people within about 80 m who also have Drop open show up.
 * iPhones don't let apps use AirDrop or phone-to-phone taps, so this
 * plus the QR code is how Flyer does it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Image, Share } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Chip, Field, Loading, Empty,
} from '../ui/Paper';
import { FolderTabs, QRCode, PlaneFlight, PersonRow, SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { currentPosition, getForegroundPermission } from '../lib/location';
import { pickPhoto, pickDocument, upload, uploadError } from '../lib/upload';
import { openUrl } from '../lib/links';
import { metaLine } from '../lib/time';
import { Clipboard } from '../lib/native';
import { ReportSheet } from './Report';

const KINDS = [
  { id: 'card', label: 'My card', icon: 'you' },
  { id: 'link', label: 'Link', icon: 'link' },
  { id: 'note', label: 'Note', icon: 'pencil' },
  { id: 'photo', label: 'Photo', icon: 'image' },
  { id: 'file', label: 'PDF', icon: 'file' },
  { id: 'event', label: 'Event', icon: 'ticket' },
  { id: 'group', label: 'Group', icon: 'users' },
];
const KIND_ICON = Object.fromEntries(KINDS.map((k) => [k.id, k.icon]));
KIND_ICON.plan = 'calendarPlus';

/* What you're about to send. */
function Composer({ kind, setKind, payload, setPayload, file, setFile }) {
  const { t } = useTheme();
  const { savedEvents, groups, showToast } = useApp();
  const pick = async (fn) => { try { const f = await fn(); if (f) setFile(f); } catch (e) { showToast(uploadError(e)); } };
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {KINDS.map((k) => <Chip key={k.id} label={k.label} icon={k.icon} active={kind === k.id} onPress={() => { setKind(k.id); setPayload({}); setFile(null); }} />)}
      </View>
      {kind === 'card' ? <T kind="small">Sends your Connect card. They see what your card shows them.</T> : null}
      {kind === 'link' ? (
        <>
          <Field placeholder="https://docs.google.com/…" value={payload.url || ''} onChangeText={(v) => setPayload({ ...payload, url: v })} autoCapitalize="none" keyboardType="url" />
          <Field placeholder="What is it? (optional)" value={payload.title || ''} onChangeText={(v) => setPayload({ ...payload, title: v })} />
        </>
      ) : null}
      {kind === 'note' ? (
        <>
          <Field placeholder="Title (optional)" value={payload.title || ''} onChangeText={(v) => setPayload({ ...payload, title: v })} />
          <Field placeholder="Type the note…" value={payload.text || ''} onChangeText={(v) => setPayload({ ...payload, text: v })} multiline inputStyle={{ minHeight: 90 }} />
        </>
      ) : null}
      {kind === 'photo' || kind === 'file' ? (
        <>
          {file ? (
            <Row title={file.name || (kind === 'photo' ? 'Photo ready' : 'PDF ready')} meta="Tap to choose a different one" left={<Icon name={kind === 'photo' ? 'image' : 'file'} color={t.ink} />} onPress={() => setFile(null)} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {kind === 'photo' ? <Button title="Take a photo" icon="camera" small kind="ghost" onPress={() => pick(() => pickPhoto({ camera: true }))} style={{ marginRight: 8, marginBottom: 8 }} /> : null}
              <Button title={kind === 'photo' ? 'Choose a photo' : 'Choose a PDF'} icon={kind === 'photo' ? 'image' : 'file'} small kind="ghost" onPress={() => pick(() => (kind === 'photo' ? pickPhoto() : pickDocument({ types: ['application/pdf'] })))} style={{ marginBottom: 8 }} />
            </View>
          )}
          <Field placeholder="Title (optional)" value={payload.title || ''} onChangeText={(v) => setPayload({ ...payload, title: v })} />
        </>
      ) : null}
      {kind === 'event' ? (
        savedEvents.length ? savedEvents.slice(0, 12).map((e) => (
          <Row key={e.id} title={e.title} meta={metaLine(e.date, e.time, e.location)} right={payload.title === e.title ? <Icon name="check" color={t.ok} /> : null}
            onPress={() => setPayload({ title: e.title, when: metaLine(e.date, e.time), where: e.location || '', desc: e.desc || '', url: e.sourceUrl || '' })} />
        )) : <T kind="small">Save an event in Discover first, then send it here.</T>
      ) : null}
      {kind === 'group' ? (
        groups.length ? groups.map((g) => (
          <Row key={g.id} title={g.name} meta={`${g.members.length} people`} right={payload.code === g.code ? <Icon name="check" color={t.ok} /> : null} onPress={() => setPayload({ title: `Join ${g.name}`, code: g.code })} />
        )) : <T kind="small">Make a group in the Planner first.</T>
      ) : null}
    </View>
  );
}

const ready = (kind, payload, file) => {
  if (kind === 'card') return true;
  if (kind === 'link') return /\S+\.\S+/.test(payload.url || '');
  if (kind === 'note') return !!(payload.text || '').trim();
  if (kind === 'photo' || kind === 'file') return !!file;
  if (kind === 'event') return !!payload.title;
  if (kind === 'group') return !!payload.code;
  return false;
};

export function DropSheet({ to, onClose, initialTab }) {
  const { t } = useTheme();
  const { friends, drops, showToast, setSheet, user } = useApp();
  const [tab, setTab] = useState(initialTab || (to ? 'send' : 'send'));
  const [kind, setKind] = useState('card');
  const [payload, setPayload] = useState({});
  const [file, setFile] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [locOk, setLocOk] = useState(null);
  const [picked, setPicked] = useState(to ? [to] : []);
  const [busy, setBusy] = useState(false);
  const [flight, setFlight] = useState(false);
  const [qr, setQr] = useState(null);
  const timer = useRef(null);
  const signedIn = user && !user.isAnonymous;

  /* Stay visible to people nearby only while this sheet is open. */
  useEffect(() => {
    if (!signedIn) return undefined;
    let alive = true;
    const beat = async () => {
      const pos = await currentPosition();
      if (!alive) return;
      if (!pos) { setLocOk(false); return; }
      setLocOk(true);
      try { const r = await api.dropBeacon({ visible: true, lat: pos.lat, lng: pos.lng }); if (alive) setNearby(r.data.people || []); } catch (e) { /* keep trying */ }
    };
    (async () => { if (await getForegroundPermission(false)) beat(); else setLocOk(false); })();
    timer.current = setInterval(beat, 6000);
    return () => { alive = false; clearInterval(timer.current); api.dropBeacon({ visible: false }).catch(() => {}); };
  }, [signedIn]);

  const toggle = (uid) => setPicked((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]));
  const buildArgs = async (extra) => {
    const args = { kind, payload, ...extra };
    if ((kind === 'photo' || kind === 'file') && file) args.uploadPath = await upload(file);
    if (kind === 'link' && payload.url && !/^https?:\/\//.test(payload.url)) args.payload = { ...payload, url: `https://${payload.url.trim()}` };
    return args;
  };
  const send = async () => {
    setBusy(true);
    try {
      await api.dropSend(await buildArgs({ to: picked }));
      setFlight(true);
    } catch (e) { showToast(uploadError(e)); }
    setBusy(false);
  };
  const makeQr = async () => {
    setBusy(true);
    try { const r = await api.dropSend(await buildArgs({ open: true })); setQr(r.data); } catch (e) { showToast(uploadError(e)); }
    setBusy(false);
  };

  if (!signedIn) {
    return (
      <Sheet title="Flyer Drop" onClose={onClose}>
        <PostIt color="yellow" tape><PT kind="bold">Flyer Drop needs an account</PT><PT kind="small">So people know it's really you.</PT>
          <Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10 }} /></PostIt>
      </Sheet>
    );
  }

  return (
    <Sheet title="Flyer Drop" hand="Hold your phones close. The plane does the rest." onClose={onClose} height={0.94}
      footer={tab === 'send' && !qr ? (
        <View style={{ flexDirection: 'row' }}>
          <Button title="Show QR" icon="qr" kind="ghost" disabled={!ready(kind, payload, file) || busy} onPress={makeQr} style={{ flex: 1, marginRight: 8 }} />
          <Button title={picked.length ? `Send to ${picked.length}` : 'Pick someone'} icon="send" loading={busy} disabled={!picked.length || !ready(kind, payload, file)} onPress={send} style={{ flex: 1.2 }} />
        </View>
      ) : null}>
      <FolderTabs small value={tab} onChange={setTab} tabs={[{ id: 'send', label: 'Send', icon: 'send', color: 'yellow' }, { id: 'inbox', label: `Received${drops.length ? ` (${drops.length})` : ''}`, icon: 'inbox', color: 'blue' }]} />
      {tab === 'inbox' ? <DropInbox /> : qr ? (
        <View style={{ alignItems: 'center' }}>
          <PostIt color="yellow" tilt={-1} padding={18} style={{ alignItems: 'center' }}>
            <QRCode value={qr.url} size={220} />
            <PT kind="title" style={{ marginTop: 8 }}>Code {qr.id}</PT>
            <PT kind="small">Anyone who scans this in the next 24 hours gets it.</PT>
          </PostIt>
          <Button title="Done" kind="ghost" small onPress={() => { setQr(null); onClose(); }} style={{ marginTop: 14 }} />
        </View>
      ) : (
        <>
          <T kind="tiny" style={{ marginBottom: 6 }}>Send</T>
          <Composer kind={kind} setKind={setKind} payload={payload} setPayload={setPayload} file={file} setFile={setFile} />
          <T kind="tiny" style={{ marginTop: 16, marginBottom: 6 }}>Nearby with Flyer Drop open</T>
          {locOk === false ? (
            <Card><T kind="small">Nearby needs location while Flyer is open. You can still send to friends, or show a QR.</T></Card>
          ) : nearby.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {nearby.map((p) => (
                <Pressable key={p.uid} onPress={() => toggle(p.uid)} accessibilityLabel={`Send to ${p.name}`} style={{ alignItems: 'center', width: 76, marginBottom: 10, opacity: picked.includes(p.uid) ? 1 : 0.55 }}>
                  <View>
                    <Avatar config={p.avatar} size={52} />
                    {picked.includes(p.uid) ? <View style={{ position: 'absolute', right: -2, bottom: -2, backgroundColor: t.ok, borderRadius: 10, padding: 2 }}><Icon name="check" size={14} color="#fff" /></View> : null}
                  </View>
                  <T kind="small" numberOfLines={1} style={{ fontSize: 11.5 }}>{p.name}</T>
                  <T kind="small" style={{ fontSize: 10 }} color={t.pencil}>{p.meters} m</T>
                </Pressable>
              ))}
            </View>
          ) : <Loading label="Looking for people nearby…" />}
          <T kind="tiny" style={{ marginTop: 12, marginBottom: 6 }}>Friends</T>
          {friends.length ? friends.map((f, i) => (
            <PersonRow key={f.uid} person={f} last={i === friends.length - 1} onPress={() => toggle(f.uid)}
              right={<Icon name={picked.includes(f.uid) ? 'check' : 'plus'} color={picked.includes(f.uid) ? t.ok : t.faint} />} />
          )) : <T kind="small">Add friends to send to them from anywhere.</T>}
          <SectionNote icon="shield">Photos and notes are checked before they're delivered. Nearby only shows people who also have Drop open right now.</SectionNote>
        </>
      )}
      {flight ? <PlaneFlight direction="out" label="Sent!" onDone={() => { setFlight(false); showToast('Delivered'); onClose(); }} /> : null}
    </Sheet>
  );
}

function DropInbox() {
  const { t } = useTheme();
  const { drops, setSheet } = useApp();
  if (!drops.length) return <Empty icon="inbox" title="Nothing yet" body="When someone sends you a Drop, it lands here." />;
  return (
    <Card>
      {drops.map((d, i) => (
        <Row key={d.id} title={d.payload?.title || ({ card: 'A Connect card', note: 'A note', photo: 'A photo', file: 'A PDF', link: 'A link', event: 'An event', group: 'A group invite', plan: 'A plan' }[d.kind] || 'Something')}
          meta={`From ${d.fromName}`} left={<Avatar config={d.fromAvatar} size={36} />} right={<Icon name={KIND_ICON[d.kind] || 'plane'} size={18} color={t.inkSoft} />}
          last={i === drops.length - 1} onPress={() => setSheet({ type: 'drop', id: d.id })} />
      ))}
    </Card>
  );
}

/* Opening one drop: from the inbox, a QR, a link, or a notification. */
export function DropViewSheet({ id, onClose }) {
  const { t } = useTheme();
  const { drops, setSheet, showToast, toggleSave, isSaved } = useApp();
  const [drop, setDrop] = useState(() => drops.find((d) => d.id === id) || null);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(false);
  useEffect(() => {
    if (drop) return;
    api.dropClaim({ id }).then((r) => (r.data && r.data.kind ? setDrop(r.data) : setError('That drop is gone.'))).catch((e) => setError(e.message || 'That drop is gone.'));
  }, [id]);
  const dismiss = async () => { try { await api.dropDismiss({ id }); } catch (e) { /* fine */ } onClose(); };
  const p = (drop && drop.payload) || {};
  const ev = drop && drop.kind === 'event' ? { id: `drop-${id}`, title: p.title, date: p.when, location: p.where, desc: p.desc, sourceUrl: p.url } : null;
  const copy = async (text) => { if (Clipboard?.setStringAsync) { await Clipboard.setStringAsync(text); showToast('Copied'); } else Share.share({ message: text }); };
  return (
    <Sheet title={drop ? (p.title || 'Flyer Drop') : 'Flyer Drop'} hand={drop ? `From ${drop.fromName}` : ''} onClose={onClose}
      headerRight={drop ? <Pressable onPress={() => setReport(true)} hitSlop={10} accessibilityLabel="Report" style={{ marginTop: 8 }}><Icon name="flag" size={18} color={t.pencil} /></Pressable> : null}
      footer={drop ? <Button title="Remove from my inbox" kind="ghost" small onPress={dismiss} /> : null}>
      {error ? <Empty icon="inbox" title={error} /> : !drop ? <Loading label="Catching the plane…" /> : (
        <>
          {drop.kind === 'card' ? <Button title="Open their card" icon="you" onPress={() => setSheet({ type: 'card', handle: p.handle })} /> : null}
          {drop.kind === 'link' ? (
            <PostIt color="blue" tape><PT kind="bold">{p.title || p.url}</PT><PT kind="small" numberOfLines={2}>{p.url}</PT>
              <View style={{ flexDirection: 'row', marginTop: 10 }}><Button title="Open" icon="link" small onPress={() => openUrl(p.url)} style={{ marginRight: 8 }} /><Button title="Copy" small kind="ghost" onPress={() => copy(p.url)} style={{ backgroundColor: '#fff' }} /></View>
            </PostIt>
          ) : null}
          {drop.kind === 'note' ? (
            <PostIt color="yellow" tape><PT>{p.text}</PT><Button title="Copy" small kind="ghost" onPress={() => copy(p.text)} style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#fff' }} /></PostIt>
          ) : null}
          {drop.kind === 'photo' && drop.fileUrl ? (
            <View style={{ backgroundColor: '#fff', padding: 8, paddingBottom: 14, transform: [{ rotate: '-1deg' }] }}>
              <Image source={{ uri: drop.fileUrl }} style={{ width: '100%', height: 300, backgroundColor: '#eee' }} resizeMode="contain" />
              <Button title="Open full size" small kind="ghost" onPress={() => openUrl(drop.fileUrl)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            </View>
          ) : null}
          {drop.kind === 'file' && drop.fileUrl ? <Button title="Open the PDF" icon="file" onPress={() => openUrl(drop.fileUrl)} /> : null}
          {ev ? (
            <PostIt color="pink" tape><PT kind="title">{ev.title}</PT><PT kind="small">{metaLine(ev.date, ev.location)}</PT>{ev.desc ? <PT style={{ marginTop: 6 }}>{ev.desc}</PT> : null}
              <Button title={isSaved(ev.id) ? 'Saved' : 'Save event'} icon="bookmark" small onPress={() => toggleSave(ev)} style={{ marginTop: 10, alignSelf: 'flex-start' }} /></PostIt>
          ) : null}
          {drop.kind === 'group' ? <Button title={p.title || 'Join the group'} icon="users" onPress={async () => { try { const r = await api.groupJoin({ code: p.code }); setSheet({ type: 'group', id: r.data.id }); } catch (e) { showToast(e.message); } }} /> : null}
          {drop.kind === 'plan' ? <Button title="Open the plan" icon="calendarPlus" onPress={() => setSheet({ type: 'plan', id: p.id })} /> : null}
        </>
      )}
      {report && drop ? <ReportSheet kind="drop" id={id} uid={drop.from} name={drop.fromName} onClose={() => setReport(false)} onDone={dismiss} /> : null}
    </Sheet>
  );
}
