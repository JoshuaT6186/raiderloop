/**
 * Shell — tabs, the Pilot button, every sheet, and the background
 * jobs (notifications, widget, location broadcasting, profile sync,
 * Plus status). Hooks run before any early return.
 */
import React, { useEffect, useRef } from 'react';
import { View, StatusBar, Linking } from 'react-native';
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
import QrFriendSheet, { parseFriendCode, redeemCode } from './sheets/QrFriend';
import { VerifySchoolSheet, DeleteAccountSheet } from './sheets/AccountExtras';
import { usePushRegistration, useNotificationTaps } from './lib/push';
import { busyBlocks, fullClasses } from './lib/schedule';
import { useNotificationScheduler } from './lib/notifications';
import { useWidgetSync } from './lib/widget';
import { useLocationBroadcaster } from './lib/location';
import { useWeather } from './lib/hooks';
import { usePlusStatus, initAds } from './lib/monetize';
import { api } from './lib/firebase';

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
    case 'verifySchool': return <VerifySchoolSheet onClose={close} />;
    case 'deleteAccount': return <DeleteAccountSheet onClose={close} />;
    default: return null;
  }
}

function ConflictPrompt() {
  const { conflict, setConflict, addEventToSchedule } = useApp();
  if (!conflict) return null;
  return (
    <Sheet title="Heads up — time clash" onClose={() => setConflict(null)} height={0.5}
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

function BackgroundJobs() {
  const app = useApp();
  const { user, sharing, schoolId, avatar, userName, set, scheduleItems, assignments, onboarded, adConsentAsked, classmatesOptIn, isPlus } = app;
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
  });

  /* flyer://add/CODE — from someone's QR scanned with the iPhone
     camera, or an invite link. */
  const handledLinks = useRef(new Set());
  useEffect(() => {
    const handle = (url) => {
      const m = /^flyer:\/\/add\/(.+)$/i.exec(url || '');
      const code = m && parseFriendCode(m[1]);
      if (!code) return;
      if (signedIn && handledLinks.current.has(code)) return;
      if (signedIn) handledLinks.current.add(code);
      if (!signedIn) { setSheet({ type: 'account' }); showToast('Make an account, then open the link again.'); return; }
      redeemCode(code, showToast);
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  /* Keep the public profile (name, avatar, school) and class-list
     entry in sync. Debounced; only for real accounts. */
  const t = useRef(null);
  useEffect(() => {
    if (!signedIn || !onboarded) return undefined;
    clearTimeout(t.current);
    t.current = setTimeout(() => {
      api.saveProfile({ name: userName, avatar, schoolId }).catch(() => {});
      if (classmatesOptIn) {
        const classes = scheduleItems.filter((c) => !c.oneOff).map((c) => ({ course: c.title, section: c.section || '' }));
        api.setClassmateOptIn({ optIn: true, classes }).catch(() => {});
      }
    }, 1200);
    return () => clearTimeout(t.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, onboarded, userName, JSON.stringify(avatar), schoolId, classmatesOptIn, JSON.stringify(scheduleItems.map((c) => [c.title, c.section]))]);

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
        <Onboarding />
      </View>
    );
  }
  const overdue = assignments.some((a) => !a.done && a.due && new Date(a.due) < new Date());
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <StatusBar barStyle={t.mode === 'dark' ? 'light-content' : 'dark-content'} />
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
