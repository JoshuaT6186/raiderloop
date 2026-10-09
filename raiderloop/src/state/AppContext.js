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
  onAuth, listenMyProfile, listenFriends, listenRequests, listenFriendLocations, listenBlocked, listenFlight, listenMeetups, listenChats,
} from '../lib/firebase';
import { sortByTime, todayCode, overlaps, uid, localDay, isStaleOneOff } from '../lib/time';
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
  assignments: [], // { id, title, course, due (ISO), done, source: 'manual'|'syllabus', url? }
  gradeCourses: [], // { id, name, credits, grade }
  priorGpa: '',
  priorCredits: '',
  savedEvents: [], // full event objects, so live events stay viewable after the feed refreshes
  followedOrgIds: [],
  theme: 'system', // system | light (notebook) | dark (chalkboard)
  notif: { classes: true, leadMinutes: 15, weather: true, assignments: true, assignmentLeadHours: 24, saved: true },
  sharing: { on: false, allowed: [], until: null, precise: false }, // until: ISO | null (until I turn it off)
  isPlus: false,
  adConsentAsked: false,
  pilotUsedToday: 0,
  pilotDay: '',
  dismissedTips: [],
  scheduleShare: { levels: {} }, // friendUid → 'busy' | 'full' (absent = off)
  nearby: { on: false, allow: [] }, // nearby-friend alerts (mutual opt-in)
  flightAuto: false, // automatic check-ins for flight score (needs Always location)
  chatRead: {}, // chatId → ms of the last message I've seen
  sentRequests: [], // uids I've sent friend requests to (for "Requested")
  hiddenMsgs: [], // message ids I reported/hid
  dataOwner: null, // uid of the account the personal data below belongs to
  pendingInvite: null, // friend code from an invite link, redeemed once signed in
};
const PERSIST_KEYS = Object.keys(DEFAULTS).filter((k) => k !== 'onboardStep');

/* Personal data that lives only on this phone. Signing out keeps it, so
   signing back in brings your schedule back. It's cleared only when a
   different account (or a guest) starts using the phone. */
const PERSONAL_KEYS = [
  'scheduleItems', 'assignments', 'gradeCourses', 'priorGpa', 'priorCredits', 'savedEvents',
  'followedOrgIds', 'interests', 'userMajor', 'userClassYear', 'theme', 'notif', 'dismissedTips',
  // Settings that mirror the server, so signing back in doesn't push "off" over them.
  'scheduleShare', 'nearby', 'flightAuto', 'hiddenMsgs', 'chatRead', 'sentRequests',
];
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

