/**
 * Connect card: one card (no modes), with a QR code, Apple Wallet, and
 * a "Choose what shows" control for every field. Face photos are only
 * ever shown to friends (and teammates during a photo swap).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, Image, Linking, ScrollView } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Chip, Field, Loading, Empty, Divider, Stamp,
} from '../ui/Paper';
import { QRCode, Pill, SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { Washi } from '../ui/Scrap';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { pickPhoto, upload, uploadError } from '../lib/upload';
import { shareUrl } from '../lib/share';
import { linkFor } from '../lib/deeplinks';
import { openUrl } from '../lib/links';
import { ORGS } from '../data/campus';
import { CLASS_YEARS } from '../data/majors';
import { POSTIT_KEYS } from '../theme/tokens';
import { ReportSheet } from './Report';

const INK = '#1F2A44';
const LINK_LABELS = ['Portfolio', 'GitHub', 'LinkedIn', 'Instagram', 'Website', 'Resume', 'Other'];
const DEFAULT_SHOW = { major: 'everyone', headline: 'everyone', orgs: 'everyone', links: 'everyone', email: 'friends', phone: 'off', face: 'friends' };
const SHOW_LABEL = { off: 'Hidden', friends: 'Friends', everyone: 'Everyone' };

/* ---------- The card itself ---------- */
export function CardFace({ name, handle, avatar, card = {}, faceUrl, relation, compact, onLink }) {
  const color = card.color || 'yellow';
  return (
    <View>
      <PostIt color={color} tilt={-0.8} padding={16} fold>
        <Washi width={70} angle={-4} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {faceUrl ? (
            <View style={{ backgroundColor: '#fff', padding: 4, paddingBottom: 10, transform: [{ rotate: '-3deg' }], marginRight: 12 }}>
              <Image source={{ uri: faceUrl }} style={{ width: compact ? 54 : 70, height: compact ? 54 : 70, backgroundColor: '#eee' }} />
            </View>
          ) : <Avatar config={avatar || {}} size={compact ? 58 : 72} style={{ marginRight: 12 }} />}
          <View style={{ flex: 1 }}>
            <PT kind="title" style={{ fontSize: compact ? 19 : 22 }} numberOfLines={1}>{name || 'Your name'}</PT>
            {card.major || card.classYear ? <PT kind="small">{[card.major, card.classYear].filter(Boolean).join(' · ')}</PT> : null}
            {handle ? <PT kind="bold" style={{ marginTop: 2 }}>@{handle}</PT> : null}
          </View>
        </View>
        {card.headline ? <PT style={{ marginTop: 10 }}>{card.headline}</PT> : null}
        {!compact && (card.email || card.phone) ? (
          <View style={{ marginTop: 10 }}>
            {card.email ? <Pressable onPress={() => Linking.openURL(`mailto:${card.email}`).catch(() => {})}><PT kind="small">✉︎ {card.email}</PT></Pressable> : null}
            {card.phone ? <Pressable onPress={() => Linking.openURL(`tel:${card.phone.replace(/[^\d+]/g, '')}`).catch(() => {})}><PT kind="small">☎︎ {card.phone}</PT></Pressable> : null}
          </View>
        ) : null}
        {(card.orgs || []).length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {card.orgs.slice(0, compact ? 3 : 8).map((o) => <Pill key={o.name} label={o.name} />)}
          </View>
        ) : null}
        {!compact && (card.links || []).length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {card.links.map((l) => (
              <Pressable key={l.url} onPress={() => (onLink ? onLink(l) : openUrl(l.url))} accessibilityRole="link" style={{ marginRight: 8, marginTop: 6, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 10, paddingVertical: 4 }}>
                <PT kind="small" style={{ fontWeight: '700', color: INK }}>{l.label} ↗</PT>
              </Pressable>
            ))}
          </View>
        ) : null}
        {relation === 'school' ? <PT kind="small" style={{ marginTop: 10 }}>You see what they share with everyone. Friends see a bit more.</PT> : null}
      </PostIt>
    </View>
  );
}

/* ---------- Visibility chips ---------- */
function ShowPicker({ value, onChange, allow = ['off', 'friends', 'everyone'] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -6, marginBottom: 6 }}>
      {allow.map((k) => <Chip key={k} label={SHOW_LABEL[k]} active={value === k} onPress={() => onChange(k)} style={{ paddingVertical: 4 }} />)}
    </View>
  );
}

