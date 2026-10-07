/**
 * Friends: list, requests, classmates (opt-in), and location sharing.
 * See lib/location.js for the safety rules sharing follows.
 */
import React, { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { Sheet, T, PostIt, PT, Card, Button, Row, Chip, Field, Toggle, Empty, Divider } from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { shareText } from '../lib/links';
import { sharingActive, expiryFor, goGhost, getForegroundPermission, lastSeenLabel } from '../lib/location';

const TABS = [
  { id: 'friends', label: 'Friends', icon: 'users' },
  { id: 'requests', label: 'Requests', icon: 'userPlus' },
  { id: 'classmates', label: 'Classmates', icon: 'cap' },
  { id: 'sharing', label: 'Sharing', icon: 'location' },
];

function NeedsAccount() {
  const { setSheet } = useApp();
  return (
    <PostIt color="yellow" tilt={-1} tape>
      <PT kind="title">Friends need an account</PT>
      <PT kind="small" style={{ marginTop: 4 }}>So people know it's really you. It takes 20 seconds and keeps everything you've set up.</PT>
      <Button title="Make an account" icon="userPlus" onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 12 }} small />
    </PostIt>
  );
}

function FriendsTab() {
  const { t } = useTheme();
  const { friends, profile, friendLocations, showToast } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try { await api.sendFriendRequest({ handle: code.trim().replace(/^@/, '') }); showToast('Request sent'); setCode(''); } catch (e) { showToast(e.message || "Couldn't send that request"); }
    setBusy(false);
  };
  const manage = (f) => Alert.alert(f.name || 'Friend', undefined, [
    { text: 'Remove friend', style: 'destructive', onPress: () => api.removeFriend({ uid: f.uid }).then(() => showToast('Removed')).catch(() => {}) },
    { text: 'Block', style: 'destructive', onPress: () => api.blockUser({ uid: f.uid }).then(() => showToast('Blocked — they can\'t find or add you')).catch(() => {}) },
    { text: 'Cancel', style: 'cancel' },
  ]);
  return (
    <View>
      {profile?.handle ? (
        <Card style={{ marginBottom: 14 }}>
          <T kind="tiny">Your friend code</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <T kind="marker" style={{ fontSize: 26, flex: 1 }}>@{profile.handle}</T>
            <Button title="Share" icon="share" small kind="ghost" onPress={() => shareText(`Add me on Flyer — my friend code is @${profile.handle}`)} />
          </View>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Field placeholder="Friend's code, e.g. @josh26" value={code} onChangeText={setCode} autoCapitalize="none" style={{ flex: 1, marginRight: 8 }} />
        <Button title="Add" small loading={busy} disabled={code.trim().length < 3} onPress={add} style={{ marginTop: 2 }} />
      </View>
      {friends.length ? friends.map((f, i) => {
        const loc = friendLocations.find((l) => l.uid === f.uid);
        return (
          <Row key={f.uid} title={f.name || f.handle} meta={loc ? `Sharing location with you · ${lastSeenLabel(loc.updatedAt)}` : `@${f.handle}`}
            left={<Avatar config={f.avatar} size={42} />} last={i === friends.length - 1}
            right={<Pressable onPress={() => manage(f)} hitSlop={10} accessibilityLabel={`Manage ${f.name}`}><Icon name="gear" size={18} color={t.faint} /></Pressable>} />
        );
      }) : <Empty icon="users" title="No friends yet" body="Share your code, or add someone with theirs." />}
    </View>
  );
}

function RequestsTab() {
  const { requests, showToast } = useApp();
  const respond = (r, accept) => api.respondFriendRequest({ uid: r.uid, accept }).then(() => showToast(accept ? `You and ${r.name} are friends` : 'Declined')).catch((e) => showToast(e.message));
  if (!requests.length) return <Empty icon="userPlus" title="No requests right now" />;
  return (
    <View>
      {requests.map((r, i) => (
        <Row key={r.uid} title={r.name || r.handle} meta={`@${r.handle}`} left={<Avatar config={r.avatar} size={42} />} last={i === requests.length - 1}
          right={(
            <View style={{ flexDirection: 'row' }}>
              <Button title="Accept" small onPress={() => respond(r, true)} style={{ marginRight: 6 }} />
              <Button title="No" small kind="ghost" onPress={() => respond(r, false)} />
            </View>
          )} />
      ))}
      <T kind="small" style={{ marginTop: 10 }}>Declining is silent — they aren't told.</T>
    </View>
  );
}

function ClassmatesTab() {
  const { classmatesOptIn, set, scheduleItems, showToast, friends } = useApp();
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const courses = [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => c.title))];
  const toggle = async (v) => {
    set({ classmatesOptIn: v });
    try { await api.setClassmateOptIn({ optIn: v, courses: v ? courses : [] }); } catch (e) { showToast(e.message); }
    if (!v) setResults(null);
  };
  const search = async () => {
    setBusy(true);
    try { const r = await api.findClassmates({ courses }); setResults(r.data?.matches || []); } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  return (
    <View>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <T kind="bold">Find classmates</T>
            <T kind="small">Show your course codes (not times or rooms) to other Flyer users who also opt in, so you can find study partners.</T>
          </View>
          <Toggle value={classmatesOptIn} onChange={toggle} label="Find classmates" />
        </View>
      </Card>
      {classmatesOptIn ? (
        <View style={{ marginTop: 14 }}>
          <Button title="Look for classmates" icon="search" small loading={busy} disabled={!courses.length} onPress={search} />
          {!courses.length ? <T kind="small" style={{ marginTop: 6 }}>Add classes in the Planner first.</T> : null}
          {results ? (results.length ? results.map((m) => (
            <PostIt key={m.course} color="blue" seed={m.course} style={{ marginTop: 14 }}>
              <PT kind="title">{m.course}</PT>
              <PT kind="small">{m.count} other {m.count === 1 ? 'student' : 'students'} on Flyer</PT>
              {(m.people || []).map((p) => (
                <View key={p.uid} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <Avatar config={p.avatar} size={34} />
                  <PT kind="bold" style={{ flex: 1, marginLeft: 8 }}>{p.name}</PT>
                  {friends.some((f) => f.uid === p.uid) ? <PT kind="small">friends</PT> : (
                    <Button title="Add" small kind="ghost" onPress={() => api.sendFriendRequest({ uid: p.uid }).then(() => showToast('Request sent')).catch((e) => showToast(e.message))} />
                  )}
                </View>
              ))}
            </PostIt>
          )) : <Empty icon="cap" title="No classmates on Flyer yet" body="Invite friends from your classes — the more people opt in, the more this finds." />) : null}
        </View>
      ) : null}
    </View>
  );
}

