/**
 * You — profile, friends, saved stuff, Flyer Plus, and settings.
 */
import React, { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/ThemeContext';
import { Page } from '../ui/Page';
import {
  T, PostIt, PT, Card, Section, Row, Toggle, Chip, Stamp, Divider,
} from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import AvatarSheet from '../sheets/AvatarStudio';
import MajorPicker from '../sheets/MajorPicker';
import { signOut, api } from '../lib/firebase';
import { levelFor } from '../data/places';
import { unregisterPush } from '../lib/push';
import { stopNearby } from '../lib/nearby';
import { openUrl, shareText } from '../lib/links';
import { sharingActive } from '../lib/location';
import { APP, LIMITS, SCHOOLS, PURCHASES } from '../config';
import { metaLine } from '../lib/time';
import { ORGS } from '../data/campus';
import { CLASS_YEARS } from '../data/majors';
import { ensureNotificationPermission } from '../lib/notifications';

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
  const { friends, requests, sharing, setSheet, user, unreadChats, pendingMeetups } = useApp();
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
      {user && !user.isAnonymous ? (
        <Card style={{ marginTop: 10 }} onPress={() => setSheet({ type: 'chats' })}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="chat" color={t.ink} />
            <T kind="bold" style={{ marginLeft: 8, flex: 1 }}>Messages</T>
            {unreadChats ? <Stamp label={`${unreadChats} new`} color={t.redPen} /> : null}
            {pendingMeetups ? <Stamp label={`${pendingMeetups} invite${pendingMeetups === 1 ? '' : 's'}`} color={t.accent} style={{ marginLeft: 6 }} /> : null}
            <Icon name="chevronRight" size={18} color={t.faint} style={{ marginLeft: 6 }} />
          </View>
        </Card>
      ) : null}
    </>
  );
}

function FlightCard() {
  const { flight, setSheet, user } = useApp();
  if (!user || user.isAnonymous) return null;
  const score = flight.score || 0;
  const lvl = levelFor(score);
  const stamps = Object.values(flight.stamps || {}).filter((s) => !s.routine).length;
  return (
    <PostIt color="green" seed="passport" tape style={{ marginTop: 18 }} onPress={() => setSheet({ type: 'passport' })}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="passport" color="#1F2A44" size={28} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <PT kind="title">Flight passport · {score}</PT>
          <PT kind="small">{lvl.title} · {stamps} {stamps === 1 ? 'stamp' : 'stamps'}{lvl.next ? ` · ${lvl.toNext} to ${lvl.next.title}` : ''}</PT>
        </View>
        <Icon name="chevronRight" color="#1F2A44" />
      </View>
    </PostIt>
  );
}

function PlusCard() {
  const { isPlus, setSheet } = useApp();
  if (isPlus) {
    return (
      <PostIt color="yellow" seed="plus-on" style={{ marginTop: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="crown" color="#B7791F" /><PT kind="bold" style={{ marginLeft: 8 }}>Flyer Plus is on — thank you for supporting a student-built app.</PT></View>
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

function Settings() {
  const { t } = useTheme();
  const app = useApp();
  const { theme, notif, set, user, resetAll, setSheet, isPlus, pilotUsedToday, pilotDay } = app;
  const usage = pilotDay === new Date().toISOString().slice(0, 10) ? pilotUsedToday : 0;
  const setN = (patch) => set((p) => ({ notif: { ...p.notif, ...patch } }));

  const doSignOut = () => Alert.alert('Sign out?', 'This clears Flyer on this phone and takes you back to the start. Your account and friends stay saved.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await api.stopSharing({}).catch(() => {}); await unregisterPush(); await stopNearby(); await signOut().catch(() => {}); resetAll(); } },
  ]);
  const doDelete = () => setSheet({ type: 'deleteAccount' });

  return (
    <>
      <Section title="Settings" icon="gear" />
      <Card>
        <T kind="tiny" style={{ marginBottom: 6 }}>Look</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[['system', 'Match phone'], ['light', 'Notebook'], ['dark', 'Chalkboard']].map(([id, label]) => <Chip key={id} label={label} active={theme === id} onPress={() => set({ theme: id })} />)}
        </View>
        <Divider />
        <T kind="tiny" style={{ marginBottom: 4 }}>Reminders</T>
        <Row title="Class reminders" right={<Toggle value={notif.classes} onChange={async (v) => { if (v) await ensureNotificationPermission(true); setN({ classes: v }); }} label="Class reminders" />} />
        {notif.classes ? (
          <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
            {[5, 10, 15, 30].map((m) => <Chip key={m} label={`${m} min before`} active={notif.leadMinutes === m} onPress={() => setN({ leadMinutes: m })} />)}
          </View>
        ) : null}
        <Row title="Weather heads-ups" meta="Rain, cold, or heat at class time" right={<Toggle value={notif.weather} onChange={(v) => setN({ weather: v })} label="Weather heads-ups" />} />
        <Row title="Assignment reminders" meta={`${notif.assignmentLeadHours}h before + 2h before`} right={<Toggle value={notif.assignments} onChange={(v) => setN({ assignments: v })} label="Assignment reminders" />} />
        <Row title="Saved events" meta="30 min before" right={<Toggle value={notif.saved} onChange={(v) => setN({ saved: v })} label="Saved event reminders" />} last />
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
  return (
    <Page eyebrow="your page" title="You">
      <ProfileCard />
      <FriendsPeek />
      <FlightCard />
      <PlusCard />
      <Saved />
      <Settings />
    </Page>
  );
}
