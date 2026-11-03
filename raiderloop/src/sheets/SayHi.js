/**
 * Say hi: a warm intro to someone who shares a class or an org with
 * you. It's opt-in both ways (you only see people who also turned it
 * on), "Not now" is silent, and every intro can be reported.
 */
import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Toggle, Loading, Empty, Field,
} from '../ui/Paper';
import { FolderTabs, Pill, SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { ReportSheet } from './Report';

const titleCaseOrg = (o) => String(o || '').replace(/\b\w/g, (c) => c.toUpperCase());
export function sharedLine(shared = {}) {
  const items = [...(shared.courses || []), ...(shared.orgs || []).map(titleCaseOrg)];
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function useSayHiSync() {
  const { sayHiVisible, scheduleItems, myCard, user } = useApp();
  const courses = [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => c.title))];
  const orgs = (myCard?.orgs || []).map((o) => o.name);
  return async (visible = sayHiVisible) => {
    if (!user || user.isAnonymous) return null;
    const r = await api.setSayHi({ visible, courses, orgs });
    return r.data;
  };
}

function OptIn() {
  const { sayHiVisible, set, showToast } = useApp();
  const sync = useSayHiSync();
  const [busy, setBusy] = useState(false);
  const toggle = async (v) => {
    setBusy(true);
    try { await sync(v); set({ sayHiVisible: v }); showToast(v ? "You're in Say hi suggestions" : 'Hidden from Say hi'); } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  return (
    <Card style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, opacity: busy ? 0.5 : 1 }}>
          <T kind="bold">Show me in Say hi suggestions</T>
          <T kind="small">People who also turned this on and share a class or org with you can say hi. They see your avatar, first name, major, and what you share. Nothing else.</T>
        </View>
        <Toggle value={sayHiVisible} onChange={toggle} label="Show me in Say hi suggestions" />
      </View>
    </Card>
  );
}

