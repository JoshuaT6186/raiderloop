/**
 * Shell — tabs, the Pilot button, every sheet, and the background
 * jobs (notifications, widget, location broadcasting, profile sync,
 * push, links, Plus status). Hooks run before any early return.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StatusBar, Linking, AppState } from 'react-native';
import { useApp } from './state/AppContext';
import { useTheme } from './theme/ThemeContext';
import { TabBar, PilotFab, WebSidebar } from './ui/Page';
import { useWide, IS_WEB } from './ui/web';
import { DeskMode } from './sheets/Desk';
import { Toast, Sheet, Button, PostIt, PT } from './ui/Paper';
import { PlaneFlight, FadeIn } from './ui/Kit';
import Avatar from './ui/Avatar';
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
import { OpenNowSheet, ParkingSheet, SafetySheet, BusSheet } from './sheets/CampusTools';
import { GamedaySheet, PlusSheet, AccountSheet } from './sheets/Misc';
import {
  JobsSheet, MoneySheet, FormsSheet, HealthSheet, CourseSheet, DealsSheet,
} from './sheets/Hub';
import { ToolsSheet } from './sheets/Tools';
import { CardEditSheet, CardViewSheet, MyQRSheet } from './sheets/Connect';
import { ScannerSheet } from './sheets/Scanner';
import { DropSheet, DropViewSheet, sentHere } from './sheets/Drop';
import { SayHiSheet, useSayHiSync } from './sheets/SayHi';
import { StorySheet, ComposeSheet } from './sheets/Story';
import { GroupsSheet, GroupNewSheet, GroupSheet } from './sheets/Groups';
import { PlanNewSheet, PlanSheet } from './sheets/Plans';
import { PrivacySheet } from './sheets/Privacy';
import { RoomFinderSheet } from './sheets/Rooms';
import { SyllabusSheet } from './sheets/Scan';
import { PublicNewSheet, PublicPostSheet } from './sheets/Public';
import { ShareViewSheet } from './sheets/ShareView';
import { PresentSheet } from './sheets/Present';
import { MissedClassSheet } from './sheets/MissedClass';
import { SafeWalkSheet, WalkWatchSheet } from './sheets/SafeWalk';
import { GameSheet, GameNewSheet } from './sheets/Game';
import { WellnessSheet } from './sheets/Wellness';
import { MajorExplorerSheet, RoadmapSheet } from './sheets/Explore';
import { FirstWeeksSheet } from './sheets/FirstWeeks';
import { ScrapbookSheet } from './sheets/Scrapbook';
import { ConnectionsSheet } from './sheets/Connections';
import { AdminSheet } from './sheets/Admin';
import { CampusGuideSheet } from './sheets/Guide';
import { OrgsSheet } from './sheets/Orgs';
import { useNotificationScheduler } from './lib/notifications';
import { useWidgetSync } from './lib/widget';
import { useLocationBroadcaster } from './lib/location';
import { useWeather } from './lib/hooks';
import { usePlusStatus, initAds } from './lib/monetize';
import { usePush } from './lib/push';
import { parseLink } from './lib/deeplinks';
import { smsContext } from './lib/smsContext';
import { api } from './lib/firebase';

function SheetHost() {
  const { sheet, setSheet } = useApp();
  if (!sheet) return null;
  const close = () => setSheet(null);
  const s = sheet;
  switch (s.type) {
    case 'event': return <EventSheet ev={s.ev} onClose={close} />;
    case 'org': return <OrgSheet id={s.id} onClose={close} />;
    case 'orgs': return <OrgBrowser initial={s.initial} onClose={close} />;
    case 'building': return <BuildingSheet id={s.id} onClose={close} />;
    case 'dining': return <DiningSheet id={s.id} onClose={close} />;
    case 'openNow': return <OpenNowSheet onClose={close} />;
    case 'parking': return <ParkingSheet onClose={close} />;
    case 'bus': return <BusSheet id={s.id} onClose={close} />;
    case 'safety': return <SafetySheet onClose={close} />;
    case 'sports': return <SportsSheet onClose={close} />;
    case 'friends': return <FriendsSheet initialTab={s.tab} onClose={close} />;
    case 'gameday': return <GamedaySheet kickoff={s.kickoff} onClose={close} />;
    case 'plus': return <PlusSheet onClose={close} />;
    case 'account': return <AccountSheet onClose={close} />;
    case 'requestSchool': return <RequestSchool onClose={close} />;
    case 'jobs': return <JobsSheet initialTab={s.tab} onClose={close} />;
    case 'money': return <MoneySheet onClose={close} />;
    case 'forms': return <FormsSheet onClose={close} />;
    case 'health': return <HealthSheet onClose={close} />;
    case 'course': return <CourseSheet code={s.code} onClose={close} />;
    case 'deals': return <DealsSheet onClose={close} />;
    case 'tools': return <ToolsSheet initialTab={s.tab} onClose={close} />;
    /* Connect */
    case 'card': return <CardViewSheet uid={s.uid} handle={s.handle} onClose={close} />;
    case 'cardEdit': return <CardEditSheet onClose={close} />;
    case 'myQR': return <MyQRSheet onClose={close} />;
    case 'scan': return <ScannerSheet onClose={close} />;
    case 'drop': return s.id ? <DropViewSheet id={s.id} onClose={close} /> : <DropSheet to={s.to} initialTab={s.tab} onClose={close} />;
    case 'sayhi': return <SayHiSheet tab={s.tab} onClose={close} />;
    case 'story': return <StorySheet uid={s.uid} name={s.name} onClose={close} />;
    case 'compose': return <ComposeSheet kind={s.kind} hunt={s.hunt} item={s.item} onClose={close} />;
    case 'privacy': return <PrivacySheet onClose={close} />;
    case 'share': return <ShareViewSheet id={s.id} onClose={close} />;
    /* Together */
    case 'groups': return <GroupsSheet onClose={close} />;
    case 'groupNew': return <GroupNewSheet onClose={close} />;
    case 'group': return <GroupSheet id={s.id} code={s.code} onClose={close} />;
    case 'planNew': return <PlanNewSheet groupId={s.groupId} title={s.title} options={s.options} kind={s.kind} onClose={close} />;
    case 'plan': return <PlanSheet id={s.id} onClose={close} />;
    case 'present': return <PresentSheet code={s.code} groupId={s.groupId} onClose={close} />;
    case 'safewalk': return <SafeWalkSheet onClose={close} />;
    case 'walkWatch': return <WalkWatchSheet id={s.id} onClose={close} />;
    /* Discover */
    case 'publicNew': return <PublicNewSheet kind={s.kind} draft={s.draft} onClose={close} />;
    case 'publicPost': return <PublicPostSheet id={s.id} onClose={close} />;
    case 'orgOfficer': return <OrgsSheet orgId={s.orgId} onClose={close} />;
    /* Play */
    case 'game': return <GameSheet id={s.id} onClose={close} />;
    case 'gameNew': return <GameNewSheet onClose={close} />;
    /* Campus + school */
    case 'rooms': return <RoomFinderSheet query={s.query} buildingId={s.buildingId} onClose={close} />;
    case 'syllabus': return <SyllabusSheet course={s.course} onClose={close} />;
    case 'missed': return <MissedClassSheet course={s.course} date={s.date} onClose={close} />;
    case 'wellness': return <WellnessSheet onClose={close} />;
    case 'majors': return <MajorExplorerSheet initial={s.initial} onClose={close} />;
    case 'roadmap': return <RoadmapSheet major={s.major} onClose={close} />;
    case 'firstWeeks': return <FirstWeeksSheet onClose={close} />;
    case 'scrapbook': return <ScrapbookSheet onClose={close} />;
    case 'connections': return <ConnectionsSheet pick={s.pick} onClose={close} />;
    case 'admin': return <AdminSheet onClose={close} />;
    case 'guide': return <CampusGuideSheet onClose={close} />;
    default: return null;
  }
}

