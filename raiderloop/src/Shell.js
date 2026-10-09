/**
 * Shell — tabs, the Pilot button, every sheet, and the background
 * jobs (notifications, widget, location broadcasting, profile sync,
 * Plus status). Hooks run before any early return.
 */
import React, { useEffect, useRef } from 'react';
import { View, StatusBar, Linking, AppState } from 'react-native';
import { useApp } from './state/AppContext';
import { useTheme } from './theme/ThemeContext';
import { TabBar, PilotFab } from './ui/Page';
import { Toast, Sheet, Button, PostIt, PT } from './ui/Paper';
import Home from './screens/Home';
import Discover, { OrgBrowser, SportsSheet } from './screens/Discover';
import Campus from './screens/Campus';
import Planner from './screens/Planner';
import You from './screens/You';
import Onboarding from './screens/onboarding';
import { RequestSchool } from './screens/onboarding/School';
import Pilot from './sheets/Pilot';
import FriendsSheet from './sheets/Friends';
import { EventSheet, OrgSheet, BuildingSheet, DiningSheet } from './sheets/Details';
import { OpenNowSheet, ParkingSheet, SafetySheet } from './sheets/CampusTools';
import { GamedaySheet, PlusSheet, AccountSheet } from './sheets/Misc';
import PassportSheet from './sheets/Passport';
import { RateSheet } from './sheets/PlaceExtras';
import { MeetupNewSheet, MeetupSheet } from './sheets/Meetups';
import {
  ChatsSheet, ChatSheet, NewFlockSheet, ShareCardSheet, FlockBoardSheet,
} from './sheets/Chats';
import { FriendSheet, FindTimeSheet } from './sheets/FriendProfile';
import QrFriendSheet, { parseFriendCode } from './sheets/QrFriend';
import { DeleteAccountSheet, HandleSheet } from './sheets/AccountExtras';
import SyllabusSheet from './sheets/ScanSyllabus';
import { usePushRegistration, useNotificationTaps } from './lib/push';
import { busyBlocks, fullClasses } from './lib/schedule';
import { useNotificationScheduler } from './lib/notifications';
import { useWidgetSync } from './lib/widget';
import { useLocationBroadcaster } from './lib/location';
import { useWeather } from './lib/hooks';
import { usePlusStatus, initAds } from './lib/monetize';
import { api } from './lib/firebase';
import { syncBackground, checkNow, saveMeetupsForBackground } from './lib/backgroundLocation';

function SheetHost() {
  const { sheet, setSheet } = useApp();
  if (!sheet) return null;
  const close = () => setSheet(null);
  switch (sheet.type) {
    case 'event': return <EventSheet ev={sheet.ev} onClose={close} />;
    case 'org': return <OrgSheet id={sheet.id} onClose={close} />;
    case 'orgs': return <OrgBrowser initial={sheet.initial} onClose={close} />;
    case 'building': return <BuildingSheet id={sheet.id} onClose={close} />;
    case 'dining': return <DiningSheet id={sheet.id} onClose={close} />;
    case 'openNow': return <OpenNowSheet onClose={close} />;
    case 'parking': return <ParkingSheet onClose={close} />;
    case 'safety': return <SafetySheet onClose={close} />;
    case 'sports': return <SportsSheet onClose={close} />;
    case 'friends': return <FriendsSheet initialTab={sheet.tab} onClose={close} />;
    case 'gameday': return <GamedaySheet kickoff={sheet.kickoff} onClose={close} />;
    case 'plus': return <PlusSheet onClose={close} />;
    case 'account': return <AccountSheet onClose={close} />;
    case 'requestSchool': return <RequestSchool onClose={close} />;
    case 'passport': return <PassportSheet onClose={close} />;
    case 'rate': return <RateSheet placeId={sheet.placeId} onClose={close} />;
    case 'meetupNew': return <MeetupNewSheet placeId={sheet.placeId} to={sheet.to} flockId={sheet.flockId} at={sheet.at} onClose={close} />;
    case 'meetup': return <MeetupSheet id={sheet.id} onClose={close} />;
    case 'chats': return <ChatsSheet onClose={close} />;
    case 'chat': return <ChatSheet key={sheet.chatId || sheet.withUid} chatId={sheet.chatId} withUid={sheet.withUid} onClose={close} />;
    case 'newFlock': return <NewFlockSheet onClose={close} />;
    case 'shareCard': return <ShareCardSheet card={sheet.card} onClose={close} />;
    case 'flockBoard': return <FlockBoardSheet flockId={sheet.flockId} onClose={close} />;
    case 'friend': return <FriendSheet uid={sheet.uid} onClose={close} />;
    case 'findTime': return <FindTimeSheet uids={sheet.uids} flockId={sheet.flockId} onClose={close} />;
    case 'qr': return <QrFriendSheet initialTab={sheet.tab} onClose={close} />;
    case 'deleteAccount': return <DeleteAccountSheet onClose={close} />;
    case 'handle': return <HandleSheet onClose={sheet.back ? () => setSheet(sheet.back) : close} />;
    case 'syllabus': return <SyllabusSheet onClose={close} />;
    default: return null;
  }
}

