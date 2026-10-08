/**
 * Background location: automatic check-ins and nearby-friend alerts.
 * ------------------------------------------------------------
 * One background task serves both features, so the phone never runs
 * two location trackers. Each feature has its own switch; the task
 * runs only while at least one is on, and iOS shows its location arrow
 * while it does.
 *
 * Automatic check-ins (flight score):
 *  • The phone compares each location update with the check-in places
 *    on the device. Nothing is sent while you're just moving around.
 *  • When you've stayed at one place for a few minutes, Flyer sends
 *    that place and one location reading. The server double-checks the
 *    distance and decides the points (game, event, meetup, or place).
 *  • Each place is checked in at most once a day from the phone.
 *
 * Nearby alerts: a coarse position goes to the server at most every
 * few minutes or after moving ~150 m, and only while that switch is on.
 *
 * The task must be defined when the app starts (App.js imports this
 * file), because iOS can wake the app just to run it.
 */
import { Platform } from 'react-native';
import { TaskManager, Location, AsyncStorage, Notifications } from './native';
import { api } from './firebase';
import { PLACES, FLIGHT, classBuildingIds } from '../data/places';
import { APP } from '../config';

// Kept from the first version so phones that already had it running
// keep working after the update.
export const LOCATION_TASK = 'flyer-nearby-alerts';
const PREFS_KEY = 'flyer_bg_prefs';
const STATE_KEY = 'flyer_bg_state';
const DWELL_MS = (FLIGHT.autoDwellMin || 5) * 60000;
const MAX_ACC = FLIGHT.maxAccuracyM || 75;
const RADIUS = FLIGHT.radiusM || 150;
const NEARBY_MIN_MS = 4 * 60000;
const MEETUPS_KEY = 'flyer_bg_meetups';
const NEARBY_KEY = 'flyer_bg_nearby';
const STALE_MS = 3 * 3600000; // a gap this long starts a new stay
const MEETUP_DWELL_MS = 2 * 60000;
const MEETUP_WIN = FLIGHT.meetupWindow || { beforeMin: 15, afterMin: 30 };
const NEARBY_MIN_M = 150;

export const backgroundAvailable = () => !!(TaskManager && Location && Platform.OS !== 'web');

