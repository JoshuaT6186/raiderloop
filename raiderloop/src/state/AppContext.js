/**
 * App state — one context, persisted to AsyncStorage.
 * ------------------------------------------------------------
 * Personal data (schedule, assignments, grades, avatar, settings)
 * stays on the device. Only what a social feature genuinely needs
 * (display name, handle, avatar, school) is synced to Firestore, and
 * only for signed-in users — see lib/firebase.js saveProfile.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AsyncStorage } from '../lib/native';
import { APP } from '../config';
import {
  onAuth, listenMyProfile, listenFriends, listenRequests, listenFriendLocations, listenBlocked, listenIntros, listenFeed,
  listenFriendPostcards, listenMyPosts, listenMyCard, listenDrops, listenGroups, listenGroupInvites, listenWatching, listenScore, listenGames,
} from '../lib/firebase';
import { listenRemoteConfig, mergeFlags } from '../lib/remote';
import { activeSeason } from '../lib/seasons';
import { sortByTime, todayCode, overlaps, uid } from '../lib/time';
import { buildingById } from '../data/campus';
import { DEFAULT_AVATAR } from '../ui/avatarParts';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const DEFAULTS = {
  onboarded: false,
  onboardStep: 'welcome', // welcome | account | school | profile | avatar | interests | schedule | permissions | tour
  schoolId: null,
  userName: '',
  userMajor: '',
  userClassYear: '',
  avatar: DEFAULT_AVATAR,
  interests: [],
  scheduleItems: [],
  assignments: [], // { id, title, course, due (ISO), done, source: 'manual'|'canvas', url? }
  gradeCourses: [], // { id, name, credits, grade }
  priorGpa: '',
  priorCredits: '',
  savedEvents: [], // full event objects, so live events stay viewable after the feed refreshes
  followedOrgIds: [],
  theme: 'system', // system | light (notebook) | dark (chalkboard)
  notif: { classes: true, leadMinutes: 15, weather: true, assignments: true, assignmentLeadHours: 24, saved: true, jobs: true, leaveNow: true, bedtime: false },
  classmatesOptIn: false,
  sharing: { on: false, allowed: [], until: null, precise: false }, // until: ISO | null (until I turn it off)
  isPlus: false,
  adConsentAsked: false,
  pilotUsedToday: 0,
  pilotDay: '',
  dismissedTips: [],
  canvasCourses: [], // { name, score } from Canvas sync
  seasonPref: 'on', // on | minimal | off
  /* Jobs Hub: everything stays on this phone. */
  jobApps: [], // { id, title, place, status, url, appliedAt, followUp (ISO), notes }
  applyProfile: { resume: '', availability: [], hours: '', skills: '', references: [] },
  dealVotes: {}, // dealId -> 'works' | 'changed', so you can't vote twice from one phone
  /* Flyer 2 */
  hidden: [], // things you reported or hid: ['publicPost:abc', 'user:uid', ...]
  sayHiVisible: false, // "Show me in Say hi suggestions" (off until you choose)
  postcardsToFriends: true,
  leaderboardPublic: false,
  pushPrefs: { social: true, drops: true, groups: true, plans: true, queue: true, play: true },
  going: [], // Discover event ids you said you're going to
  helpful: [], // Good to Know tips you marked helpful
  firstWeeks: { on: null, done: [], startedAt: null }, // first-30-days checklist
  roadmap: { major: '', done: [] }, // graduation roadmap: course codes you've finished
  syllabi: [], // { course, title, instructor, officeHours, addedAt }
  feeds: [], // calendar-feed connections: { id, name, kind, lastSync, count } (links live in the keychain)
  feedEvents: [], // events from connected calendars: { id, feedId, title, startsAt, allDay, location, url }
  connections: { canvasToken: false, microsoft: false, google: false, canva: false, textFlyer: false, health: false },
  seasonIcon: 'auto', // auto | off  (seasonal app icon)
  iconAsked: '', // the season we last asked about switching the icon
  roomAliases: {}, // building codes you taught Flyer: { ENGCTR: 'engineering-center' }
  myQueue: null, // { code, entryId } office hours line you're in
  hostQueue: null, // code of a queue you're running
  activeWalk: null, // id of your Safe Walk in progress
  scrapbookSeen: '', // season id of the last scrapbook you opened
};
const PERSIST_KEYS = Object.keys(DEFAULTS).filter((k) => k !== 'onboardStep');
const EMPTY_LIVE = {
  blocked: [], intros: [], feed: [], postcards: [], myPosts: [], myCard: null, drops: [], groups: [], groupInvites: [], watching: [], score: null, games: [], gameInvites: [],
};