function ConflictPrompt() {
  const { conflict, setConflict, addEventToSchedule } = useApp();
  if (!conflict) return null;
  return (
    <Sheet title="Heads up: time clash" onClose={() => setConflict(null)} height={0.5}
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

/* A paper plane lands when someone sends you a Flyer Drop while the
   app is open, then a little note asks if you want to look. */
const DROP_LABEL = { card: 'their card', link: 'a link', note: 'a note', photo: 'a photo', file: 'a file', event: 'an event', group: 'a group invite', plan: 'a plan' };
function IncomingDrop() {
  const { drops, user, setSheet } = useApp();
  const seen = useRef(null);
  const [incoming, setIncoming] = useState(null);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!user) return;
    const ids = drops.map((d) => d.id);
    if (seen.current === null) { seen.current = new Set(ids); return; } // first load: nothing flies in
    const fresh = drops.find((d) => !seen.current.has(d.id) && !sentHere.has(d.id) && (d.from !== user.uid || d.toSelf));
    ids.forEach((id) => seen.current.add(id));
    if (fresh && !incoming) { setIncoming(fresh); setLanded(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops.map((d) => d.id).join(','), user?.uid]);
  useEffect(() => {
    if (!landed) return undefined;
    const id = setTimeout(() => setIncoming(null), 9000);
    return () => clearTimeout(id);
  }, [landed]);
  if (!incoming) return null;
  if (!landed) return <PlaneFlight direction="in" onDone={() => setLanded(true)} />;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, top: 60 }}>
      <FadeIn>
        <PostIt color="yellow" tape tilt={-1.5}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar config={incoming.fromAvatar} size={40} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <PT kind="bold">{incoming.toSelf && incoming.from === user?.uid ? `You sent yourself ${DROP_LABEL[incoming.kind] || 'something'}` : `${incoming.fromName || 'Someone'} sent you ${DROP_LABEL[incoming.kind] || 'something'}`}</PT>
              {incoming.payload?.title ? <PT kind="small" numberOfLines={1}>{incoming.payload.title}</PT> : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Button title="Open" small icon="plane" onPress={() => { const id = incoming.id; setIncoming(null); setSheet({ type: 'drop', id }); }} style={{ marginRight: 8 }} />
            <Button title="Later" small kind="ghost" onPress={() => setIncoming(null)} />
          </View>
        </PostIt>
      </FadeIn>
    </View>
  );
}

