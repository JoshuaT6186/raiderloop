/**
 * Discover's public posts: student and org events, "right now" notes
 * (free pizza outside the SUB), and Good to Know tips. No likes and
 * no follower counts: tips rise by how helpful people found them, and
 * events leave the feed after they happen. Everything is moderated,
 * and anything can be reported.
 */
import React, { useEffect, useState } from 'react';
import { View, Pressable, Image } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Chip, Field, Loading, Empty, Stamp, Row,
} from '../ui/Paper';
import { Pushpin } from '../ui/Scrap';
import { WhenPicker, SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, listenDoc } from '../lib/firebase';
import { pickPhoto, upload, uploadError } from '../lib/upload';
import { currentPosition } from '../lib/location';
import { shareThing } from '../lib/share';
import { openUrl } from '../lib/links';
import { BUILDINGS, buildingById, distanceM } from '../data/campus';
import { SHARE } from '../config';
import { ReportSheet } from './Report';
import { timeLeft } from './Story';

export const AREAS = [['all', 'All'], ['campus', 'On campus'], ['near', 'Near campus'], ['lubbock', 'Around Lubbock']];
export const whenText = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(':00', '') : '');

export function PublicPostCard({ p, compact }) {
  const { t } = useTheme();
  const { going, helpful, set, showToast, setSheet, user, isHidden } = useApp();
  const [report, setReport] = useState(false);
  const [checking, setChecking] = useState(false);
  if (isHidden('publicPost', p.id) || isHidden('user', p.uid)) return null;
  const isGoing = going.includes(p.id);
  const isHelpful = helpful.includes(p.id);
  const mine = p.uid === user?.uid;
  const toggleGoing = async () => {
    set((s) => ({ going: isGoing ? s.going.filter((x) => x !== p.id) : [...s.going, p.id] }));
    api.setGoing({ id: p.id, going: !isGoing }).catch(() => {});
  };
  const markHelpful = () => { if (isHelpful) return; set((s) => ({ helpful: [...s.helpful, p.id] })); api.markHelpful({ id: p.id }).catch(() => {}); };
  const now = Date.now(); const start = p.when ? Date.parse(p.when) : 0;
  const canCheckIn = p.kind === 'event' && p.place?.lat != null && now > start - 30 * 60000 && now < start + 3 * 3600000;
  const checkIn = async () => {
    setChecking(true);
    try { const pos = await currentPosition(); if (!pos) throw new Error('Turn on location for Flyer to check in.'); const r = await api.checkIn({ id: p.id, lat: pos.lat, lng: pos.lng }); showToast(r.data.points ? `Checked in · +${r.data.points}` : 'Already checked in'); } catch (e) { showToast(e.message); }
    setChecking(false);
  };
  const color = p.kind === 'now' ? 'orange' : p.kind === 'tip' ? 'yellow' : 'pink';
  return (
    <View style={{ marginBottom: 18 }}>
      <PostIt color={color} seed={p.id} onPress={compact ? () => setSheet({ type: 'publicPost', id: p.id }) : undefined} padding={p.photoUrl && p.kind !== 'tip' ? 0 : 14}>
        <View style={{ position: 'absolute', top: -6, left: '48%', zIndex: 2 }}><Pushpin color={p.kind === 'now' ? '#E0533F' : p.kind === 'tip' ? '#2F5BD3' : '#3FA66A'} /></View>
        {p.photoUrl && p.kind !== 'tip' ? <Image source={{ uri: p.photoUrl }} style={{ width: '100%', height: 150, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} resizeMode="cover" /> : null}
        <View style={{ padding: p.photoUrl && p.kind !== 'tip' ? 14 : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PT kind="tiny" style={{ flex: 1 }}>{p.kind === 'now' ? `Right now · ${timeLeft(p.expiresAt)}` : p.kind === 'event' ? [whenText(p.when), p.place?.name].filter(Boolean).join(' · ') : p.place?.name || 'Good to know'}</PT>
            {p.verified ? <Stamp label="Org" color="#2E8256" /> : null}
          </View>
          <PT kind={p.kind === 'tip' ? 'body' : 'title'} style={{ marginTop: 3, fontSize: p.kind === 'tip' ? 15.5 : 19 }}>{p.title}</PT>
          {p.body && !compact ? <PT style={{ marginTop: 4 }}>{p.body}</PT> : null}
          {p.photoUrl && p.kind === 'tip' ? <Image source={{ uri: p.photoUrl }} style={{ width: '100%', height: 140, marginTop: 8, borderRadius: 4 }} resizeMode="cover" /> : null}
          <PT kind="small" style={{ marginTop: 4 }}>{p.kind === 'tip' ? 'from' : 'posted by'} {p.name}{p.kind === 'event' && p.going ? ` · ${p.going} going` : ''}</PT>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            {p.kind === 'event' ? <Button title={isGoing ? 'Going' : "I'm going"} small kind={isGoing ? 'highlight' : 'ghost'} icon={isGoing ? 'check' : 'ticket'} onPress={toggleGoing} style={{ marginRight: 8, marginBottom: 6, backgroundColor: isGoing ? undefined : '#fff' }} /> : null}
            {p.kind === 'event' ? <Button title="Plan with friends" small kind="ghost" icon="users" onPress={() => setSheet({ type: 'planNew', kind: 'poll', title: `${p.title}?`, options: ["I'm in", 'Maybe', "Can't"] })} style={{ marginRight: 8, marginBottom: 6, backgroundColor: '#fff' }} /> : null}
            {p.kind === 'tip' ? <Button title={isHelpful ? 'Helpful ✓' : 'Helpful'} small kind={isHelpful ? 'highlight' : 'ghost'} onPress={markHelpful} style={{ marginRight: 8, marginBottom: 6, backgroundColor: isHelpful ? undefined : '#fff' }} /> : null}
            {canCheckIn ? <Button title="Check in" small icon="pin" loading={checking} onPress={checkIn} style={{ marginRight: 8, marginBottom: 6 }} /> : null}
            <Pressable onPress={() => shareThing(p.kind === 'tip' ? 'tip' : 'event', { title: p.title, when: whenText(p.when), where: p.place?.name, desc: p.body, img: p.photoUrl, ref: p.id })} hitSlop={8} style={{ marginRight: 14, marginBottom: 6 }} accessibilityLabel="Share"><Icon name="share" size={18} color="#1F2A44" /></Pressable>
            {!mine ? <Pressable onPress={() => setReport(true)} hitSlop={8} style={{ marginBottom: 6 }} accessibilityLabel="Report"><Icon name="flag" size={17} color="#4B5571" /></Pressable>
              : <Pressable onPress={() => api.deletePublicPost({ id: p.id }).then(() => showToast('Deleted')).catch((e) => showToast(e.message))} hitSlop={8} style={{ marginBottom: 6 }} accessibilityLabel="Delete"><Icon name="trash" size={17} color={t.redPen} /></Pressable>}
          </View>
          {p.kind === 'event' && !compact ? <PT kind="small" style={{ marginTop: 2 }}>Leaves the feed after the event.</PT> : null}
        </View>
      </PostIt>
      {report ? <ReportSheet kind="publicPost" id={p.id} uid={p.uid} name={p.name} onClose={() => setReport(false)} /> : null}
    </View>
  );
}

const KINDS = [['event', 'Event', 'ticket'], ['now', 'Right now', 'bolt'], ['tip', 'Good to know', 'sparkle']];

export function PublicNewSheet({ kind: initialKind, draft = {}, onClose }) {
  const { t } = useTheme();
  const { showToast, user, setSheet } = useApp();
  const [kind, setKind] = useState(initialKind || 'event');
  const [title, setTitle] = useState(draft.title || '');
  const [body, setBody] = useState(draft.body || '');
  const [when, setWhen] = useState(draft.when || null);
  const [hours, setHours] = useState(2);
  const [area, setArea] = useState('campus');
  const [placeName, setPlaceName] = useState(draft.placeName || '');
  const [buildingId, setBuildingId] = useState(null);
  const [photo, setPhoto] = useState(draft.photo || null);
  const [orgs, setOrgs] = useState([]);
  const [asOrg, setAsOrg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user && !user.isAnonymous) api.myOrgs({}).then((r) => setOrgs(r.data.orgs || [])).catch(() => {}); }, [user?.uid]);
  useEffect(() => {
    if (placeName || buildingId) return;
    currentPosition().then((pos) => {
      if (!pos) return;
      let best = null;
      BUILDINGS.forEach((b) => { const d = distanceM(pos, b); if (d != null && d < 120 && (!best || d < best.d)) best = { b, d }; });
      if (best) { setPlaceName(best.b.name); setBuildingId(best.b.id); }
    }).catch(() => {});
  }, []);
  if (!user || user.isAnonymous) {
    return <Sheet title="Post to Discover" onClose={onClose}><PostIt color="yellow" tape><PT kind="bold">Posting needs an account</PT><Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10 }} /></PostIt></Sheet>;
  }
  const hits = placeName.length > 1 && !buildingId ? BUILDINGS.filter((b) => b.name.toLowerCase().includes(placeName.toLowerCase())).slice(0, 4) : [];
  const b = buildingId ? buildingById(buildingId) : null;
  const send = async () => {
    setBusy(true);
    try {
      const uploadPath = photo ? await upload(photo) : null;
      const place = { name: placeName.trim(), buildingId, ...(b ? { lat: b.lat, lng: b.lng } : {}) };
      const r = await api.createPublicPost({ kind, title, body, when, hours, area, place, uploadPath, orgId: asOrg });
      showToast(r.data.status === 'pending' ? "Posted. It'll show up after a quick review." : 'Posted to Discover');
      onClose();
    } catch (e) { showToast(uploadError(e)); }
    setBusy(false);
  };
  const ok = title.trim().length >= 3 && (kind !== 'event' || when);
  return (
    <Sheet title="Post to Discover" hand="Public to Flyer users at your school. Checked before it goes up." onClose={onClose} height={0.95}
      footer={<Button title="Post" icon="megaphone" loading={busy} disabled={!ok} onPress={send} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {KINDS.map(([id, label, icon]) => <Chip key={id} label={label} icon={icon} active={kind === id} onPress={() => setKind(id)} />)}
      </View>
      <T kind="small" style={{ marginBottom: 10 }}>{kind === 'event' ? 'Leaves the feed after the event.' : kind === 'now' ? 'For things happening right now. Gone in a few hours.' : 'Useful things to know. Rises when people find it helpful.'}</T>
      <Field label={kind === 'tip' ? 'The tip' : 'Title'} value={title} onChangeText={setTitle} maxLength={120} placeholder={kind === 'event' ? 'Smash Night is back' : kind === 'now' ? 'Free pizza outside the Student Union' : 'Floor 2 study rooms are usually open before 10 AM'} />
      {kind !== 'tip' ? <Field label="Details (optional)" value={body} onChangeText={setBody} multiline maxLength={600} inputStyle={{ minHeight: 70 }} /> : null}
      {kind === 'event' ? <WhenPicker label="When" value={when} onChange={setWhen} days={60} defaultTime="7 PM" /> : null}
      {kind === 'now' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
          {[1, 2, 3, 4].map((h) => <Chip key={h} label={`Gone in ${h}h`} active={hours === h} onPress={() => setHours(h)} />)}
        </View>
      ) : null}
      <Field label="Where" value={placeName} onChangeText={(v) => { setPlaceName(v); setBuildingId(null); }} placeholder="Student Union, or an address" />
      {hits.map((x) => <Row key={x.id} title={x.name} onPress={() => { setPlaceName(x.name); setBuildingId(x.id); setArea('campus'); }} />)}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {AREAS.slice(1).map(([id, label]) => <Chip key={id} label={label} active={area === id} onPress={() => setArea(id)} />)}
      </View>
      {photo ? <Row title="Photo attached" meta="Tap to remove" left={<Icon name="image" color={t.ink} />} onPress={() => setPhoto(null)} /> : (
        <Button title="Add a photo (optional)" icon="image" small kind="ghost" onPress={async () => { try { const p = await pickPhoto(); if (p) setPhoto(p); } catch (e) { showToast(uploadError(e)); } }} style={{ alignSelf: 'flex-start', marginBottom: 10 }} />
      )}
      {orgs.length ? (
        <>
          <T kind="tiny" style={{ marginTop: 6, marginBottom: 6 }}>Post as</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip label="Me" active={!asOrg} onPress={() => setAsOrg(null)} />
            {orgs.map((o) => <Chip key={o.orgId} label={o.orgName} active={asOrg === o.orgId} color="green" onPress={() => setAsOrg(o.orgId)} />)}
          </View>
        </>
      ) : null}
      <SectionNote icon="shield">No personal info about other people, no selling, nothing you wouldn't put on a bulletin board. Posts that break the rules come down.</SectionNote>
    </Sheet>
  );
}

export function PublicPostSheet({ id, onClose }) {
  const { user } = useApp();
  const [p, setP] = useState(undefined);
  useEffect(() => listenDoc(`publicPosts/${id}`, setP), [id]);
  const posterUrl = `${SHARE.base}/poster/${id}`;
  return (
    <Sheet title={p ? p.title : 'Discover'} onClose={onClose}>
      {p === undefined ? <Loading /> : !p ? <Empty icon="megaphone" title="That post is gone." /> : (
        <>
          <PublicPostCard p={p} />
          {p.kind === 'event' && (p.uid === user?.uid) ? (
            <Card>
              <T kind="bold">Print a poster with a QR code</T>
              <T kind="small">Anyone who scans it can save your event, even without Flyer.</T>
              <Button title="Open printable poster" icon="file" small onPress={() => openUrl(posterUrl)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            </Card>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