function SharingTab() {
  const { sharing, set, friends, showToast } = useApp();
  const active = sharingActive(sharing);
  const update = (patch) => set((p) => ({ sharing: { ...p.sharing, ...patch } }));
  const toggleFriend = (uid) => update({ allowed: sharing.allowed.includes(uid) ? sharing.allowed.filter((x) => x !== uid) : [...sharing.allowed, uid] });
  const start = async (opt) => {
    if (!(await getForegroundPermission(true))) { showToast('Location is off for Flyer — turn it on in Settings to share.'); return; }
    if (!sharing.allowed.length) { showToast('Pick at least one friend first.'); return; }
    update({ on: true, until: expiryFor(opt) });
    showToast('Sharing while Flyer is open');
  };
  const ghost = async () => { update({ on: false, until: null }); await goGhost(); showToast('Ghost mode — your location was removed'); };

  return (
    <View>
      <PostIt color={active ? 'green' : 'lavender'} tilt={-1} tape>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name={active ? 'location' : 'ghost'} color="#1F2A44" size={26} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <PT kind="title">{active ? 'Sharing is on' : 'You\'re invisible'}</PT>
            <PT kind="small">{active ? `${sharing.allowed.length} ${sharing.allowed.length === 1 ? 'friend' : 'friends'} · ${sharing.until ? `until ${new Date(sharing.until).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'until you turn it off'}` : 'Nobody can see where you are.'}</PT>
          </View>
        </View>
        {active ? <Button title="Go invisible now" icon="ghost" kind="ghost" onPress={ghost} style={{ marginTop: 12, backgroundColor: '#fff' }} small /> : null}
      </PostIt>

      <T kind="tiny" style={{ marginTop: 18, marginBottom: 6 }}>Who can see you</T>
      {friends.length ? friends.map((f, i) => (
        <Row key={f.uid} title={f.name || f.handle} left={<Avatar config={f.avatar} size={36} />} last={i === friends.length - 1}
          right={<Toggle value={sharing.allowed.includes(f.uid)} onChange={() => toggleFriend(f.uid)} label={`Share with ${f.name}`} />} />
      )) : <T kind="small">Add friends first.</T>}
      <T kind="small" style={{ marginTop: 6 }}>Turning someone off is quiet. They aren't notified, and to them it looks the same as you not sharing at all.</T>

      <Divider />
      <Row title="Precise location" meta="Off = rounded to about a block" right={<Toggle value={!!sharing.precise} onChange={(v) => update({ precise: v })} label="Precise location" />} />
      <Row title="Only on campus" meta="Stops automatically when you leave campus" right={<Toggle value={!!sharing.campusOnly} onChange={(v) => update({ campusOnly: v })} label="Only on campus" />} last />

      {!active ? (
        <>
          <T kind="tiny" style={{ marginTop: 16, marginBottom: 8 }}>Start sharing</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip label="For 1 hour" icon="clock" onPress={() => start('1h')} />
            <Chip label="Until tonight" icon="moon" onPress={() => start('tonight')} />
            <Chip label="Until I stop" icon="location" onPress={() => start('forever')} />
          </View>
        </>
      ) : null}
      <T kind="small" style={{ marginTop: 10 }}>Location is only sent while Flyer is open on your screen — never in the background.</T>
    </View>
  );
}

export default function FriendsSheet({ initialTab, onClose }) {
  const { t } = useTheme();
  const { user, requests } = useApp();
  const [tab, setTab] = useState(initialTab || 'friends');
  const signedIn = user && !user.isAnonymous;
  return (
    <Sheet title="Friends" hand="Your people, on your terms." onClose={onClose} height={0.92}>
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        {TABS.map((x) => (
          <Pressable key={x.id} onPress={() => setTab(x.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 3, borderColor: tab === x.id ? t.accent : 'transparent' }}>
            <Icon name={x.icon} size={18} color={tab === x.id ? t.accent : t.pencil} />
            <T kind="small" color={tab === x.id ? t.accent : t.pencil} style={{ fontSize: 12 }}>{x.label}{x.id === 'requests' && requests.length ? ` (${requests.length})` : ''}</T>
          </Pressable>
        ))}
      </View>
      {!signedIn ? <NeedsAccount /> : (
        <>
          {tab === 'friends' ? <FriendsTab /> : null}
          {tab === 'requests' ? <RequestsTab /> : null}
          {tab === 'classmates' ? <ClassmatesTab /> : null}
          {tab === 'sharing' ? <SharingTab /> : null}
        </>
      )}
    </Sheet>
  );
}