function BackgroundJobs() {
  const app = useApp();
  const {
    user, sharing, schoolId, avatar, userName, set, scheduleItems, assignments, onboarded, adConsentAsked, classmatesOptIn, isPlus,
    pushPrefs, routePush, routeLink, sayHiVisible, myCard, connections, userMajor, userClassYear,
  } = app;
  const weather = useWeather(schoolId);
  useNotificationScheduler(app);
  useWidgetSync({ scheduleItems, assignments, weather, savedEvents: app.savedEvents });
  useLocationBroadcaster({
    sharing, user, schoolId, avatar, userName,
    onExpired: () => set((p) => ({ sharing: { ...p.sharing, on: false, until: null } })),
  });
  usePlusStatus(user, (plus) => set({ isPlus: plus }));
  useEffect(() => { if (onboarded && !isPlus) initAds({ askTracking: false }); }, [onboarded, adConsentAsked, isPlus]);
  usePush({ user, onboarded, prefs: pushPrefs, onRoute: routePush });

  /* Links: QR codes, texted flyer.app links, and flyer:// open the
     right sheet, whether the app was closed or already open. */
  const routeRef = useRef(routeLink);
  routeRef.current = routeLink;
  useEffect(() => {
    if (!onboarded) return undefined;
    Linking.getInitialURL().then((url) => { const l = parseLink(url); if (l) setTimeout(() => routeRef.current(l), 400); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => { const l = parseLink(url); if (l) routeRef.current(l); });
    return () => sub && sub.remove();
  }, [onboarded]);

  /* Keep the public profile (name, avatar, school) in sync for
     friends. Debounced; only for real accounts. */
  const courses = [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => c.title))];
  const syncSayHi = useSayHiSync();
  const t = useRef(null);
  useEffect(() => {
    if (!user || user.isAnonymous || !onboarded) return undefined;
    clearTimeout(t.current);
    t.current = setTimeout(() => {
      api.saveProfile({ name: userName, avatar, schoolId }).catch(() => {});
      if (classmatesOptIn) api.setClassmateOptIn({ optIn: true, courses }).catch(() => {});
      if (sayHiVisible) syncSayHi(true).catch(() => {});
    }, 1200);
    return () => clearTimeout(t.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, onboarded, userName, JSON.stringify(avatar), schoolId, classmatesOptIn, sayHiVisible, JSON.stringify(courses), JSON.stringify((myCard?.orgs || []).map((o) => o.name))]);

  /* Text Flyer: the number you text only knows the short summary the
     app sends here, and only while it's turned on. Refreshes when your
     schedule or due dates change, and when the app comes back. */
  const [wake, setWake] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') setWake((x) => x + 1); });
    return () => sub && sub.remove();
  }, []);
  const smsKey = connections?.textFlyer ? JSON.stringify([scheduleItems.map((c) => [c.title, c.time, c.days, c.place]), assignments.filter((a) => !a.done).map((a) => [a.title, a.due]), new Date().toDateString()]) : '';
  useEffect(() => {
    if (!smsKey || !user || user.isAnonymous) return undefined;
    const id = setTimeout(() => { api.saveSmsContext({ context: smsContext({ scheduleItems, assignments, userMajor, userClassYear }) }).catch(() => {}); }, 3000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smsKey, wake, user?.uid]);
  return null;
}

