/**
 * You — four folder tabs:
 *   Me        profile, friends, Story, groups, saved stuff, Flyer Plus
 *   Connect   your card + QR, Say hi, Flyer Drop inbox, scan someone
 *   Play      Flight Score, stamps, hunts, leaderboard, games
 *   Settings  look, app icon, reminders, notifications, privacy,
 *             connections, account
 */
import React, { useEffect, useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/ThemeContext';
import { Page } from '../ui/Page';
import {
  T, PostIt, PT, Card, Section, Row, Toggle, Chip, Stamp, Divider, Button,
} from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import AvatarSheet from '../sheets/AvatarStudio';
import MajorPicker from '../sheets/MajorPicker';
import { signOut, deleteMyAccount, api } from '../lib/firebase';
import { openUrl, shareText } from '../lib/links';
import { sharingActive } from '../lib/location';
import { APP, LIMITS, SCHOOLS, PURCHASES, TERM } from '../config';
import { metaLine } from '../lib/time';
import { ORGS } from '../data/campus';
import { CLASS_YEARS } from '../data/majors';
import { ensureNotificationPermission } from '../lib/notifications';
import { FolderTabs, PersonRow, Pill, SectionNote } from '../ui/Kit';
import { CardFace } from '../sheets/Connect';
import { PlayPage } from '../sheets/Play';
import { IntroCard } from '../sheets/SayHi';
import { forgetPushToken } from '../lib/push';
import { forgetAllSecrets } from '../lib/connectors';
import { clearOfflineCache } from '../lib/hooks';
import { useCurrentIcon, iconsSupported, ICON_LABELS, SEASON_ICONS } from '../lib/icons';
import { firstWeeksActive } from '../data/firstweeks';

function ProfileCard() {
  const { userName, userMajor, userClassYear, avatar, schoolId, profile, user, isPlus, set, setSheet } = useApp();
  const [editing, setEditing] = useState(false);
  const [major, setMajor] = useState(false);
  const school = SCHOOLS.find((s) => s.id === schoolId);
  return (
    <PostIt color={avatar.bg} tilt={-1} tape padding={16} style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => setEditing(true)} accessibilityLabel="Edit avatar">
          <Avatar config={avatar} size={84} />
          <View style={{ position: 'absolute', right: -2, bottom: -2, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#1F2A44', padding: 3 }}>
            <Icon name="pencil" size={14} color="#1F2A44" />
          </View>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PT kind="title" style={{ fontSize: 22 }}>{userName || 'You'}</PT>
            {isPlus ? <Icon name="crown" size={18} color="#B7791F" style={{ marginLeft: 6 }} /> : null}
          </View>
          <Pressable onPress={() => setMajor(true)}><PT kind="small">{metaLine(userClassYear, userMajor || 'Add your major')}</PT></Pressable>
          <PT kind="small">{school?.short}</PT>
          {profile?.handle ? (
            <Pressable onPress={() => shareText(`Add me on Flyer! My friend code is ${profile.handle}`)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <PT kind="bold">@{profile.handle}</PT><Icon name="share" size={14} color="#1F2A44" style={{ marginLeft: 4 }} />
            </Pressable>
          ) : user && user.isAnonymous ? (
            <Pressable onPress={() => setSheet({ type: 'account' })}><PT kind="bold" style={{ marginTop: 6, color: '#2F5DA8' }}>Make an account to add friends →</PT></Pressable>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
        {CLASS_YEARS.map((y) => <Chip key={y} label={y} active={userClassYear === y} onPress={() => set({ userClassYear: y })} style={{ marginBottom: 4 }} />)}
      </View>
      {editing ? <AvatarSheet value={avatar} isPlus={isPlus} onClose={() => setEditing(false)} onSave={(a) => { set({ avatar: a }); setEditing(false); }} /> : null}
      {major ? <MajorPicker value={userMajor} onClose={() => setMajor(false)} onSelect={(m) => { set({ userMajor: m }); setMajor(false); }} /> : null}
    </PostIt>
  );
}

function FriendsPeek() {
  const { t } = useTheme();
  const { friends, requests, sharing, setSheet, user } = useApp();
  const live = sharingActive(sharing);
  return (
    <>
      <Section title="Friends" icon="users" action="open" onAction={() => setSheet({ type: 'friends' })} />
      <Card onPress={() => setSheet({ type: 'friends' })}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {friends.slice(0, 6).map((f, i) => <Avatar key={f.uid} config={f.avatar} size={36} style={{ marginLeft: i ? -10 : 0 }} />)}
            {!friends.length ? <T kind="small">{user && !user.isAnonymous ? 'Add friends with their @code.' : 'Friends need an account.'}</T> : null}
          </View>
          {requests.length ? <Stamp label={`${requests.length} new`} color={t.redPen} /> : null}
        </View>
        <Divider style={{ marginVertical: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name={live ? 'location' : 'eyeOff'} size={18} color={live ? t.ok : t.pencil} />
          <T kind="small" style={{ marginLeft: 8, flex: 1 }}>{live ? `Sharing location with ${sharing.allowed.length} ${sharing.allowed.length === 1 ? 'friend' : 'friends'}` : 'Location sharing is off'}</T>
          <Pressable onPress={() => setSheet({ type: 'friends', tab: 'sharing' })}><T kind="hand" color={t.accent}>settings</T></Pressable>
        </View>
      </Card>
    </>
  );
}

function PlusCard() {
  const { isPlus, setSheet } = useApp();
  if (isPlus) {
    return (
      <PostIt color="yellow" seed="plus-on" style={{ marginTop: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="crown" color="#B7791F" /><PT kind="bold" style={{ marginLeft: 8 }}>Flyer Plus is on. Thank you for supporting a student-built app.</PT></View>
      </PostIt>
    );
  }
  return (
    <PostIt color="yellow" seed="plus" tape style={{ marginTop: 18 }} onPress={() => setSheet({ type: 'plus' })}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="crown" color="#B7791F" size={26} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <PT kind="title">Flyer Plus</PT>
          <PT kind="small">No ads, {LIMITS.pilotPlus} Pilot questions a day, extra avatar gear. {PURCHASES.priceHint}</PT>
        </View>
        <Icon name="chevronRight" color="#1F2A44" />
      </View>
    </PostIt>
  );
}

function Saved() {
  const { t } = useTheme();
  const { savedEvents, followedOrgIds, setSheet, toggleSave } = useApp();
  const orgs = ORGS.filter((o) => followedOrgIds.includes(o.id));
  return (
    <>
      <Section title="Saved" icon="bookmark" />
      {!savedEvents.length && !orgs.length ? <Card><T kind="hand">nothing pinned yet</T><T kind="small">Save events and follow clubs in Discover.</T></Card> : (
        <Card>
          {savedEvents.map((e) => <Row key={e.id} title={e.title} meta={metaLine(e.date, e.time, e.location)} left={<Icon name="ticket" color={t.ink} />} onPress={() => setSheet({ type: 'event', ev: e })}
            right={<Pressable onPress={() => toggleSave(e)} hitSlop={10}><Icon name="close" size={16} color={t.faint} /></Pressable>} />)}
          {orgs.map((o, i) => <Row key={o.id} title={o.name} meta="Following" left={<Icon name="users" color={t.ink} />} onPress={() => setSheet({ type: 'org', id: o.id })} last={i === orgs.length - 1} />)}
        </Card>
      )}
    </>
  );
}

function MeShortcuts() {
  const { t } = useTheme();
  const { setSheet, groups, groupInvites, myPosts, user } = useApp();
  const signedIn = user && !user.isAnonymous;
  const live = myPosts.filter((p) => !p.expiresAt || new Date(p.expiresAt) > new Date()).length;
  return (
    <>
      <Section title="Yours" icon="folder" />
      <Card>
        <Row title="My Story" meta={live ? `${live} up right now · saved posts stay here` : 'Posts you saved stay here, just for you'} left={<Icon name="image" color={t.ink} />} chevron onPress={() => setSheet({ type: 'story' })} />
        <Row title="Groups" meta={groupInvites.length ? `${groupInvites.length} invite${groupInvites.length === 1 ? '' : 's'} waiting` : groups.length ? groups.map((g) => g.name).slice(0, 2).join(', ') : 'Projects, study groups, roommates'} left={<Icon name="users" color={t.ink} />}
          right={groupInvites.length ? <Pill label="New" color="pink" /> : null} chevron onPress={() => setSheet({ type: signedIn ? 'groups' : 'account' })} />
        <Row title="Semester scrapbook" meta="Photos, places, stamps, and people" left={<Icon name="book" color={t.ink} />} chevron onPress={() => setSheet({ type: 'scrapbook' })} />
        <Row title="Sleep & steps" meta="From Apple Health, on this phone only" left={<Icon name="bed" color={t.ink} />} chevron onPress={() => setSheet({ type: 'wellness' })} last />
      </Card>
    </>
  );
}

/* ---------- Connect ---------- */
function ConnectPage() {
  const { myCard, profile, userName, avatar, userMajor, userClassYear, setSheet, user, intros, drops, sayHiVisible, friends } = useApp();
  const signedIn = user && !user.isAnonymous;
  if (!signedIn) {
    return (
      <PostIt color="yellow" tape style={{ marginTop: 14 }}>
        <PT kind="bold">Connect needs an account</PT>
        <PT kind="small">Your card, QR code, Say hi, and Flyer Drop all follow your account.</PT>
        <Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      </PostIt>
    );
  }
  const inbox = drops.filter((d) => d.from !== user.uid && (!d.expiresAt || new Date(d.expiresAt) > new Date()));
  const card = { ...(myCard || {}), major: myCard?.major ?? userMajor, classYear: userClassYear };
  return (
    <View>
      <View style={{ marginTop: 6 }}>
        <CardFace name={userName} handle={profile?.handle} avatar={avatar} card={card} faceUrl={myCard?.faceUrl} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <Button title="My QR" icon="qr" onPress={() => setSheet({ type: 'myQR' })} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Edit card" icon="pencil" kind="ghost" onPress={() => setSheet({ type: 'cardEdit' })} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <Button title="Scan someone" icon="scan" kind="ghost" small onPress={() => setSheet({ type: 'scan' })} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Flyer Drop" icon="plane" kind="ghost" small onPress={() => setSheet({ type: 'drop' })} style={{ flex: 1 }} />
      </View>

      <Section title="Say hi" icon="hand" action={sayHiVisible ? 'people' : 'turn on'} onAction={() => setSheet({ type: 'sayhi' })} hand="Classmates and org members who opted in" />
      {intros.length ? intros.slice(0, 3).map((i) => <IntroCard key={i.uid} intro={i} />) : (
        <Card onPress={() => setSheet({ type: 'sayhi' })}>
          <T kind="small">{sayHiVisible ? 'No new hellos. Say hi to someone you share a class with.' : 'Off. Turn it on to see people you share classes and orgs with (they have to turn it on too).'}</T>
        </Card>
      )}

      <Section title="Drops" icon="inbox" action="send" onAction={() => setSheet({ type: 'drop' })} hand="Things people sent you · gone after a week" />
      {inbox.length ? (
        <Card>
          {inbox.slice(0, 6).map((d, i) => (
            <PersonRow key={d.id} person={{ name: d.fromName, avatar: d.fromAvatar }} meta={d.payload?.title || { card: 'Their card', link: 'A link', note: 'A note', photo: 'A photo', file: 'A file', event: 'An event', group: 'A group invite', plan: 'A plan' }[d.kind]}
              onPress={() => setSheet({ type: 'drop', id: d.id })} last={i === Math.min(inbox.length, 6) - 1} />
          ))}
        </Card>
      ) : <Card><T kind="small">Nothing yet. When someone sends you a card, link, or file, it lands here.</T></Card>}

      <Section title="Friends" icon="users" action="open" onAction={() => setSheet({ type: 'friends' })} />
      <Card onPress={() => setSheet({ type: 'friends' })}>
        <View style={{ flexDirection: 'row' }}>
          {friends.slice(0, 8).map((f, i) => <Avatar key={f.uid} config={f.avatar} size={34} style={{ marginLeft: i ? -8 : 0 }} />)}
          {!friends.length ? <T kind="small">Scan a friend's QR or add their @code.</T> : null}
        </View>
      </Card>
      <SectionNote icon="lock" onPress={() => setSheet({ type: 'privacy' })}>Choose who sees each part of your card. See everything Flyer knows about you.</SectionNote>
    </View>
  );
}

function Settings() {
  const { t } = useTheme();
  const app = useApp();
  const { theme, notif, set, user, resetAll, setSheet, isPlus, pilotUsedToday, pilotDay, seasonPref, season, flags, pushPrefs, seasonIcon, firstWeeks, userClassYear, connections } = app;
  const [icon, switchIcon] = useCurrentIcon();
  const [admin, setAdmin] = useState(false);
  useEffect(() => { if (user && !user.isAnonymous) api.amIAdmin({}).then((r) => setAdmin(!!r.data.admin)).catch(() => {}); }, [user?.uid]);
  const setP = (patch) => set((p) => ({ pushPrefs: { ...p.pushPrefs, ...patch } }));
  const fwActive = firstWeeksActive({ firstWeeks, userClassYear }, TERM);
  const cleanup = async () => { await forgetPushToken().catch(() => {}); await forgetAllSecrets().catch(() => {}); await clearOfflineCache().catch(() => {}); };
  const usage = pilotDay === new Date().toISOString().slice(0, 10) ? pilotUsedToday : 0;
  const setN = (patch) => set((p) => ({ notif: { ...p.notif, ...patch } }));

  const doSignOut = () => Alert.alert('Sign out?', 'This clears Flyer on this phone and takes you back to the start. Your account and friends stay saved.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await api.stopSharing({}).catch(() => {}); await cleanup(); await signOut().catch(() => {}); resetAll(); } },
  ]);
  const doDelete = () => Alert.alert('Delete account?', 'This permanently deletes your account, friends list, and any shared location from our servers, and clears this phone. It can\'t be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete forever', style: 'destructive', onPress: async () => { await cleanup(); await deleteMyAccount(); await signOut().catch(() => {}); resetAll(); } },
  ]);

  return (
    <>
      <Card style={{ marginTop: 6 }}>
        <T kind="tiny" style={{ marginBottom: 6 }}>Look</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[['system', 'Match phone'], ['light', 'Notebook'], ['dark', 'Chalkboard']].map(([id, label]) => <Chip key={id} label={label} active={theme === id} onPress={() => set({ theme: id })} />)}
        </View>
        {flags.seasons ? (
          <>
            <T kind="tiny" style={{ marginTop: 10, marginBottom: 6 }}>Seasonal themes</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {[['on', 'On'], ['minimal', 'Minimal'], ['off', 'Off']].map(([id, label]) => <Chip key={id} label={label} active={(seasonPref || 'on') === id} onPress={() => set({ seasonPref: id })} />)}
            </View>
            <T kind="small">
              {season ? `The ${season.name} theme is on right now. ` : "Themes switch on by themselves for fall, winter, New Year, Valentine's and St. Patrick's. "}
              Minimal keeps just the tape colors and the plane's outfit. Motion follows your phone's Reduce Motion setting.
            </T>
          </>
        ) : null}
        {iconsSupported() ? (
          <>
            <T kind="tiny" style={{ marginTop: 10, marginBottom: 6 }}>App icon</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Chip label="Classic" active={!icon} onPress={() => switchIcon(null)} />
              {Object.values(SEASON_ICONS).map((n) => <Chip key={n} label={ICON_LABELS[n]} active={icon === n} onPress={() => switchIcon(n)} />)}
            </View>
            <Row title="Offer the season's icon" meta="A note on Home when a new season starts. iOS shows a short alert when an icon changes." right={<Toggle value={seasonIcon !== 'off'} onChange={(v) => set({ seasonIcon: v ? 'auto' : 'off' })} label="Offer seasonal icons" />} last />
          </>
        ) : null}
        <Divider />
        <T kind="tiny" style={{ marginBottom: 4 }}>Reminders</T>
        <Row title="Class reminders" right={<Toggle value={notif.classes} onChange={async (v) => { if (v) await ensureNotificationPermission(true); setN({ classes: v }); }} label="Class reminders" />} />
        {notif.classes ? (
          <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
            {[5, 10, 15, 30].map((m) => <Chip key={m} label={`${m} min before`} active={notif.leadMinutes === m} onPress={() => setN({ leadMinutes: m })} />)}
          </View>
        ) : null}
        <Row title="Leave-now alerts" meta="Between classes in different buildings, with the walk time" right={<Toggle value={notif.leaveNow !== false} onChange={async (v) => { if (v) await ensureNotificationPermission(true); setN({ leaveNow: v }); }} label="Leave-now alerts" />} />
        <Row title="Bedtime nudge" meta="The night before an early class" right={<Toggle value={!!notif.bedtime} onChange={async (v) => { if (v) await ensureNotificationPermission(true); setN({ bedtime: v }); }} label="Bedtime nudge" />} />
        <Row title="Weather heads-ups" meta="Rain, cold, or heat at class time" right={<Toggle value={notif.weather} onChange={(v) => setN({ weather: v })} label="Weather heads-ups" />} />
        <Row title="Assignment reminders" meta={`${notif.assignmentLeadHours}h before + 2h before`} right={<Toggle value={notif.assignments} onChange={(v) => setN({ assignments: v })} label="Assignment reminders" />} />
        <Row title="Saved events" meta="30 min before" right={<Toggle value={notif.saved} onChange={(v) => setN({ saved: v })} label="Saved event reminders" />} last={!flags.jobs} />
        {flags.jobs ? <Row title="Job follow-ups" meta="From your Jobs Hub tracker" right={<Toggle value={notif.jobs !== false} onChange={(v) => setN({ jobs: v })} label="Job follow-up reminders" />} last /> : null}
        {user && !user.isAnonymous ? (
          <>
            <Divider />
            <T kind="tiny" style={{ marginBottom: 4 }}>Notifications from people</T>
            {[['social', 'Say hi, friends, and Story', 'hand'], ['drops', 'Flyer Drops', 'plane'], ['groups', 'Group updates', 'users'], ['plans', 'Plans and polls', 'calendarPlus'], ['play', 'Games and hunts', 'gamepad']].map(([k, label, ic], i, arr) => (
              <Row key={k} title={label} left={<Icon name={ic} color={t.ink} />} right={<Toggle value={pushPrefs?.[k] !== false} onChange={async (v) => { if (v) await ensureNotificationPermission(true); setP({ [k]: v }); }} label={label} />} last={i === arr.length - 1} />
            ))}
            <T kind="small" style={{ marginTop: 4 }}>Safe Walk alerts always come through.</T>
          </>
        ) : null}
        <Divider />
        <T kind="tiny" style={{ marginBottom: 4 }}>Privacy and connections</T>
        <Row title="What Flyer knows" meta="See it, change it, or delete it" left={<Icon name="eye" color={t.ink} />} chevron onPress={() => setSheet({ type: 'privacy' })} />
        <Row title="Connections" meta={[connections?.canvasToken && 'Canvas', connections?.microsoft && 'Microsoft', connections?.google && 'Google', connections?.canva && 'Canva', connections?.health && 'Apple Health', connections?.textFlyer && 'Text Flyer'].filter(Boolean).join(', ') || 'Calendars, Microsoft, Google, Canva, Apple Health'} left={<Icon name="link" color={t.ink} />} chevron onPress={() => setSheet({ type: 'connections' })} />
        <Row title="First 30 days" meta={fwActive ? 'Showing on Home' : 'A short checklist for new students'} left={<Icon name="list" color={t.ink} />}
          right={<Toggle value={!!fwActive} onChange={(v) => set((p) => ({ firstWeeks: { ...p.firstWeeks, on: v, startedAt: p.firstWeeks.startedAt || (v ? new Date().toISOString() : null) } }))} label="First 30 days on Home" />} />
        <Row title="Org officers" meta="Post events as your org, print poster QR codes" left={<Icon name="megaphone" color={t.ink} />} chevron onPress={() => setSheet({ type: user && !user.isAnonymous ? 'orgOfficer' : 'account' })} last={!admin} />
        {admin ? <Row title="Admin" meta="Reports, held posts, org requests" left={<Icon name="shield" color={t.redPen} />} chevron onPress={() => setSheet({ type: 'admin' })} last /> : null}
        <Divider />
        <T kind="tiny" style={{ marginBottom: 4 }}>Account</T>
        {user && user.isAnonymous ? <Row title="Make an account" meta="Keep your setup and add friends" left={<Icon name="userPlus" color={t.ink} />} onPress={() => setSheet({ type: 'account' })} /> : null}
        {user && !user.isAnonymous ? <Row title="Signed in" meta={user.email || 'Apple ID'} left={<Icon name="lock" color={t.ink} />} /> : null}
        <Row title="Pilot today" meta={`${usage} of ${isPlus ? LIMITS.pilotPlus : LIMITS.pilotFree} questions used`} left={<Icon name="plane" color={t.ink} />} />
        <Row title="Request another school" left={<Icon name="flag" color={t.ink} />} onPress={() => setSheet({ type: 'requestSchool' })} />
        <Row title="Safety numbers" left={<Icon name="shield" color={t.ink} />} onPress={() => setSheet({ type: 'safety' })} />
        <Row title="Privacy policy" left={<Icon name="lock" color={t.ink} />} onPress={() => openUrl(APP.privacyUrl)} />
        <Row title="Terms of use" left={<Icon name="book" color={t.ink} />} onPress={() => openUrl(APP.termsUrl)} />
        <Row title="Contact support" meta={APP.supportEmail} left={<Icon name="help" color={t.ink} />} onPress={() => openUrl(`mailto:${APP.supportEmail}`)} />
        <Row title="Sign out" left={<Icon name="logout" color={t.redPen} />} onPress={doSignOut} />
        {user && !user.isAnonymous ? <Row title="Delete account" left={<Icon name="trash" color={t.redPen} />} onPress={doDelete} last /> : null}
      </Card>
      <T kind="small" style={{ marginTop: 14, textAlign: 'center' }}>{APP.disclaimer}</T>
      <T kind="hand" style={{ marginTop: 8, textAlign: 'center' }}>made by a student, for students ✈︎ Eternity Works</T>
    </>
  );
}

export default function You() {
  const { intros, groupInvites, gameInvites, requests } = useApp();
  const [tab, setTab] = useState('me');
  return (
    <Page eyebrow="your folder" title="You" paper="kraft">
      <FolderTabs value={tab} onChange={setTab} tabs={[
        { id: 'me', label: 'Me', icon: 'you', color: 'yellow', badge: requests.length > 0 || groupInvites.length > 0 },
        { id: 'connect', label: 'Connect', icon: 'qr', color: 'blue', badge: intros.length > 0 },
        { id: 'play', label: 'Play', icon: 'trophy', color: 'pink', badge: gameInvites.length > 0 },
        { id: 'settings', label: 'Settings', icon: 'gear', color: 'green' },
      ]} />
      {tab === 'me' ? (
        <>
          <ProfileCard />
          <FriendsPeek />
          <MeShortcuts />
          <PlusCard />
          <Saved />
        </>
      ) : null}
      {tab === 'connect' ? <ConnectPage /> : null}
      {tab === 'play' ? <PlayPage /> : null}
      {tab === 'settings' ? <Settings /> : null}
    </Page>
  );
}
