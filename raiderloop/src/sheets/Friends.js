/**
 * Friends: list, requests, and location sharing.
 * See lib/location.js for the safety rules sharing follows.
 */
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Sheet, T, PostIt, PT, Card, Button, Row, Chip, Field, Toggle, Empty, Divider } from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, errText } from '../lib/firebase';
import { parseFriendCode, redeemCode } from './QrFriend';
import { ShareLevelPicker } from './FriendProfile';
import { startNearby, nearbyAvailable } from '../lib/nearby';
import { shareText } from '../lib/links';
import { sharingActive, expiryFor, goGhost, getForegroundPermission, lastSeenLabel } from '../lib/location';

const TABS = [
  { id: 'friends', label: 'Friends', icon: 'users' },
  { id: 'requests', label: 'Requests', icon: 'userPlus' },
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
  const { friends, profile, friendLocations, showToast, setSheet, unreadChats } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const raw = code.trim();
    setBusy(true);
    // Invite codes are 8 characters from A–Z (no I or O) and 2–9.
    const token = !raw.startsWith('@') && /^[A-HJ-NP-Z2-9]{8}$/i.test(raw.replace(/[-\s]/g, '')) ? parseFriendCode(raw.replace(/[-\s]/g, '')) : null;
    if (token && (await redeemCode(token, () => {}))) { showToast('Added!'); setCode(''); setBusy(false); return; }
    try { await api.sendFriendRequest({ handle: raw.replace(/^@/, '') }); showToast('Request sent'); setCode(''); } catch (e) { showToast(errText(e, "Couldn't send that request")); }
    setBusy(false);
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        <Button title="My QR code" icon="qr" small onPress={() => setSheet({ type: 'qr', tab: 'mine' })} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Scan a code" icon="scan" small kind="ghost" onPress={() => setSheet({ type: 'qr', tab: 'scan' })} style={{ flex: 1 }} />
      </View>
      <Row title="Messages" meta={unreadChats ? `${unreadChats} unread` : 'Friends and flocks'} left={<Icon name="chat" color={t.ink} />} onPress={() => setSheet({ type: 'chats' })} />
      {profile?.handle ? (
        <Card style={{ marginVertical: 14 }}>
          <T kind="tiny">Your username. Friends type it to send a request</T>
          <T kind="title" style={{ marginTop: 4 }} selectable>@{profile.handle}</T>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Button title="Change" icon="pencil" small kind="ghost" onPress={() => setSheet({ type: 'handle', back: { type: 'friends' } })} style={{ flex: 1, marginRight: 8 }} />
            <Button title="Share" icon="share" small kind="ghost" onPress={() => shareText(`Add me on Flyer! My username is @${profile.handle}`)} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Field placeholder="@username or invite code" value={code} onChangeText={setCode} autoCapitalize="none" style={{ flex: 1, marginRight: 8 }} />
        <Button title="Add" small loading={busy} disabled={code.trim().length < 3} onPress={add} style={{ marginTop: 2 }} />
      </View>
      {friends.length ? friends.map((f, i) => {
        const loc = friendLocations.find((l) => l.uid === f.uid);
        return (
          <Row key={f.uid} title={f.name || f.handle} meta={loc ? `Sharing location with you · ${lastSeenLabel(loc.updatedAt)}` : `@${f.handle}`}
            left={<Avatar config={f.avatar} size={42} />} last={i === friends.length - 1} onPress={() => setSheet({ type: 'friend', uid: f.uid })} />
        );
      }) : <Empty icon="users" title="No friends yet" body="Show your QR code, or add someone with theirs." />}
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
      <T kind="small" style={{ marginTop: 10 }}>Declining is silent. They aren't told.</T>
    </View>
  );
}

function SharingTab() {
  const { sharing, set, friends, showToast } = useApp();
  const active = sharingActive(sharing);
  const update = (patch) => set((p) => ({ sharing: { ...p.sharing, ...patch } }));
  const toggleFriend = (uid) => update({ allowed: sharing.allowed.includes(uid) ? sharing.allowed.filter((x) => x !== uid) : [...sharing.allowed, uid] });
  const start = async (opt) => {
    if (!(await getForegroundPermission(true))) { showToast('Turn on location for Flyer in Settings to share.'); return; }
    if (!sharing.allowed.length) { showToast('Pick at least one friend first.'); return; }
    update({ on: true, until: expiryFor(opt) });
    showToast('Sharing while Flyer is open');
  };
  const ghost = async () => { update({ on: false, until: null }); await goGhost(); showToast('Ghost mode on. Your location was removed.'); };

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
      <T kind="small" style={{ marginTop: 10 }}>Live location is only sent while Flyer is open on your screen.</T>
      <ScheduleSharing />
      <NearbyAlerts />
    </View>
  );
}

