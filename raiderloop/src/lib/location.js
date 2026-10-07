/**
 * Friend location sharing — the safety rules are part of the feature.
 * ------------------------------------------------------------
 *  • Off by default. Turning it on is an explicit choice.
 *  • Friends only, and only the specific friends you pick.
 *  • Foreground only: live sharing sends location while Flyer is
 *    open, never in the background. (The separate, opt-in Nearby
 *    alerts feature in lib/nearby.js is the only background use, and
 *    it never shows anyone a location.)
 *  • Approximate by default (~100 m); precise is a separate toggle.
 *  • Timed: 1 hour, until tonight, or until you turn it off.
 *  • Campus-only option: nothing is sent when you're off campus.
 *  • Quiet revocation: removing someone from your list sends them
 *    no notification. To them, you look exactly like a friend who
 *    simply isn't sharing — "stopped sharing with me", "is offline",
 *    and "never shared" are indistinguishable by design, so the
 *    control is safe to use under pressure.
 *  • Ghost mode stops everything instantly and deletes your last
 *    location from the server.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Location } from './native';
import { api } from './firebase';
import { distanceM } from '../data/campus';
import { SCHOOLS } from '../config';

export async function getForegroundPermission(ask = true) {
  if (!Location) return false;
  const cur = await Location.getForegroundPermissionsAsync();
  if (cur.granted) return true;
  if (!ask || !cur.canAskAgain) return false;
  const req = await Location.requestForegroundPermissionsAsync();
  return !!req.granted;
}

export async function currentPosition() {
  if (!Location || !(await getForegroundPermission(false))) return null;
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
  return p ? { lat: p.coords.latitude, lng: p.coords.longitude } : null;
}

const round = (x, precise) => (precise ? Math.round(x * 1e5) / 1e5 : Math.round(x * 1e3) / 1e3);

export function sharingActive(sharing) {
  if (!sharing || !sharing.on || !sharing.allowed?.length) return false;
  if (sharing.until && new Date(sharing.until) < new Date()) return false;
  return true;
}

export function expiryFor(option) {
  const now = new Date();
  if (option === '1h') return new Date(now.getTime() + 3600000).toISOString();
  if (option === 'tonight') { const d = new Date(now); d.setHours(23, 59, 0, 0); return d.toISOString(); }
  if (option === 'game') return new Date(now.getTime() + 5 * 3600000).toISOString();
  return null;
}

/* Runs while the app is foregrounded and sharing is active. */
export function useLocationBroadcaster({ sharing, user, schoolId, avatar, userName, onExpired }) {
  const last = useRef({ at: 0, pos: null });
  const active = sharingActive(sharing) && user && !user.isAnonymous;
  useEffect(() => {
    if (sharing?.on && sharing.until && new Date(sharing.until) < new Date()) onExpired && onExpired();
  });
  /* Revocation and turning off take effect on the server right away,
     not on the next location update — the moment someone is removed
     from the list, they can no longer read the location document. */
  const allowedKey = JSON.stringify([...(sharing?.allowed || [])].sort());
  const firstRun = useRef(true);
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    if (firstRun.current) { firstRun.current = false; return; }
    if (!active) { api.stopSharing({}).catch(() => {}); return; }
    api.updateLocation({ allowedOnly: true, allowed: sharing.allowed, until: sharing.until || null }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey, active, user?.uid]);
  useEffect(() => {
    if (!active || !Location) return undefined;
    let sub = null; let appState = AppState.currentState;
    const center = (SCHOOLS.find((s) => s.id === schoolId) || SCHOOLS[0]).center;

    const send = async (coords) => {
      const pos = { lat: coords.latitude, lng: coords.longitude };
      if (sharing.campusOnly) {
        const d = distanceM(pos, { lat: center.latitude, lng: center.longitude });
        if (d != null && d > 2500) { await api.stopSharing({ keepSettings: true }).catch(() => {}); return; }
      }
      const moved = last.current.pos ? distanceM(last.current.pos, pos) : Infinity;
      if (Date.now() - last.current.at < 45000 && moved < 40) return;
      last.current = { at: Date.now(), pos };
      await api.updateLocation({
        lat: round(pos.lat, sharing.precise), lng: round(pos.lng, sharing.precise), precise: !!sharing.precise,
        allowed: sharing.allowed, until: sharing.until || null, name: userName || '', avatar,
      }).catch(() => {});
    };

    const start = async () => {
      if (!(await getForegroundPermission(false))) return;
      sub = await Location.watchPositionAsync(
        { accuracy: sharing.precise ? Location.Accuracy.High : Location.Accuracy.Balanced, distanceInterval: 30, timeInterval: 45000 },
        (p) => { if (appState === 'active') send(p.coords); },
      ).catch(() => null);
    };
    start();
    const appSub = AppState.addEventListener('change', (s) => { appState = s; });
    return () => { sub && sub.remove(); appSub.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, JSON.stringify(sharing), schoolId]);
}

export async function goGhost() {
  await api.stopSharing({}).catch(() => {});
}

export function lastSeenLabel(updatedAt) {
  if (!updatedAt) return '';
  const ms = Date.now() - (updatedAt.toMillis ? updatedAt.toMillis() : new Date(updatedAt).getTime());
  if (ms < 2 * 60000) return 'just now';
  if (ms < 60 * 60000) return `${Math.round(ms / 60000)} min ago`;
  return `${Math.round(ms / 3600000)} hr ago`;
}
