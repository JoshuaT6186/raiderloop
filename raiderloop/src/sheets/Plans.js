/**
 * Plans: quick polls ("Study Thursday at 4, 6 or 7?"), "Free tonight?"
 * pings, and study sessions. Friends vote in Flyer; anyone you text
 * the link to can vote on the web page, no app needed.
 */
import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import {
  Sheet, T, PostIt, PT, Button, Chip, Field, Loading, Empty, Check,
} from '../ui/Paper';
import { PersonRow, SectionNote, WhenPicker } from '../ui/Kit';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, listenDoc } from '../lib/firebase';
import { shareUrl } from '../lib/share';
import { linkFor } from '../lib/deeplinks';

const TEMPLATES = [
  { id: 'free', label: 'Free tonight?', icon: 'moon' },
  { id: 'poll', label: 'Quick poll', icon: 'list' },
  { id: 'study', label: 'Study session', icon: 'book' },
];
const whenLabel = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(':00', '');

export function PlanNewSheet({ groupId, title: initialTitle, options: initialOptions, kind: initialKind, onClose }) {
  const { t } = useTheme();
  const { friends, groups, showToast, setSheet, user } = useApp();
  const [kind, setKind] = useState(initialKind || (initialOptions ? 'poll' : 'free'));
  const [title, setTitle] = useState(initialTitle || '');
  const [options, setOptions] = useState(initialOptions || ['', '']);
  const [studyTimes, setStudyTimes] = useState([]);
  const [pending, setPending] = useState(null);
  const [place, setPlace] = useState('');
  const [to, setTo] = useState(() => (groupId ? [] : friends.map((f) => f.uid)));
  const [busy, setBusy] = useState(false);
  const group = groups.find((g) => g.id === groupId);
  if (!user || user.isAnonymous) {
    return <Sheet title="Plans" onClose={onClose}><PostIt color="yellow" tape><PT kind="bold">Plans need an account</PT><Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10 }} /></PostIt></Sheet>;
  }
  const create = async () => {
    setBusy(true);
    try {
      let args;
      if (kind === 'free') args = { kind: 'free', title: title.trim() || "I'm free tonight. Want to hang?", to, groupId };
      else if (kind === 'study') args = { kind: 'poll', title: title.trim() || `Study session${place ? ` at ${place}` : ''}?`, options: studyTimes.map(whenLabel), to, groupId };
      else args = { kind: 'poll', title: title.trim(), options: options.map((o) => o.trim()).filter(Boolean), to, groupId };
      const r = await api.planCreate(args);
      showToast(kind === 'free' ? 'Pinged your circle' : 'Plan sent');
      setSheet({ type: 'plan', id: r.data.id, fresh: true });
    } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  const valid = kind === 'free' ? (to.length || groupId) : kind === 'study' ? studyTimes.length >= 1 : title.trim() && options.filter((o) => o.trim()).length >= 2;
  return (
    <Sheet title={group ? `Ask ${group.name}` : 'Make a plan'} hand="Friends vote in Flyer. Anyone with the link can vote on the web." onClose={onClose} height={0.94}
      footer={<Button title={kind === 'free' ? 'Ping them' : 'Send'} icon="send" loading={busy} disabled={!valid} onPress={create} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {TEMPLATES.map((x) => <Chip key={x.id} label={x.label} icon={x.icon} active={kind === x.id} onPress={() => setKind(x.id)} />)}
      </View>
      {kind === 'free' ? <Field label="Message (optional)" value={title} onChangeText={setTitle} placeholder="I'm free tonight. Want to hang?" maxLength={120} /> : null}
      {kind === 'poll' ? (
        <>
          <Field label="Question" value={title} onChangeText={setTitle} placeholder="Study Thursday at 4, 6 or 7?" maxLength={120} />
          {options.map((o, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Field value={o} onChangeText={(v) => setOptions(options.map((x, j) => (j === i ? v : x)))} placeholder={`Option ${i + 1}`} style={{ flex: 1 }} maxLength={60} />
              {options.length > 2 ? <Pressable onPress={() => setOptions(options.filter((_, j) => j !== i))} hitSlop={10} style={{ marginLeft: 8, marginBottom: 14 }}><Icon name="close" size={18} color={t.faint} /></Pressable> : null}
            </View>
          ))}
          {options.length < 6 ? <Button title="Add option" icon="plus" small kind="ghost" onPress={() => setOptions([...options, ''])} style={{ alignSelf: 'flex-start', marginBottom: 12 }} /> : null}
        </>
      ) : null}
      {kind === 'study' ? (
        <>
          <Field label="Where (optional)" value={place} onChangeText={setPlace} placeholder="Library, 2nd floor" />
          <WhenPicker label="Pick a time to offer" value={pending} onChange={setPending} days={14} />
          <Button title="Add this time" icon="plus" small disabled={!pending} onPress={() => { if (pending && !studyTimes.includes(pending)) setStudyTimes([...studyTimes, pending].slice(0, 6)); setPending(null); }} style={{ alignSelf: 'flex-start', marginBottom: 8 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{studyTimes.map((s) => <Chip key={s} label={`${whenLabel(s)}  ✕`} active color="green" onPress={() => setStudyTimes(studyTimes.filter((x) => x !== s))} />)}</View>
        </>
      ) : null}
      {!groupId ? (
        <>
          <T kind="tiny" style={{ marginTop: 10, marginBottom: 6 }}>Send to</T>
          {friends.length ? friends.map((f, i) => (
            <PersonRow key={f.uid} person={f} last={i === friends.length - 1} onPress={() => setTo((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))}
              right={<Check checked={to.includes(f.uid)} onPress={() => setTo((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))} label={f.name} />} />
          )) : <T kind="small">No friends yet, but you can still text the link to anyone after you make it.</T>}
        </>
      ) : <SectionNote icon="users">Everyone in {group?.name || 'the group'} gets it.</SectionNote>}
    </Sheet>
  );
}

export function PlanSheet({ id, onClose }) {
  const { t } = useTheme();
  const { user, friends, showToast } = useApp();
  const [plan, setPlan] = useState(undefined);
  const [busy, setBusy] = useState(null);
  useEffect(() => listenDoc(`plans/${id}`, setPlan), [id]);
  if (plan === undefined) return <Sheet title="Plan" onClose={onClose}><Loading /></Sheet>;
  if (!plan) return <Sheet title="Plan" onClose={onClose}><Empty icon="calendarPlus" title="That plan is gone." /></Sheet>;
  const mine = plan.owner === user?.uid;
  const open = plan.open && new Date(plan.closesAt) > new Date();
  const who = (uid) => (uid === user?.uid ? { name: 'You', avatar: null } : friends.find((f) => f.uid === uid) || { name: 'Someone', avatar: null });
  const vote = async (optionId) => { setBusy(optionId); try { await api.planVote({ id, optionId }); } catch (e) { showToast(e.message); } setBusy(null); };
  const url = linkFor('plan', id);
  return (
    <Sheet title={plan.title} hand={`${mine ? 'You' : plan.ownerName} asked${open ? '' : ' · voting closed'}`} onClose={onClose}
      footer={(
        <View style={{ flexDirection: 'row' }}>
          <Button title="Text the link" icon="message" kind="ghost" onPress={() => shareUrl(url, plan.title)} style={{ flex: 1, marginRight: mine ? 8 : 0 }} />
          {mine && open ? <Button title="Close voting" kind="ghost" onPress={() => api.planClose({ id }).catch((e) => showToast(e.message))} style={{ flex: 1 }} /> : null}
        </View>
      )}>
      {plan.options.map((o) => {
        const app = plan.votes?.[o.id] || []; const web = plan.webVotes?.[o.id] || [];
        const total = app.length + web.length;
        const me = app.includes(user?.uid);
        return (
          <PostIt key={o.id} color={me ? 'green' : 'yellow'} seed={o.id} onPress={open ? () => vote(o.id) : undefined} style={{ marginBottom: 12 }} accessibilityLabel={`${o.label}, ${total} votes`}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <PT kind="title" style={{ flex: 1, fontSize: 19 }}>{o.label}</PT>
              {busy === o.id ? <Loading label="" /> : <PT kind="title">{total}</PT>}
              {me ? <Icon name="check" color="#2E8256" style={{ marginLeft: 6 }} /> : null}
            </View>
            {total ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                {app.slice(0, 8).map((u) => <Avatar key={u} config={who(u).avatar || {}} size={24} style={{ marginRight: 2 }} />)}
                <PT kind="small" style={{ marginLeft: 4 }}>{[...app.map((u) => who(u).name.split(' ')[0]), ...web].slice(0, 6).join(', ')}</PT>
              </View>
            ) : null}
          </PostIt>
        );
      })}
      {open ? <T kind="small" color={t.pencil}>Tap an option to vote. Tap again to take it back.</T> : null}
    </Sheet>
  );
}
