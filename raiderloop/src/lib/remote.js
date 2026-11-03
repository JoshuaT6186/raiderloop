/**
 * Remote switches
 * ------------------------------------------------------------
 * One Firestore doc, config/app, lets you turn features on or off
 * and move seasonal theme dates without shipping a new build. The
 * app always starts from DEFAULT_FLAGS below, so if the doc is
 * missing or unreachable nothing breaks; the doc only overrides.
 *
 * Example doc (Firestore console → config → app):
 *   {
 *     flags: { deals: true, jobs: true },
 *     seasons: [
 *       { id: "fall", start: "11-01", end: "11-30" },
 *       { id: "winter", disabled: true }
 *     ]
 *   }
 *
 * Firebase's Remote Config SDK needs browser storage that React
 * Native doesn't have, so a plain Firestore doc is the reliable way.
 */
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

/* Features that ship in this update are on by default. Ones that are
   still being built stay off until you flip them in config/app. */
export const DEFAULT_FLAGS = {
  hub: true, // Campus → Hub
  jobs: true,
  money: true,
  forms: true,
  health: true,
  tools: true,
  deals: true,
  courses: true,
  seasons: true,
};

export function listenRemoteConfig(cb) {
  return onSnapshot(
    doc(db, 'config', 'app'),
    (s) => cb(s.exists() ? s.data() || {} : {}),
    () => cb({}),
  );
}

/* Only known keys with boolean values are accepted, so a typo in the
   console can't switch on something that doesn't exist. */
export function mergeFlags(remote) {
  const out = { ...DEFAULT_FLAGS };
  const r = remote && typeof remote.flags === 'object' ? remote.flags : {};
  for (const k of Object.keys(r)) if (typeof r[k] === 'boolean') out[k] = r[k];
  return out;
}
