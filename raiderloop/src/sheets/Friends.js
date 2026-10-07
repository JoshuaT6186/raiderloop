/**
 * Friends: list, requests, classmates (opt-in), and location sharing.
 * See lib/location.js for the safety rules sharing follows.
 */
import React, { useEffect, useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { Sheet, T, PostIt, PT, Card, Button, Row, Chip, Field, Toggle, Empty, Divider } from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, errText, schoolVerified, refreshSchoolVerification } from '../lib/firebase';
import { parseFriendCode, redeemCode } from './QrFriend';
import { ShareLevelPicker } from './FriendProfile';
import { startNearby, stopNearby, nearbyAvailable } from '../lib/nearby';
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
          <T kind="tiny">Your friend code (sends a request)</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <T kind="marker" style={{ fontSize: 26, flex: 1 }}>@{profile.handle}</T>
            <Button title="Share" icon="share" small kind="ghost" onPress={() => shareText(`Add me on Flyer — my friend code is @${profile.handle}`)} />
          </View>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Field placeholder="@code or invite code" value={code} onChangeText={setCode} autoCapitalize="none" style={{ flex: 1, marginRight: 8 }} />
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
      <T kind="small" style={{ marginTop: 10 }}>Declining is silent — they aren't told.</T>
    </View>
  );
}

function ClassmatesTab() {
  const { t } = useTheme();
  const { classmatesOptIn, set, scheduleItems, showToast, sentRequests, setSheet } = useApp();
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(schoolVerified());
  useEffect(() => { refreshSchoolVerification().then((r) => setVerified(r.verified)).catch(() => {}); }, []);
  const classes = scheduleItems.filter((c) => !c.oneOff).map((c) => ({ course: c.title, section: c.section || '' }));
  const toggle = async (v) => {
    if (v && !verified) { setSheet({ type: 'verifySchool' }); return; }
    set({ classmatesOptIn: v });
    try { await api.setClassmateOptIn({ optIn: v, classes: v ? classes : [] }); if (v) search(); } catch (e) { showToast(errText(e)); set({ classmatesOptIn: !v }); }
    if (!v) setResults(null);
  };
  const search = async () => {
    setBusy(true);
    try { const r = await api.findClassmates({}); setResults(r.data?.matches || []); } catch (e) { showToast(errText(e)); }
    setBusy(false);
  };
  useEffect(() => { if (classmatesOptIn && verified) search(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [verified]);
  const request = (p) => api.sendFriendRequest({ uid: p.uid }).then(() => { set((s) => ({ sentRequests: [...new Set([...s.sentRequests, p.uid])] })); showToast('Request sent'); }).catch((e) => showToast(errText(e)));
  const more = (p) => Alert.alert(p.name, undefined, [
    { text: 'Report', onPress: () => api.reportContent({ uid: p.uid, reason: 'Reported from class list', kind: 'user' }).then(() => showToast('Reported — thanks')).catch((e) => showToast(errText(e))) },
    { text: 'Block', style: 'destructive', onPress: () => api.blockUser({ uid: p.uid }).then(() => { showToast("Blocked — they can't see you"); search(); }).catch((e) => showToast(errText(e))) },
    { text: 'Cancel', style: 'cancel' },
  ]);
  return (
    <View>
      {!verified ? (
        <PostIt color="blue" tilt={-1} tape>
          <PT kind="title">Verify your TTU email first</PT>
          <PT kind="small" style={{ marginTop: 4 }}>Class lists only show verified Texas Tech students. It takes a minute.</PT>
          <Button title="Verify @ttu.edu email" icon="lock" small onPress={() => setSheet({ type: 'verifySchool' })} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        </PostIt>
      ) : null}
      <Card style={{ marginTop: verified ? 0 : 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <T kind="bold">Show me in class lists</T>
            <T kind="small">Only other verified students in the same class (and section, if you both added one) see your first name and avatar. Turn it off any time.</T>
          </View>
          <Toggle value={classmatesOptIn} onChange={toggle} label="Show me in class lists" />
        </View>
      </Card>
      {classmatesOptIn ? (
        <View style={{ marginTop: 14 }}>
          {!classes.length ? <T kind="small">Add classes in the Planner first (with the section number, if you know it).</T> : null}
          {busy && !results ? <T kind="hand">looking…</T> : null}
          {results ? (results.length ? results.map((m) => (
            <PostIt key={m.course} color="blue" seed={m.course} style={{ marginTop: 10 }}>
              <PT kind="title">{m.course}{m.section ? ` · Sec ${m.section}` : ''}</PT>
              <PT kind="small">{m.count ? `${m.count} ${m.count === 1 ? 'classmate' : 'classmates'} listed` : 'Nobody else listed yet'}</PT>
              {(m.people || []).map((p) => (
                <View key={p.uid} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <Avatar config={p.avatar} size={34} />
                  <PT kind="bold" style={{ flex: 1, marginLeft: 8 }}>{p.name}</PT>
                  {p.friend ? <PT kind="small">Friends</PT> : p.requested || sentRequests.includes(p.uid) ? <PT kind="small">Requested</PT> : (
                    <Button title="Add friend" small kind="ghost" onPress={() => request(p)} style={{ backgroundColor: '#fff' }} />
                  )}
                  <Pressable onPress={() => more(p)} hitSlop={10} style={{ marginLeft: 8 }} accessibilityLabel={`More for ${p.name}`}><Icon name="dots" color="#1F2A44" /></Pressable>
                </View>
              ))}
            </PostIt>
          )) : <Empty icon="cap" title="No classmates on Flyer yet" body="Invite friends from your classes — the more people opt in, the more this finds." />) : null}
          {results ? <Button title="Refresh" icon="refresh" small kind="ghost" loading={busy} onPress={search} style={{ marginTop: 12, alignSelf: 'flex-start' }} /> : null}
          <T kind="small" color={t.pencil} style={{ marginTop: 10 }}>Classmates here added these classes themselves — TTU hasn't confirmed enrollment. Tap ··· on anyone to report or block.</T>
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
      <T kind="small" style={{ marginBottom: 6 }}>{n ? `Shared with ${n} ${n === 1 ? 'friend' : 'friends'}.` : 'Off for everyone.'} Free / busy shows only when you're in class — no class names or rooms.</T>
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
      showToast('Nearby alerts on — pick friends below');
    } else {
      await stopNearby();
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
        Both of you have to pick each other. Nobody ever sees where you are — just "Maya is nearby". Campus only, never 11 PM–7 AM, at most once every 3 hours per friend. This is the one Flyer feature that uses location in the background, so iOS will ask for "Always" access.
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
          {tab === 'classmates' ? <ClassmatesTab /> : null}
          {tab === 'sharing' ? <SharingTab /> : null}
        </>
      )}
    </Sheet>
  );
}