function Suggestions() {
  const { t } = useTheme();
  const { sayHiVisible, showToast, setSheet } = useApp();
  const [list, setList] = useState(null);
  const [writing, setWriting] = useState(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState([]);
  const load = () => api.getSayHi({}).then((r) => setList(r.data.people || [])).catch((e) => { setList([]); showToast(e.message); });
  useEffect(() => { if (sayHiVisible) load(); else setList(null); }, [sayHiVisible]);
  const send = async () => {
    try { await api.sendSayHi({ uid: writing.uid, note }); setSent((s) => [...s, writing.uid]); setWriting(null); setNote(''); showToast('Said hi'); } catch (e) { showToast(e.message); }
  };
  if (!sayHiVisible) return <Empty icon="hand" title="Turn on Say hi to see people" body="Add your classes in the Planner and your orgs on your card for better matches." action="Edit my card" onAction={() => setSheet({ type: 'cardEdit' })} />;
  if (!list) return <Loading label="Looking for people you share things with…" />;
  if (!list.length) return <Empty icon="hand" title="No matches yet" body="As more people in your classes and orgs join Flyer and turn this on, they'll show up here." />;
  return (
    <View>
      <T kind="small" style={{ marginBottom: 8 }}>From classes and orgs you both added.</T>
      {list.map((p) => (
        <Card key={p.uid} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar config={p.avatar} size={46} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T kind="bold">{p.name}</T>
              <T kind="small">{[p.major, p.classYear].filter(Boolean).join(' · ')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {[...(p.shared.courses || []), ...(p.shared.orgs || []).map(titleCaseOrg)].map((x) => <Pill key={x} label={x} color="green" />)}
              </View>
            </View>
            {sent.includes(p.uid) ? <Icon name="check" color={t.ok} /> : <Button title="Say hi" small onPress={() => setWriting(p)} />}
          </View>
        </Card>
      ))}
      {writing ? (
        <Sheet title={`Say hi to ${writing.name.split(' ')[0]}`} onClose={() => setWriting(null)} height={0.6}
          footer={<Button title="Send" icon="send" onPress={send} />}>
          <PostIt color="yellow" tilt={-1}>
            <PT>"Hey! We're both in {sharedLine(writing.shared)}. Want to connect?"</PT>
          </PostIt>
          <Field label="Add a line (optional)" value={note} onChangeText={setNote} maxLength={160} placeholder="Want to study before the exam?" style={{ marginTop: 14 }} />
          <T kind="small">They'll see your avatar, first name, major, and what you share. If they pick "Not now", you won't be told.</T>
        </Sheet>
      ) : null}
    </View>
  );
}

export function IntroCard({ intro }) {
  const { t } = useTheme();
  const { showToast } = useApp();
  const [busy, setBusy] = useState(null);
  const [report, setReport] = useState(false);
  const respond = async (accept) => {
    setBusy(accept ? 'yes' : 'no');
    try { await api.respondSayHi({ uid: intro.uid, accept }); showToast(accept ? `You and ${intro.name.split(' ')[0]} are friends` : 'Okay'); } catch (e) { showToast(e.message); }
    setBusy(null);
  };
  return (
    <PostIt color="green" tape style={{ marginBottom: 16 }} seed={intro.uid}>
      <PT kind="title">{intro.name.split(' ')[0]} says hi!</PT>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <Avatar config={intro.avatar} size={52} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <PT kind="bold">{intro.name}</PT>
          <PT kind="small">{[intro.major, intro.classYear].filter(Boolean).join(' · ')}</PT>
        </View>
      </View>
      <PT kind="tiny" style={{ marginTop: 10 }}>You both have</PT>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[...(intro.shared?.courses || []), ...(intro.shared?.orgs || []).map(titleCaseOrg)].map((x) => <Pill key={x} label={x} />)}
      </View>
      <PT style={{ marginTop: 10 }}>"Hey! We're both in {sharedLine(intro.shared)}. Want to connect?"</PT>
      {intro.note ? <PT style={{ marginTop: 6 }}>"{intro.note}"</PT> : null}
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <Button title="Accept, be friends" small loading={busy === 'yes'} onPress={() => respond(true)} style={{ marginRight: 8 }} />
        <Button title="Not now" small kind="ghost" loading={busy === 'no'} onPress={() => respond(false)} style={{ backgroundColor: '#fff' }} />
      </View>
      <PT kind="small" style={{ marginTop: 8 }}>{intro.name.split(' ')[0]} won't be told if you pick Not now.</PT>
      <Pressable onPress={() => setReport(true)} hitSlop={8} style={{ marginTop: 6 }}><T kind="small" color={t.redPen}>Report or block</T></Pressable>
      {report ? <ReportSheet kind="intro" id={intro.uid} uid={intro.uid} name={intro.name} onClose={() => setReport(false)} onDone={() => api.respondSayHi({ uid: intro.uid, accept: false }).catch(() => {})} /> : null}
    </PostIt>
  );
}

export function SayHiSheet({ tab: initial, onClose }) {
  const { intros, user, setSheet } = useApp();
  const [tab, setTab] = useState(initial || (intros.length ? 'inbox' : 'people'));
  const signedIn = user && !user.isAnonymous;
  return (
    <Sheet title="Say hi" hand="Meet people you already share a class or org with." onClose={onClose} height={0.94}>
      {!signedIn ? (
        <PostIt color="yellow" tape><PT kind="bold">Say hi needs an account</PT><Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10 }} /></PostIt>
      ) : (
        <>
          <OptIn />
          <FolderTabs small value={tab} onChange={setTab} tabs={[
            { id: 'people', label: 'People', icon: 'hand', color: 'green' },
            { id: 'inbox', label: `Hellos${intros.length ? ` (${intros.length})` : ''}`, icon: 'inbox', color: 'yellow', badge: intros.length > 0 },
          ]} />
          {tab === 'people' ? <Suggestions /> : intros.length ? intros.map((i) => <IntroCard key={i.uid} intro={i} />) : <View><SectionNote icon="hand">When someone says hi, it shows up here.</SectionNote></View>}
          <SectionNote icon="lock">Until you're friends, people only see your avatar, name, major, and what you share.</SectionNote>
        </>
      )}
    </Sheet>
  );
}