export function AppProvider({ children }) {
  const [state, setState] = useState(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [authRev, setAuthRev] = useState(0); // bumps when the same user object changes (guest → account)
  const [mapFocus, setMapFocus] = useState(null); // { lat, lng, at } to center the Campus map
  const [profile, setProfile] = useState(null); // server profile (handle etc.)
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friendLocations, setFriendLocations] = useState([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [flight, setFlight] = useState({});
  const [meetups, setMeetups] = useState([]);
  const [chats, setChats] = useState([]);

  // Ephemeral UI state
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null); // { type, ...payload }
  const [pilotOpen, setPilotOpen] = useState(false);
  const [pilotSeed, setPilotSeed] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

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
            next.scheduleShare = { ...DEFAULTS.scheduleShare, ...(data.scheduleShare || {}) };
            next.nearby = { ...DEFAULTS.nearby, ...(data.nearby || {}) };
            next.avatar = { ...DEFAULT_AVATAR, ...(data.avatar || {}) };
            next.scheduleItems = (next.scheduleItems || []).filter((i) => !isStaleOneOff(i)); // drop past one-off events
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
  useEffect(() => onAuth((u) => { setUser(u || null); setAuthRev((r) => r + 1); }), []);
  // Changes when the account changes, including a guest becoming a real account.
  const userKey = user === undefined ? 'loading' : user ? `${user.uid}:${user.isAnonymous ? 'guest' : 'acct'}` : 'none';
  useEffect(() => {
    if (!user || user.isAnonymous) { setProfile(null); return undefined; }
    return listenMyProfile(user.uid, setProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);
  useEffect(() => {
    if (!user || user.isAnonymous) { setFriends([]); setRequests([]); setFriendLocations([]); return undefined; }
    setFriendsLoaded(false);
    const a = listenFriends(user.uid, (list, ok) => { setFriends(list); if (ok) setFriendsLoaded(true); });
    const b = listenRequests(user.uid, setRequests);
    /* Only fresh, unexpired locations from people who are still my
       friends are shown — a stale or revoked doc is simply hidden. */
    const c = listenFriendLocations(user.uid, (locs) => setFriendLocations(locs.filter((l) => !l.until || new Date(l.until) > new Date())));
    const d = listenBlocked(user.uid, setBlocked);
    const e = listenFlight(user.uid, setFlight);
    const g = listenMeetups(user.uid, setMeetups);
    const h = listenChats(user.uid, setChats);
    return () => { a(); b(); c(); d(); e(); g(); h(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);
  useEffect(() => {
    if (!user || user.isAnonymous) { setBlocked([]); setFlight({}); setMeetups([]); setChats([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  const set = (patch) => setState((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));

  /* ---------- schedule ---------- */
  const addClass = (cls) => set((p) => ({ scheduleItems: sortByTime([...p.scheduleItems, { ...cls, id: cls.id || uid('cls') }]) }));
  const updateClass = (id, cls) => set((p) => ({ scheduleItems: sortByTime(p.scheduleItems.map((i) => (i.id === id ? { ...i, ...cls } : i))) }));
  const removeClass = (id) => set((p) => ({ scheduleItems: p.scheduleItems.filter((i) => i.id !== id) }));
  const replaceSchedule = (items) => set({ scheduleItems: sortByTime(items) });

  const addEventToSchedule = (ev, { force = false } = {}) => {
    if (!ev.time) { showToast("That event doesn't list a time, so it can't go on your schedule."); return; }
    if (state.scheduleItems.some((i) => i.id === `ev-${ev.id}` && !isStaleOneOff(i))) { showToast("That's already on today's schedule."); return; }
    if (!force) {
      const clash = state.scheduleItems.find((i) => !isStaleOneOff(i) && (i.days || []).includes(todayCode()) && overlaps(i.time, i.endTime || i.time, ev.time, ev.endTime || ev.time));
      if (clash) { setConflict({ incoming: ev, existing: clash }); return; }
    }
    const item = {
      id: `ev-${ev.id}`, time: ev.time, endTime: ev.endTime || '', title: ev.title,
      place: ev.location || buildingById(ev.buildingId)?.name || '', type: 'event', buildingId: ev.buildingId || null,
      days: [todayCode()], oneOff: true, onDate: localDay(),
    };
    // Drop past one-offs first, in case the app stayed open past midnight.
    set((p) => ({ scheduleItems: sortByTime([...p.scheduleItems.filter((i) => !isStaleOneOff(i)), item]) }));
    showToast('Added to today');
  };

  /* ---------- assignments ---------- */
  const addAssignment = (a) => set((p) => ({ assignments: [...p.assignments, { done: false, source: 'manual', ...a, id: a.id || uid('asg') }] }));
  const updateAssignment = (id, patch) => set((p) => ({ assignments: p.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const removeAssignment = (id) => set((p) => ({ assignments: p.assignments.filter((a) => a.id !== id) }));

  /* ---------- saves & follows ---------- */
  const isSaved = (id) => state.savedEvents.some((e) => e.id === id);
  const toggleSave = (ev) => set((p) => ({
    savedEvents: p.savedEvents.some((e) => e.id === ev.id) ? p.savedEvents.filter((e) => e.id !== ev.id) : [...p.savedEvents, ev],
  }));
  const toggleFollow = (id) => set((p) => ({
    followedOrgIds: p.followedOrgIds.includes(id) ? p.followedOrgIds.filter((x) => x !== id) : [...p.followedOrgIds, id],
  }));

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const goToBuilding = (id) => { setSheet(null); setTab('campus'); setTimeout(() => setSheet({ type: 'building', id }), 50); };

  const notePilotUse = () => set((p) => {
    const day = localDay();
    return p.pilotDay === day ? { pilotUsedToday: p.pilotUsedToday + 1 } : { pilotDay: day, pilotUsedToday: 1 };
  });

  /* Back to the first screen. Delete Account wipes everything. Sign Out
     passes keepData, so the schedule, assignments and grades stay on the
     phone, tagged with whose they are. */
  const resetAll = ({ keepData = false, owner = null } = {}) => {
    setState((p) => (keepData ? { ...DEFAULTS, ...pick(p, PERSONAL_KEYS), dataOwner: owner || p.dataOwner } : { ...DEFAULTS }));
    setTab('home'); setSheet(null);
  };

  /* Call right after sign-in. Same account (or data that never had an
     owner, like a guest's setup): keep it. Someone else's: clear it. */
  const claimData = (newUid) => set((p) => {
    if (p.dataOwner && p.dataOwner !== newUid) {
      return { ...pick(DEFAULTS, PERSONAL_KEYS), pilotUsedToday: 0, pilotDay: '', dataOwner: newUid || null };
    }
    return { dataOwner: newUid || null };
  });

  const markChatRead = (chatId, ms) => set((p) => ({ chatRead: { ...p.chatRead, [chatId]: Math.max(ms || Date.now(), p.chatRead[chatId] || 0) } }));
  const unreadChats = chats.filter((c) => c.last && c.last.from && c.last.from !== user?.uid && (c.last.atMs || 0) > (state.chatRead[c.id] || 0)).length;
  const pendingMeetups = meetups.filter((m) => m.status && user && m.status[user.uid] === 'invited').length;

  const value = useMemo(() => ({
    ...state, set, hydrated, user, profile, friends, requests,
    friendLocations: friendLocations.filter((l) => friends.some((f) => f.uid === l.uid)),
    tab, setTab, sheet, setSheet, pilotOpen, setPilotOpen, pilotSeed, setPilotSeed,
    conflict, setConflict, toast, showToast,
    addClass, updateClass, removeClass, replaceSchedule, addEventToSchedule,
    addAssignment, updateAssignment, removeAssignment,
    isSaved, toggleSave, toggleFollow, goToBuilding, notePilotUse, resetAll, claimData, mapFocus, setMapFocus, authRev,
    blocked, flight, meetups, chats, markChatRead, unreadChats, pendingMeetups, friendsLoaded,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, hydrated, user, authRev, mapFocus, profile, friends, friendsLoaded, requests, friendLocations, blocked, flight, meetups, chats, tab, sheet, pilotOpen, pilotSeed, conflict, toast]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
