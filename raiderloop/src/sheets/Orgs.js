/**
 * Org officers: ask to be confirmed for your org (you approve these by
 * hand in the Admin screen for now), then post events as the org and
 * print poster QR codes. Confirmed orgs get a small "Org" stamp; it
 * means "confirmed by Flyer", not "official university".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Field, Loading,
} from '../ui/Paper';
import { SectionNote, Pill } from '../ui/Kit';
import { useApp } from '../state/AppContext';
import { api, listenMyPublic } from '../lib/firebase';
import { openUrl } from '../lib/links';
import { ORGS } from '../data/campus';
import { SHARE } from '../config';
import { whenText } from './Public';

export function OrgsSheet({ orgId: presetId, onClose }) {
  const { user, setSheet, showToast } = useApp();
  const preset = ORGS.find((o) => o.id === presetId);
  const [mine, setMine] = useState(null);
  const [q, setQ] = useState(preset ? preset.name : '');
  const [org, setOrg] = useState(preset || null);
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState([]);
  const signedIn = user && !user.isAnonymous;
  const load = () => api.myOrgs({}).then((r) => setMine(r.data)).catch(() => setMine({ orgs: [], pending: [] }));
  useEffect(() => { if (signedIn) load(); }, [signedIn]);
  useEffect(() => (signedIn ? listenMyPublic(user.uid, (list) => setEvents(list.filter((p) => p.kind === 'event' && p.orgId))) : undefined), [signedIn]);
  const hits = useMemo(() => (q.trim().length > 1 && !org ? ORGS.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : []), [q, org]);
  if (!signedIn) return <Sheet title="Org officers" onClose={onClose}><PostIt color="yellow" tape><PT kind="bold">This needs an account</PT><Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10 }} /></PostIt></Sheet>;
  const claim = async () => {
    setBusy(true);
    try { const r = await api.claimOrg({ orgId: org.id, orgName: org.name, role, email, note }); showToast(r.data.status === 'approved' ? "You're already confirmed" : "Sent. You'll get a notification when it's approved."); setOrg(null); setQ(''); load(); } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  return (
    <Sheet title="Org officers" hand="Post events as your org, with a poster QR." onClose={onClose} height={0.95}>
      {mine === null ? <Loading /> : (
        <>
          {mine.orgs.map((o) => (
            <PostIt key={o.orgId} color="green" tape seed={o.orgId} style={{ marginBottom: 14 }}>
              <PT kind="tiny">Confirmed</PT><PT kind="title">{o.orgName}</PT>
              <Button title="Post an event as this org" icon="megaphone" small onPress={() => setSheet({ type: 'publicNew', kind: 'event' })} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            </PostIt>
          ))}
          {mine.pending.map((o) => <Row key={o.orgId} title={o.orgName} meta="Waiting for review" right={<Pill label="Pending" />} />)}
          {events.length ? (
            <Card style={{ marginTop: 10 }}>
              <T kind="tiny" style={{ marginBottom: 4 }}>Your org events · print a poster</T>
              {events.map((e, i) => <Row key={e.id} title={e.title} meta={[whenText(e.when), e.status !== 'live' ? 'waiting for review' : null].filter(Boolean).join(' · ')} onPress={() => openUrl(`${SHARE.base}/poster/${e.id}`)} last={i === events.length - 1} />)}
            </Card>
          ) : null}
        </>
      )}
      <T kind="tiny" style={{ marginTop: 18, marginBottom: 6 }}>Ask to be confirmed</T>
      <Field placeholder="Find your org…" value={org ? org.name : q} onChangeText={(v) => { setOrg(null); setQ(v); }} />
      {hits.map((o) => <Row key={o.id} title={o.name} meta={o.tags} onPress={() => setOrg(o)} />)}
      {org ? (
        <>
          <Field label="Your role" value={role} onChangeText={setRole} placeholder="President, social chair…" />
          <Field label="Org email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="The org's official email, if it has one" />
          <Field label="Anything that helps us check (optional)" value={note} onChangeText={setNote} multiline inputStyle={{ minHeight: 60 }} placeholder="Link to your TechConnect page, or who can vouch for you" />
          <Button title="Send for review" icon="send" loading={busy} disabled={role.trim().length < 2} onPress={claim} />
        </>
      ) : null}
      <SectionNote icon="shield">A real person checks every request. The "Org" stamp means confirmed by Flyer, not endorsed by the university.</SectionNote>
      <View style={{ height: 8 }} />
    </Sheet>
  );
}