/* `initial` is only for tests and previews: it seeds state before the
   phone's saved data loads. The app itself never passes it. */
export function AppProvider({ children, initial }) {
  const seededLive = initial && initial.__live;
  const [state, setState] = useState(() => {
    if (!initial) return DEFAULTS;
    const { __live, __user, ...rest } = initial;
    return { ...DEFAULTS, ...rest };
  });
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState(initial && initial.__user ? initial.__user : undefined); // undefined = loading, null = signed out
  const [profile, setProfile] = useState(null); // server profile (handle etc.)
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friendLocations, setFriendLocations] = useState([]);
  const [live, setLive] = useState(() => ({ ...EMPTY_LIVE, ...(seededLive || {}) }));

  // Ephemeral UI state
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null); // { type, ...payload }
  const [pilotOpen, setPilotOpen] = useState(false);
  const [pilotSeed, setPilotSeed] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [campusMode, setCampusMode] = useState('map'); // map | hub
  const [remote, setRemote] = useState({}); // config/app from Firestore
  /* A full-screen moment on top of everything (the plane flying in
     with a Flyer Drop, a stamp landing). */
  const [overlay, setOverlay] = useState(null);

  /* ---------- hydrate ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (AsyncStorage) {
        try {
          const raw = await AsyncStorage.getItem(APP.storageKey);
          if (raw && !cancelled) {
            const data = JSON.parse(raw);
            const next = { ...DEFAULTS };
            for (const k of PERSIST_KEYS) if (data[k] !== undefined) next[k] = data[k];
            next.notif = { ...DEFAULTS.notif, ...(data.notif || {}) };
            next.sharing = { ...DEFAULTS.sharing, ...(data.sharing || {}) };
            next.avatar = { ...DEFAULT_AVATAR, ...(data.avatar || {}) };
            next.applyProfile = { ...DEFAULTS.applyProfile, ...(data.applyProfile || {}) };
            next.pushPrefs = { ...DEFAULTS.pushPrefs, ...(data.pushPrefs || {}) };
            next.connections = { ...DEFAULTS.connections, ...(data.connections || {}) };
            next.firstWeeks = { ...DEFAULTS.firstWeeks, ...(data.firstWeeks || {}) };
            next.roadmap = { ...DEFAULTS.roadmap, ...(data.roadmap || {}) };
            if (!next.onboarded && data.onboardStep) next.onboardStep = data.onboardStep;
            setState(next);
          }
        } catch (e) { /* corrupt storage — start fresh rather than crash */ }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---------- persist ---------- */
  useEffect(() => {
    if (!hydrated || !AsyncStorage) return;
    const blob = {};
    for (const k of PERSIST_KEYS) blob[k] = state[k];
    blob.onboardStep = state.onboardStep;
    AsyncStorage.setItem(APP.storageKey, JSON.stringify(blob)).catch(() => {});
  }, [hydrated, state]);

  /* ---------- auth ---------- */
  useEffect(() => (initial && initial.__user ? undefined : onAuth((u) => setUser(u || null))), []);
  useEffect(() => {
    if (!user || user.isAnonymous) { setProfile(null); return undefined; }
    return listenMyProfile(user.uid, setProfile);
  }, [user]);
  useEffect(() => {
    if (!user || user.isAnonymous) { setFriends([]); setRequests([]); setFriendLocations([]); return undefined; }
    const a = listenFriends(user.uid, setFriends);
    const b = listenRequests(user.uid, setRequests);
    /* Only fresh, unexpired locations from people who are still my
       friends are shown — a stale or revoked doc is simply hidden. */
    const c = listenFriendLocations(user.uid, (locs) => setFriendLocations(locs.filter((l) => !l.until || new Date(l.until) > new Date())));
    return () => { a(); b(); c(); };
  }, [user]);
  /* Flyer 2 live data: intros, friends' posts and postcards, my posts
     and card, drops, groups, Safe Walks I'm watching, my score, games. */
  useEffect(() => {
    if (seededLive) return undefined; // tests and previews
    if (!user || user.isAnonymous) { setLive(EMPTY_LIVE); return undefined; }
    const put = (k) => (v) => setLive((p) => ({ ...p, [k]: v }));
    const subs = [
      listenBlocked(user.uid, put('blocked')), listenIntros(user.uid, put('intros')), listenFeed(user.uid, put('feed')),
      listenFriendPostcards(user.uid, put('postcards')), listenMyPosts(user.uid, put('myPosts')), listenMyCard(user.uid, put('myCard')),
      listenDrops(user.uid, put('drops')), listenGroups(user.uid, put('groups')), listenGroupInvites(user.uid, put('groupInvites')),
      listenWatching(user.uid, put('watching')), listenScore(user.uid, put('score')),
      listenGames(user.uid, (which, list) => setLive((p) => ({ ...p, [which === 'players' ? 'games' : 'gameInvites']: list }))),
    ];
    return () => subs.forEach((u) => u && u());
  }, [user?.uid, user?.isAnonymous]);
  /* Remote switches need any signed-in user, guests included. */
  useEffect(() => {
    if (!user) return undefined;
    return listenRemoteConfig(setRemote);
  }, [user?.uid]);

  const set = (patch) => setState((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));

  /* ---------- schedule ---------- */
  const addClass = (cls) => set((p) => ({ scheduleItems: sortByTime([...p.scheduleItems, { ...cls, id: cls.id || uid('cls') }]) }));
  const updateClass = (id, cls) => set((p) => ({ scheduleItems: sortByTime(p.scheduleItems.map((i) => (i.id === id ? { ...i, ...cls } : i))) }));
  const removeClass = (id) => set((p) => ({ scheduleItems: p.scheduleItems.filter((i) => i.id !== id) }));
  const replaceSchedule = (items) => set({ scheduleItems: sortByTime(items) });

  const addEventToSchedule = (ev, { force = false } = {}) => {
    if (!ev.time) { showToast("That event doesn't list a time, so it can't go on your schedule."); return; }
    if (!force) {
      const clash = state.scheduleItems.find((i) => (i.days || []).includes(todayCode()) && overlaps(i.time, i.endTime || i.time, ev.time, ev.endTime || ev.time));
      if (clash) { setConflict({ incoming: ev, existing: clash }); return; }
    }
    addClass({
      id: `ev-${ev.id}`, time: ev.time, endTime: ev.endTime || '', title: ev.title,
      place: ev.location || buildingById(ev.buildingId)?.name || '', type: 'event', buildingId: ev.buildingId || null,
      days: [todayCode()], oneOff: true,
    });
    showToast('Added to today');
  };

  /* ---------- assignments ---------- */
  const addAssignment = (a) => set((p) => ({ assignments: [...p.assignments, { done: false, source: 'manual', ...a, id: a.id || uid('asg') }] }));
  const updateAssignment = (id, patch) => set((p) => ({ assignments: p.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const removeAssignment = (id) => set((p) => ({ assignments: p.assignments.filter((a) => a.id !== id) }));
  const mergeCanvasAssignments = (items) => set((p) => {
    const manual = p.assignments.filter((a) => a.source !== 'canvas');
    const doneIds = new Set(p.assignments.filter((a) => a.done).map((a) => a.id));
    return { assignments: [...manual, ...items.map((i) => ({ ...i, source: 'canvas', done: doneIds.has(i.id) || !!i.done }))] };
  });

  /* Calendar connections: replace everything that came from one feed
     (or provider) with its latest copy, keeping what you checked off. */
  const mergeFeed = (feedId, items = [], events = []) => set((p) => {
    const doneIds = new Set(p.assignments.filter((a) => a.done).map((a) => a.id));
    const others = p.assignments.filter((a) => a.feedId !== feedId);
    const known = new Set(others.map((a) => a.id));
    const fresh = items.filter((i) => !known.has(i.id)).map((i) => ({ ...i, feedId, source: 'feed', done: doneIds.has(i.id) || !!i.done }));
    return {
      assignments: [...others, ...fresh],
      feedEvents: [...(p.feedEvents || []).filter((e) => e.feedId !== feedId), ...events.map((e) => ({ ...e, feedId }))].slice(-400),
    };
  });
  const removeFeedData = (feedId) => set((p) => ({ assignments: p.assignments.filter((a) => a.feedId !== feedId), feedEvents: (p.feedEvents || []).filter((e) => e.feedId !== feedId) }));

  /* ---------- saves & follows ---------- */
  const isSaved = (id) => state.savedEvents.some((e) => e.id === id);
  const toggleSave = (ev) => set((p) => ({
    savedEvents: p.savedEvents.some((e) => e.id === ev.id) ? p.savedEvents.filter((e) => e.id !== ev.id) : [...p.savedEvents, ev],
  }));
  const toggleFollow = (id) => set((p) => ({
    followedOrgIds: p.followedOrgIds.includes(id) ? p.followedOrgIds.filter((x) => x !== id) : [...p.followedOrgIds, id],
  }));

  /* ---------- jobs tracker ---------- */
  const addJobApp = (j) => set((p) => ({ jobApps: [{ status: 'saved', ...j, id: j.id || uid('job'), addedAt: new Date().toISOString() }, ...p.jobApps] }));
  const updateJobApp = (id, patch) => set((p) => ({ jobApps: p.jobApps.map((j) => (j.id === id ? { ...j, ...patch } : j)) }));
  const removeJobApp = (id) => set((p) => ({ jobApps: p.jobApps.filter((j) => j.id !== id) }));

  /* Hide something you reported (or a person you blocked) right away. */
  const hide = (kind, id) => set((p) => ({ hidden: [...new Set([...(p.hidden || []), `${kind}:${id}`])].slice(-500) }));
  const isHidden = (kind, id) => (state.hidden || []).includes(`${kind}:${id}`);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const goToBuilding = (id) => { setSheet(null); setTab('campus'); setTimeout(() => setSheet({ type: 'building', id }), 50); };

  const notePilotUse = () => set((p) => {
    const day = new Date().toISOString().slice(0, 10);
    return p.pilotDay === day ? { pilotUsedToday: p.pilotUsedToday + 1 } : { pilotDay: day, pilotUsedToday: 1 };
  });

  /* Full local reset — used by Sign Out and Delete Account so the
     flow can be re-tested honestly from the very first screen. */
  const resetAll = () => { setState({ ...DEFAULTS }); setTab('home'); setSheet(null); setCampusMode('map'); setOverlay(null); };

  /* Feature switches + today's season. The day key makes the season
     re-check after midnight without a timer. */
  const flags = useMemo(() => mergeFlags(remote), [remote]);
  const dayKey = new Date().toDateString();
  const season = useMemo(() => (flags.seasons ? activeSeason(new Date(), remote.seasons) : null), [flags.seasons, remote.seasons, dayKey]);
  const askPilot = (q) => { setSheet(null); setPilotSeed(q); setPilotOpen(true); };

  /* Links (QR codes, universal links, flyer://) and notification taps
     open the right sheet. */
  const openSheet = (s) => { setSheet(null); setTimeout(() => setSheet(s), 60); };
  const routeLink = (link) => {
    if (!link) return;
    const { type, id, params = {} } = link;
    const to = {
      share: { type: 'share', id }, card: { type: 'card', handle: id }, group: { type: 'group', code: id }, drop: { type: 'drop', id },
      plan: { type: 'plan', id }, queue: { type: 'queue', code: id }, present: { type: 'present', code: id }, event: { type: 'publicPost', id },
    }[type];
    if (to) openSheet({ ...to, params });
  };
  const routePush = (data) => {
    if (!data || !data.route) return;
    const r = data.route;
    if (r === 'intro') { setTab('you'); openSheet({ type: 'sayhi', tab: 'inbox' }); return; }
    if (r === 'friends') { setTab('you'); openSheet({ type: 'friends' }); return; }
    const map = {
      drop: { type: 'drop', id: data.id }, group: { type: 'group', id: data.id }, plan: { type: 'plan', id: data.id }, queue: { type: 'queue', code: data.code },
      walk: { type: 'walkWatch', id: data.id }, game: { type: 'game', id: data.id }, notes: { type: 'missed', course: data.course, date: data.date },
      admin: { type: 'admin' }, org: { type: 'orgOfficer', orgId: data.id },
    };
    if (map[r]) openSheet(map[r]);
  };

  const blockedSet = new Set(live.blocked);
  const value = useMemo(() => ({
    ...state, set, hydrated, user, profile, friends, requests,
    ...live,
    feed: live.feed.filter((p) => !blockedSet.has(p.uid) && (!p.expiresAt || new Date(p.expiresAt) > new Date()) && !(state.hidden || []).includes(`post:${p.postId || p.id}`)),
    postcards: live.postcards.filter((p) => !blockedSet.has(p.uid) && !(state.hidden || []).includes(`post:${p.postId || p.id}`)),
    drops: live.drops.filter((d) => !blockedSet.has(d.from)),
    isBlocked: (uid) => blockedSet.has(uid),
    hide, isHidden, overlay, setOverlay,
    friendLocations: friendLocations.filter((l) => friends.some((f) => f.uid === l.uid)),
    tab, setTab, sheet, setSheet, pilotOpen, setPilotOpen, pilotSeed, setPilotSeed, askPilot,
    conflict, setConflict, toast, showToast,
    addClass, updateClass, removeClass, replaceSchedule, addEventToSchedule,
    addAssignment, updateAssignment, removeAssignment, mergeCanvasAssignments,
    isSaved, toggleSave, toggleFollow, goToBuilding, notePilotUse, resetAll,
    addJobApp, updateJobApp, removeJobApp, mergeFeed, removeFeedData,
    campusMode, setCampusMode, flags, season, routeLink, routePush, openSheet,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, hydrated, user, profile, friends, requests, friendLocations, tab, sheet, pilotOpen, pilotSeed, conflict, toast, campusMode, flags, season, live, overlay]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