/* ---------- Edit ---------- */
export function CardEditSheet({ onClose }) {
  const { t } = useTheme();
  const { myCard, userMajor, userClassYear, userName, avatar, profile, showToast, sayHiVisible, scheduleItems } = useApp();
  const [draft, setDraft] = useState(() => ({
    headline: '', major: userMajor || '', classYear: userClassYear || '', email: '', phone: '', orgs: [], links: [], color: 'yellow',
    ...(myCard || {}), show: { ...DEFAULT_SHOW, ...((myCard && myCard.show) || {}) },
  }));
  const [orgQ, setOrgQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const set = (patch) => setDraft((p) => ({ ...p, ...patch }));
  const setShow = (k, v) => setDraft((p) => ({ ...p, show: { ...p.show, [k]: v } }));
  const orgHits = useMemo(() => {
    const q = orgQ.trim().toLowerCase();
    if (q.length < 2) return [];
    return ORGS.filter((o) => o.name.toLowerCase().includes(q) && !draft.orgs.some((x) => x.name === o.name)).slice(0, 6);
  }, [orgQ, draft.orgs]);
  const addOrg = (o) => { if (draft.orgs.length >= 8) return; set({ orgs: [...draft.orgs, o] }); setOrgQ(''); };
  const setLink = (i, patch) => set({ links: draft.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const save = async () => {
    setBusy(true);
    const links = draft.links.map((l) => ({ ...l, url: /^https?:\/\//.test(l.url.trim()) ? l.url.trim().replace(/^http:/, 'https:') : l.url.trim() ? `https://${l.url.trim()}` : '' })).filter((l) => l.url);
    try {
      await api.saveCard({ ...draft, links });
      if (sayHiVisible) {
        const courses = [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => c.title))];
        api.setSayHi({ visible: true, courses, orgs: draft.orgs.map((o) => o.name) }).catch(() => {});
      }
      showToast('Card saved');
      onClose();
    } catch (e) { showToast(e.message || "Couldn't save your card."); }
    setBusy(false);
  };

  const face = async (camera) => {
    setFaceBusy(true);
    try {
      const p = await pickPhoto({ camera, maxSide: 900 });
      if (p) { const path = await upload(p); await api.setFacePhoto({ uploadPath: path }); showToast('Face photo added (friends only)'); }
    } catch (e) { showToast(uploadError(e)); }
    setFaceBusy(false);
  };
  const removeFace = async () => { try { await api.setFacePhoto({ remove: true }); showToast('Face photo removed'); } catch (e) { showToast(e.message); } };

  return (
    <Sheet title="Your card" hand="Choose what shows, and who sees it." onClose={onClose} height={0.94}
      footer={<Button title="Save card" icon="check" loading={busy} onPress={save} />}>
      <CardFace name={userName} handle={profile?.handle} avatar={avatar} card={draft} faceUrl={myCard?.faceUrl} />
      <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 6 }}>
        {POSTIT_KEYS.map((c) => (
          <Pressable key={c} onPress={() => set({ color: c })} accessibilityLabel={`${c} card`} style={{ width: 30, height: 30, borderRadius: 15, marginRight: 8, backgroundColor: t.postit[c], borderWidth: draft.color === c ? 3 : 1.5, borderColor: draft.color === c ? INK : t.border }} />
        ))}
      </View>

      <Field label="One line about you" value={draft.headline} onChangeText={(v) => set({ headline: v })} maxLength={90} placeholder="Game dev, photo nerd, always down for tacos" />
      <ShowPicker value={draft.show.headline} onChange={(v) => setShow('headline', v)} />
      <Field label="Major" value={draft.major} onChangeText={(v) => set({ major: v })} placeholder="Exploring Computer Science" />
      <ShowPicker value={draft.show.major} onChange={(v) => setShow('major', v)} />
      <T kind="tiny" style={{ marginBottom: 6 }}>Class</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {CLASS_YEARS.map((y) => <Chip key={y} label={y} active={draft.classYear === y} onPress={() => set({ classYear: y })} />)}
      </View>

      <Divider />
      <Field label="School email" value={draft.email} onChangeText={(v) => set({ email: v })} autoCapitalize="none" keyboardType="email-address" placeholder="you@ttu.edu" />
      <ShowPicker value={draft.show.email} onChange={(v) => setShow('email', v)} />
      <Field label="Phone" value={draft.phone} onChangeText={(v) => set({ phone: v })} keyboardType="phone-pad" placeholder="Optional" />
      <ShowPicker value={draft.show.phone} onChange={(v) => setShow('phone', v)} allow={['off', 'friends']} />

      <Divider />
      <T kind="tiny" style={{ marginBottom: 6 }}>Orgs I'm in</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {draft.orgs.map((o) => <Chip key={o.name} label={`${o.name}  ✕`} active color="green" onPress={() => set({ orgs: draft.orgs.filter((x) => x.name !== o.name) })} />)}
      </View>
      <Field placeholder="Search your clubs and orgs…" value={orgQ} onChangeText={setOrgQ} />
      {orgHits.map((o) => <Row key={o.id} title={o.name} meta={o.tags} onPress={() => addOrg({ id: o.id, name: o.name })} />)}
      {orgQ.trim().length > 2 && !orgHits.some((o) => o.name.toLowerCase() === orgQ.trim().toLowerCase()) ? <Button title={`Add "${orgQ.trim()}"`} small kind="ghost" onPress={() => addOrg({ id: '', name: orgQ.trim() })} style={{ alignSelf: 'flex-start', marginBottom: 8 }} /> : null}
      <ShowPicker value={draft.show.orgs} onChange={(v) => setShow('orgs', v)} />

      <Divider />
      <T kind="tiny" style={{ marginBottom: 6 }}>Links</T>
      {draft.links.map((l, i) => (
        <Card key={i} style={{ marginBottom: 10 }} header={false} padding={10}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {LINK_LABELS.map((lab) => <Chip key={lab} label={lab} active={l.label === lab} onPress={() => setLink(i, { label: lab })} style={{ paddingVertical: 4 }} />)}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Field value={l.url} onChangeText={(v) => setLink(i, { url: v })} placeholder="https://" autoCapitalize="none" keyboardType="url" style={{ flex: 1, marginBottom: 0 }} />
            <Pressable onPress={() => set({ links: draft.links.filter((_, j) => j !== i) })} hitSlop={10} style={{ marginLeft: 8 }} accessibilityLabel="Remove link"><Icon name="trash" size={18} color={t.redPen} /></Pressable>
          </View>
        </Card>
      ))}
      {draft.links.length < 6 ? <Button title="Add a link" icon="plus" small kind="ghost" onPress={() => set({ links: [...draft.links, { label: 'Portfolio', url: '' }] })} style={{ alignSelf: 'flex-start' }} /> : null}
      <View style={{ marginTop: 8 }}><ShowPicker value={draft.show.links} onChange={(v) => setShow('links', v)} /></View>

      <Divider />
      <T kind="tiny" style={{ marginBottom: 6 }}>Face photo · friends only</T>
      <T kind="small" style={{ marginBottom: 8 }}>Everyone else sees your avatar. Teammates can see it only if you both agree to swap during a project.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Button title={myCard?.faceUrl ? 'New photo' : 'Take a photo'} icon="camera" small kind="ghost" loading={faceBusy} onPress={() => face(true)} style={{ marginRight: 8, marginBottom: 8 }} />
        <Button title="Choose a photo" icon="image" small kind="ghost" disabled={faceBusy} onPress={() => face(false)} style={{ marginRight: 8, marginBottom: 8 }} />
        {myCard?.faceUrl ? <Button title="Remove" small kind="danger" onPress={removeFace} style={{ marginBottom: 8 }} /> : null}
      </View>
      <ShowPicker value={draft.show.face} onChange={(v) => setShow('face', v)} allow={['off', 'friends']} />
      <SectionNote icon="lock">Everything here is optional. Your schedule, location and grades are never on your card.</SectionNote>
    </Sheet>
  );
}

/* ---------- Someone's card ---------- */
export function CardViewSheet({ uid, handle, onClose }) {
  const { t } = useTheme();
  const { showToast, setSheet, user } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    api.getCard(uid ? { uid } : { handle }).then((r) => setData(r.data)).catch((e) => setError(e.message || "Couldn't load that card."));
  }, [uid, handle]);
  const add = async () => {
    try { await api.sendFriendRequest({ uid: data.uid }); setSent(true); showToast('Request sent'); } catch (e) { showToast(e.message); }
  };
  const signedIn = user && !user.isAnonymous;
  return (
    <Sheet title={data ? data.name : 'Connect card'} hand={data ? `@${data.handle}` : ''} onClose={onClose}
      headerRight={data && data.relation !== 'self' ? <Pressable onPress={() => setReport(true)} hitSlop={10} accessibilityLabel="Report or block" style={{ marginTop: 8 }}><Icon name="flag" size={18} color={t.pencil} /></Pressable> : null}
      footer={data && data.relation === 'school' ? (
        signedIn ? <Button title={sent || data.requestSent ? 'Request sent' : 'Add friend'} icon="userPlus" disabled={sent || data.requestSent} onPress={add} />
          : <Button title="Make an account to add friends" kind="ghost" onPress={() => setSheet({ type: 'account' })} />
      ) : data && data.relation === 'friend' ? (
        <View style={{ flexDirection: 'row' }}>
          <Button title="Story" icon="image" kind="ghost" onPress={() => setSheet({ type: 'story', uid: data.uid, name: data.name })} style={{ flex: 1, marginRight: 8 }} />
          <Button title="Send a Drop" icon="plane" onPress={() => setSheet({ type: 'drop', to: data.uid })} style={{ flex: 1 }} />
        </View>
      ) : null}>
      {error ? <Empty icon="users" title={error} /> : !data ? <Loading label="Opening the card…" /> : (
        <>
          <CardFace name={data.name} handle={data.handle} avatar={data.avatar} card={data.card} faceUrl={data.faceUrl} relation={data.relation} />
          {data.relation === 'friend' ? <Stamp label="Friends" color={t.ok} style={{ marginTop: 14 }} /> : null}
          {data.relation === 'self' ? <Button title="Edit my card" icon="pencil" kind="ghost" small onPress={() => setSheet({ type: 'cardEdit' })} style={{ marginTop: 14, alignSelf: 'flex-start' }} /> : null}
        </>
      )}
      {report && data ? <ReportSheet kind="card" id={data.uid} uid={data.uid} name={data.name} onClose={() => setReport(false)} onDone={onClose} /> : null}
    </Sheet>
  );
}