function ScheduleSharing() {
  const { friends, scheduleShare } = useApp();
  const n = Object.keys(scheduleShare.levels).filter((k) => friends.some((f) => f.uid === k)).length;
  return (
    <View>
      <Divider />
      <T kind="title">Schedule sharing</T>
      <T kind="small" style={{ marginBottom: 6 }}>{n ? `Shared with ${n} ${n === 1 ? 'friend' : 'friends'}.` : 'Off for everyone.'} Free / busy shows only when you're in class. No class names or rooms.</T>
      {friends.map((f, i) => (
        <View key={f.uid} style={{ paddingVertical: 8, borderBottomWidth: i === friends.length - 1 ? 0 : 1, borderColor: 'rgba(31,42,68,0.12)', borderStyle: 'dashed' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><Avatar config={f.avatar} size={28} /><T kind="bold" style={{ marginLeft: 8 }}>{f.name}</T></View>
          <ShareLevelPicker uid={f.uid} />
        </View>
      ))}
    </View>
  );
}

function NearbyAlerts() {
  const { t } = useTheme();
  const { nearby, set, friends, showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const toggleOn = async (v) => {
    setBusy(true);
    if (v) {
      const r = await startNearby();
      if (!r.ok) { showToast(r.message); setBusy(false); return; }
      set((p) => ({ nearby: { ...p.nearby, on: true } }));
      showToast('Nearby alerts on. Pick friends below.');
    } else {
      set((p) => ({ nearby: { ...p.nearby, on: false } }));
    }
    setBusy(false);
  };
  const toggleFriend = (uid) => set((p) => ({ nearby: { ...p.nearby, allow: p.nearby.allow.includes(uid) ? p.nearby.allow.filter((x) => x !== uid) : [...p.nearby.allow, uid] } }));
  return (
    <View>
      <Divider />
      <Row title="Nearby alerts" meta="Get a heads-up when a friend is close by on campus" right={<Toggle value={nearby.on} onChange={busy ? () => {} : toggleOn} label="Nearby alerts" />} last />
      {!nearbyAvailable() ? <T kind="small">Nearby alerts need the full app build.</T> : null}
      {nearby.on ? friends.map((f, i) => (
        <Row key={f.uid} title={f.name || f.handle} left={<Avatar config={f.avatar} size={32} />} last={i === friends.length - 1}
          right={<Toggle value={nearby.allow.includes(f.uid)} onChange={() => toggleFriend(f.uid)} label={`Nearby alerts with ${f.name}`} />} />
      )) : null}
      <T kind="small" color={t.pencil} style={{ marginTop: 6 }}>
        Both of you have to pick each other. Nobody sees where you are, just "Maya is nearby". Campus only, never 11 PM–7 AM, at most once every 3 hours per friend. Like automatic check-ins, this uses location in the background, so iOS will ask for "Always" access.
      </T>
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
          {tab === 'sharing' ? <SharingTab /> : null}
        </>
      )}
    </Sheet>
  );
}