function ConflictPrompt() {
  const { conflict, setConflict, addEventToSchedule } = useApp();
  if (!conflict) return null;
  return (
    <Sheet title="Time clash" onClose={() => setConflict(null)} height={0.5}
      footer={(
        <View style={{ flexDirection: 'row' }}>
          <Button title="Keep both" kind="ghost" onPress={() => { addEventToSchedule(conflict.incoming, { force: true }); setConflict(null); }} style={{ flex: 1, marginRight: 8 }} />
          <Button title="Never mind" onPress={() => setConflict(null)} style={{ flex: 1 }} />
        </View>
      )}>
      <PostIt color="pink" tilt={-1}>
        <PT kind="bold">{conflict.incoming.title}</PT>
        <PT kind="small">overlaps {conflict.existing.title} ({conflict.existing.time}–{conflict.existing.endTime}).</PT>
      </PostIt>
    </Sheet>
  );
}

/* flyer://add/CODE, from a QR scanned with the iPhone camera or an
   invite link. Mounted during onboarding too, so someone who just
   installed from an invite keeps it while they sign up. */
const seenLinks = new Set();
function LinkCatcher() {
  const { set } = useApp();
  useEffect(() => {
    const handle = (url) => {
      if (!url || seenLinks.has(url) || !/^flyer:\/\/add\//i.test(url)) return;
      const code = parseFriendCode(url);
      if (!code) return;
      seenLinks.add(url);
      set({ pendingInvite: code });
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function BackgroundJobs() {
  const app = useApp();
  const { user, sharing, schoolId, avatar, userName, set, scheduleItems, assignments, onboarded, adConsentAsked, isPlus } = app;
  const weather = useWeather(schoolId);
  useNotificationScheduler(app);
  useWidgetSync({ scheduleItems, assignments, weather });
  useLocationBroadcaster({
    sharing, user, schoolId, avatar, userName,
    onExpired: () => set((p) => ({ sharing: { ...p.sharing, on: false, until: null } })),
  });
  usePlusStatus(user, (plus) => set({ isPlus: plus }));
  useEffect(() => { if (onboarded && !isPlus) initAds({ askTracking: false }); }, [onboarded, adConsentAsked, isPlus]);

  usePushRegistration({ user, onboarded });
  const { setSheet, setTab, showToast, scheduleShare, nearby, friends, friendsLoaded } = app;
  const signedIn = user && !user.isAnonymous;

  /* Tapping a push notification opens the right place. */
  useNotificationTaps((d) => {
    if (d.open === 'chat' && d.chatId) setSheet({ type: 'chat', chatId: d.chatId });
    else if (d.open === 'meetup' && d.meetupId) setSheet({ type: 'meetup', id: d.meetupId });
    else if (d.open === 'friend' && d.uid) setSheet({ type: 'friend', uid: d.uid });
    else if (d.open === 'friends') setSheet({ type: 'friends', tab: d.tab });
    else if (d.open === 'home') setTab('home');
    else if (d.open === 'passport') setSheet({ type: 'passport' });
  });

  /* A friend code from a link (LinkCatcher saved it). Redeem it once
     there's a real account. A guest is sent to make one first, and it's
     redeemed automatically right after. */
  const { pendingInvite, profile } = app;
  const nudged = useRef(false);
  const redeeming = useRef(false);
  /* Wait for the server profile (it carries the username), so the
     person who invited them sees a real name in their friends list. */
  const profileReady = !!profile?.handle;
  useEffect(() => {
    if (!pendingInvite) return;
    if (signedIn && profileReady) {
      if (redeeming.current) return;
      redeeming.current = true;
      const code = pendingInvite;
      api.redeemFriendCode({ code }).then((r) => {
        set({ pendingInvite: null });
        showToast(r.data.already ? `You and ${r.data.name || 'them'} are already friends` : `You and ${(r.data.name || 'your new friend').split(' ')[0]} are friends!`);
      }).catch((e) => {
        // A bad or expired code is dropped. A network blip keeps it for next time.
        const permanent = ['functions/not-found', 'functions/invalid-argument', 'functions/already-exists', 'not-found', 'invalid-argument'].includes(e?.code);
        if (permanent) set({ pendingInvite: null });
        showToast(permanent ? "That invite didn't work. It may have expired, so ask for a new one." : "Couldn't add your friend yet. We'll try again next time you open Flyer.");
      }).finally(() => { redeeming.current = false; });
    } else if (!signedIn && user !== undefined && !nudged.current) {
      nudged.current = true;
      setSheet({ type: 'account' });
      showToast("Make your account and you'll be friends automatically.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, profileReady, pendingInvite, user === undefined]);

  /* Keep the public profile (name, avatar, school) in sync.
     Debounced; only for real accounts. */
  const t = useRef(null);
  useEffect(() => {
    if (!signedIn || !onboarded) return undefined;
    clearTimeout(t.current);
    t.current = setTimeout(() => {
      api.saveProfile({ name: userName, avatar, schoolId }).catch((e) => {
        // The server refused the name (it has the final say). Clear it so
        // the profile can still save, and tell the person why.
        if (/invalid-argument/.test(String(e?.code || ''))) { set({ userName: '' }); app.showToast("Flyer can't use that name, so it was cleared."); }
      });
    }, 1200);
    return () => clearTimeout(t.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, signedIn, onboarded, userName, JSON.stringify(avatar), schoolId]);

  /* Schedule sharing: send busy blocks (and full classes, only for
     friends set to "full") whenever the schedule or levels change. */
  const s = useRef(null);
  const sentEmpty = useRef(false);
  const friendKey = friends.map((f) => f.uid).sort().join(',');
  useEffect(() => {
    // Wait for the real friends list, or an empty first load would
    // briefly un-share everyone.
    if (!signedIn || !onboarded || !friendsLoaded) return undefined;
    clearTimeout(s.current);
    s.current = setTimeout(() => {
      const fset = new Set(friendKey.split(','));
      const levels = Object.fromEntries(Object.entries(scheduleShare.levels).filter(([k]) => fset.has(k)));
      if (!Object.keys(levels).length && sentEmpty.current) return;
      sentEmpty.current = !Object.keys(levels).length;
      const anyFull = Object.values(levels).includes('full');
      api.updateScheduleShare({ levels, busy: busyBlocks(scheduleItems), full: anyFull ? fullClasses(scheduleItems) : [] }).catch(() => {});
    }, 1500);
    return () => clearTimeout(s.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, onboarded, friendsLoaded, JSON.stringify(scheduleShare.levels), JSON.stringify(scheduleItems), friendKey]);

  /* Nearby-alert choices live on the server so both sides can match. */
  const n = useRef(null);
  useEffect(() => {
    if (!signedIn || !friendsLoaded) return undefined;
    clearTimeout(n.current);
    n.current = setTimeout(() => { api.setNearbyPrefs({ on: nearby.on, allow: nearby.allow }).catch(() => {}); }, 1200);
    return () => clearTimeout(n.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, friendsLoaded, nearby.on, JSON.stringify(nearby.allow), friendKey]);

  /* One background location task serves automatic check-ins and
     nearby alerts. Keep it matching the two switches. */
  // Wait until saved settings and sign-in have loaded. Otherwise a cold
  // start (including iOS waking the app for a location update) would
  // briefly see "off" and stop the task.
  const { flightAuto, hydrated, meetups } = app;
  const authKnown = user !== undefined;
  useEffect(() => {
    if (!hydrated || !authKnown) return;
    syncBackground({ flight: !!(signedIn && flightAuto), nearby: !!(signedIn && nearby.on) }).catch(() => {});
  }, [hydrated, authKnown, signedIn, flightAuto, nearby.on]);

  /* Accepted meetups, so the background task can check you in during
     a meetup's window even if it already stamped that place today. */
  const meetKey = JSON.stringify((meetups || []).filter((m) => m.status?.[user?.uid] === 'going').map((m) => [m.id, m.placeId, m.atMs]));
  useEffect(() => {
    if (!hydrated || !authKnown) return;
    saveMeetupsForBackground(signedIn ? JSON.parse(meetKey).map(([id, placeId, atMs]) => ({ id, placeId, atMs })) : []).catch(() => {});
  }, [hydrated, authKnown, signedIn, meetKey]);

  /* Opening the app counts toward a stay that started in the background. */
  useEffect(() => {
    if (!hydrated || !signedIn || !flightAuto) return undefined;
    checkNow();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') checkNow(); });
    return () => sub.remove();
  }, [hydrated, signedIn, flightAuto]);
  return null;
}

export default function Shell() {
  const { t } = useTheme();
  const { hydrated, onboarded, tab, setTab, pilotOpen, setPilotOpen, toast, requests, assignments, unreadChats, pendingMeetups } = useApp();
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: t.paper }} />;
  if (!onboarded) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar barStyle={t.mode === 'dark' ? 'light-content' : 'dark-content'} />
        <LinkCatcher />
        <Onboarding />
      </View>
    );
  }
  const overdue = assignments.some((a) => !a.done && a.due && new Date(a.due) < new Date());
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <StatusBar barStyle={t.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <LinkCatcher />
      <BackgroundJobs />
      {tab === 'home' ? <Home /> : null}
      {tab === 'discover' ? <Discover /> : null}
      {tab === 'campus' ? <Campus /> : null}
      {tab === 'schedule' ? <Planner /> : null}
      {tab === 'you' ? <You /> : null}
      <PilotFab onPress={() => setPilotOpen(true)} />
      <TabBar tab={tab} setTab={setTab} badges={{ you: requests.length > 0 || unreadChats > 0 || pendingMeetups > 0, schedule: overdue }} />
      <SheetHost />
      <ConflictPrompt />
      {pilotOpen ? <Pilot onClose={() => setPilotOpen(false)} /> : null}
      <Toast message={toast} />
    </View>
  );
}