/* ---------- My QR + Wallet ---------- */
export function MyQRSheet({ onClose }) {
  const { t } = useTheme();
  const { profile, userName, showToast, setSheet } = useApp();
  const [wallet, setWallet] = useState(false);
  const handle = profile?.handle;
  const url = handle ? linkFor('card', handle) : '';
  const addWallet = async () => {
    setWallet(true);
    try { const r = await api.walletLink({}); Linking.openURL(r.data.url).catch(() => openUrl(r.data.url)); } catch (e) { showToast(e.message || "Apple Wallet isn't available yet."); }
    setWallet(false);
  };
  return (
    <Sheet title="Your QR" hand="Anyone can scan this with their camera." onClose={onClose}>
      {!handle ? <Empty icon="qr" title="Make an account to get your card" /> : (
        <View style={{ alignItems: 'center' }}>
          <PostIt color="yellow" tilt={-1} padding={18} style={{ alignItems: 'center' }}>
            <QRCode value={url} size={210} />
            <PT kind="title" style={{ marginTop: 10 }}>{userName}</PT>
            <PT kind="bold">@{handle}</PT>
          </PostIt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
            <Button title="Add to Apple Wallet" icon="wallet" small loading={wallet} onPress={addWallet} style={{ marginRight: 8, marginBottom: 8 }} />
            <Button title="Share link" icon="share" small kind="ghost" onPress={() => shareUrl(url, `${userName} on Flyer`)} style={{ marginRight: 8, marginBottom: 8 }} />
            <Button title="Scan someone" icon="scan" small kind="ghost" onPress={() => setSheet({ type: 'scan' })} style={{ marginBottom: 8 }} />
          </View>
          <T kind="small" style={{ textAlign: 'center', marginTop: 6 }} color={t.pencil}>The QR shows only what you set to Everyone on your card.</T>
        </View>
      )}
    </Sheet>
  );
}