/* Admin check for the web sidebar (staff accounts only). */
function useAdmin(user) {
  const [admin, setAdmin] = useState(false);
  useEffect(() => { if (IS_WEB && user && !user.isAnonymous) api.amIAdmin({}).then((r) => setAdmin(!!r.data.admin)).catch(() => {}); }, [user?.uid]);
  return admin;
}

export default function Shell() {
  const { t } = useTheme();
  const { hydrated, onboarded, tab, setTab, pilotOpen, setPilotOpen, toast, requests, assignments, intros, groupInvites, setSheet, user, campusMode, setCampusMode } = useApp();
  const wide = useWide();
  const admin = useAdmin(user);
  const [desk, setDesk] = useState(false);
  /* The web has no map, so Campus opens on the Hub. */
  useEffect(() => { if (IS_WEB && campusMode !== 'hub') setCampusMode('hub'); }, [campusMode]);
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: t.paper }} />;
  if (!onboarded) {
    return (
      <View style={{ flex: 1, backgroundColor: wide ? (t.mode === 'dark' ? t.card : '#F1E9D8') : t.paper }}>
        <StatusBar barStyle={t.mode === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={wide ? { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: t.border } : { flex: 1 }}>
          <Onboarding />
        </View>
      </View>
    );
  }
  const overdue = assignments.some((a) => !a.done && a.due && new Date(a.due) < new Date());
  const youBadge = requests.length > 0 || (intros || []).length > 0 || (groupInvites || []).length > 0;
  const screens = (
    <>
      {tab === 'home' ? <Home /> : null}
      {tab === 'discover' ? <Discover /> : null}
      {tab === 'campus' ? <Campus /> : null}
      {tab === 'schedule' ? <Planner /> : null}
      {tab === 'you' ? <You /> : null}
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <StatusBar barStyle={t.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <BackgroundJobs />
      {wide ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <WebSidebar tab={tab} setTab={setTab} badges={{ you: youBadge, schedule: overdue }} admin={admin}
            onDrop={() => setSheet({ type: 'drop' })} onPresent={() => setSheet({ type: 'present' })} onDesk={() => setDesk(true)}
            onGuide={() => setSheet({ type: 'guide' })} onAdmin={() => setSheet({ type: 'admin' })} />
          <View style={{ flex: 1 }}>{screens}</View>
        </View>
      ) : screens}
      <PilotFab onPress={() => setPilotOpen(true)} />
      {wide ? null : <TabBar tab={tab} setTab={setTab} badges={{ you: youBadge, schedule: overdue }} />}
      {desk ? <DeskMode onClose={() => setDesk(false)} /> : null}
      <SheetHost />
      <ConflictPrompt />
      {pilotOpen ? <Pilot onClose={() => setPilotOpen(false)} /> : null}
      <IncomingDrop />
      <Toast message={toast} />
    </View>
  );
}
