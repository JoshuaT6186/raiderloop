/**
 * Shell — tabs, the Pilot button, every sheet, and the background
 * jobs (notifications, widget, location broadcasting, profile sync,
 * Plus status). Hooks run before any early return.
 */
import React, { useEffect, useRef } from 'react';
import { View, StatusBar } from 'react-native';
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

  /* Keep the public profile (name, avatar, school) in sync for
     friends. Debounced; only for real accounts. */
  const t = useRef(null);
  useEffect(() => {
    if (!user || user.isAnonymous || !onboarded) return undefined;
    clearTimeout(t.current);
    t.current = setTimeout(() => {
      api.saveProfile({ name: userName, avatar, schoolId }).catch(() => {});
      if (classmatesOptIn) api.setClassmateOptIn({ optIn: true, courses: [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => c.title))] }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, onboarded, userName, JSON.stringify(avatar), schoolId, classmatesOptIn, JSON.stringify(scheduleItems.map((c) => c.title))]);
  return null;
}

export default function Shell() {
  const { t } = useTheme();
  const { hydrated, onboarded, tab, setTab, pilotOpen, setPilotOpen, toast, requests, assignments } = useApp();
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
      <TabBar tab={tab} setTab={setTab} badges={{ you: requests.length > 0, schedule: overdue }} />
      <SheetHost />
      <ConflictPrompt />
      {pilotOpen ? <Pilot onClose={() => setPilotOpen(false)} /> : null}
      <Toast message={toast} />
    </View>
  );
}