/* ---------- small storage helpers ---------- */
async function readJson(key, fallback) {
  try { const raw = AsyncStorage && (await AsyncStorage.getItem(key)); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
}
async function writeJson(key, value) {
  try { if (AsyncStorage) await AsyncStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or unavailable */ }
}
export const readPrefs = () => readJson(PREFS_KEY, { flight: false, nearby: false });

/* ---------- geometry ---------- */
function distanceM(a, b) {
  const R = 6371000; const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad; const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const within = (fix, place) => distanceM(fix, place) <= RADIUS + Math.min(fix.accuracy, MAX_ACC);
function nearestPlace(fix) {
  let best = null; let bestD = Infinity;
  for (const p of PLACES) {
    if (p.lat == null || p.lng == null) continue;
    const d = distanceM(fix, p);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best && within(fix, best) ? best : null;
}

const chicagoDay = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

async function notify(title, body) {
  if (!Notifications) return;
  try { await Notifications.scheduleNotificationAsync({ content: { title, body, data: { open: 'passport' } }, trigger: null }); } catch (e) { /* notifications off */ }
}

async function classIds() {
  const app = await readJson(APP.storageKey, {});
  return classBuildingIds(app.scheduleItems || []);
}

/* ---------- automatic check-ins ----------
   state: { placeId, since, lastIn, fix, done: { day, ids[] } }
   "since" is when you arrived; "lastIn" is the latest reading still at
   that place. A check-in fires once you've been there DWELL_MS, either
   on a later reading at the place or on the first reading after you
   leave (iOS often pauses updates while you sit still). */
async function fire(state, placeId, fix) {
  const day = chicagoDay(fix.ts || Date.now());
  const done = state.done && state.done.day === day ? state.done : { day, ids: [] };
  if (done.ids.includes(placeId)) return;
  done.ids.push(placeId);
  state.done = done;
  await writeJson(STATE_KEY, state);
  try {
    const r = await api.autoCheckIn({ placeId, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, classBuildingIds: await classIds() });
    const d = r.data || {};
    if (d.pts > 0) await notify(`+${d.pts} flight score`, d.message || `Stamped at ${d.placeName}`);
    for (const m of d.meetups || []) if (m.message && !m.already) await notify('Meetup', m.message);
  } catch (e) {
    // Couldn't reach the server (or it said no). Allow another try later today.
    state.done.ids = state.done.ids.filter((x) => x !== placeId);
    await writeJson(STATE_KEY, state);
  }
}

/* An accepted meetup whose window is open and whose place you're at:
   check in for it even if that place was already stamped today. The
   place doesn't have to be the nearest one on the list. */
async function fireMeetups(state, fix) {
  const meetups = await readJson(MEETUPS_KEY, []);
  for (const m of meetups) {
    const sent = state.sentMeetups || [];
    if (sent.includes(m.id)) continue;
    const place = PLACES.find((p) => p.id === m.placeId);
    if (!place || !within(fix, place)) continue;
    if (fix.ts < m.atMs - MEETUP_WIN.beforeMin * 60000 || fix.ts > m.atMs + MEETUP_WIN.afterMin * 60000) continue;
    if (fix.ts < m.atMs && fix.ts - state.since < MEETUP_DWELL_MS) continue; // just got there early: wait a moment
    state.sentMeetups = [...sent, m.id].slice(-30);
    await writeJson(STATE_KEY, state);
    try {
      const r = await api.autoCheckIn({ placeId: place.id, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, classBuildingIds: await classIds() });
      for (const x of (r.data || {}).meetups || []) if (x.message && !x.already) await notify('Meetup', x.message);
    } catch (e) {
      state.sentMeetups = (state.sentMeetups || []).filter((x) => x !== m.id);
      await writeJson(STATE_KEY, state);
    }
  }
}

export async function processLocations(locations) {
  const prefs = await readPrefs();
  const fixes = (locations || [])
    .map((l) => ({ lat: l.coords.latitude, lng: l.coords.longitude, accuracy: l.coords.accuracy || MAX_ACC, ts: l.timestamp || Date.now() }))
    .sort((a, b) => a.ts - b.ts);
  if (!fixes.length) return;

  if (prefs.flight) {
    const state = await readJson(STATE_KEY, {});
    for (const fix of fixes) {
      if (fix.accuracy > MAX_ACC * 2) continue; // too fuzzy to place you
      const cur = state.placeId ? PLACES.find((p) => p.id === state.placeId) : null;
      if (cur && within(fix, cur)) {
        // A long silence (overnight, phone off) or a new day starts a new stay.
        if (fix.ts - state.lastIn > STALE_MS || chicagoDay(fix.ts) !== chicagoDay(state.since)) { state.since = fix.ts; state.fix = null; }
        // Still here (stick with this place even if a neighbor is closer by a hair).
        state.lastIn = fix.ts;
        if (!state.fix || fix.accuracy <= state.fix.accuracy) state.fix = fix;
        if (fix.ts - state.since >= DWELL_MS) await fire(state, cur.id, state.fix);
        await fireMeetups(state, fix);
        continue;
      }
      // Left (or never had) a place. iOS stops sending updates while you
      // sit still and sends one once you move ~40 m, so the first reading
      // away from a place marks when you left. Gaps over 3 hours don't count.
      if (cur && state.fix && fix.ts - state.since >= DWELL_MS && fix.ts - state.lastIn <= STALE_MS && chicagoDay(fix.ts) === chicagoDay(state.since)) await fire(state, cur.id, state.fix);
      const next = nearestPlace(fix);
      state.placeId = next ? next.id : null;
      state.since = fix.ts; state.lastIn = fix.ts; state.fix = next ? fix : null;
      await fireMeetups(state, fix);
    }
    await writeJson(STATE_KEY, state);
  }

  if (prefs.nearby) {
    const last = fixes[fixes.length - 1];
    const prev = await readJson(NEARBY_KEY, null);
    if (!prev || last.ts - prev.ts >= NEARBY_MIN_MS || distanceM(prev, last) >= NEARBY_MIN_M) {
      try { await api.nearbyPing({ lat: last.lat, lng: last.lng }); await writeJson(NEARBY_KEY, last); } catch (e) { /* offline: next update tries again */ }
    }
  }
}

/* The Shell keeps this list of accepted meetups up to date. */
export async function saveMeetupsForBackground(list) {
  await writeJson(MEETUPS_KEY, (list || []).slice(0, 30));
}

if (backgroundAvailable()) {
  try {
    TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
      if (error || !data || !data.locations) return;
      await processLocations(data.locations);
    });
  } catch (e) { /* already defined (fast refresh) */ }
}

/* ---------- permissions + starting / stopping ---------- */
export async function hasAlways() {
  if (!backgroundAvailable()) return false;
  try { return !!(await Location.getBackgroundPermissionsAsync()).granted; } catch (e) { return false; }
}

/* Asks for "While Using", then "Always". Returns { ok, message }. */
export async function requestAlways() {
  if (!backgroundAvailable()) return { ok: false, message: 'This needs the full app build.' };
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { ok: false, message: 'Turn on location for Flyer in Settings first.' };
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return { ok: false, message: 'Set Flyer\'s location to "Always" in Settings → Flyer → Location.' };
  return { ok: true };
}

export async function taskRunning() {
  if (!backgroundAvailable()) return false;
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
}

/* Saves which features want background location and starts or stops
   the one task to match. Never asks for permission itself. */
export async function syncBackground({ flight, nearby }) {
  await writeJson(PREFS_KEY, { flight: !!flight, nearby: !!nearby });
  if (!backgroundAvailable()) return false;
  const want = (flight || nearby) && (await hasAlways());
  const running = await taskRunning();
  if (!want) { if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {}); return false; }
  if (running) return true;
  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 40,
      pausesUpdatesAutomatically: true,
      activityType: Location.ActivityType?.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: { notificationTitle: 'Flyer is checking you in', notificationBody: 'Turn this off any time in your Flight passport.' },
    });
    return true;
  } catch (e) { return false; }
}

/* When the app opens, one fresh reading counts toward a stay that
   started in the background (or starts one). */
export async function checkNow() {
  const prefs = await readPrefs();
  if (!prefs.flight || !Location || !(await hasAlways())) return;
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await processLocations([p]);
  } catch (e) { /* no fix right now */ }
}

/* Sign-out and account deletion: stop the task and forget everything
   it kept on the phone (last positions, today's places, meetups). */
export async function stopAllBackground() {
  try { if (AsyncStorage) await Promise.all([STATE_KEY, NEARBY_KEY, MEETUPS_KEY].map((k) => AsyncStorage.removeItem(k))); } catch (e) { /* nothing to clear */ }
  await syncBackground({ flight: false, nearby: false }).catch(() => {});
}
