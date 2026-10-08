/**
 * Nearby-friend alerts.
 * ------------------------------------------------------------
 *  • Mutual: you're alerted about a friend only if you picked them
 *    AND they picked you.
 *  • Nobody sees anyone's location. The server compares two coarse
 *    positions (~110 m rounding) and sends "Maya is nearby".
 *  • Campus only: off campus, your last position is erased.
 *  • Quiet hours 11 PM–7 AM, and at most one alert per pair every
 *    3 hours.
 * The background work itself lives in backgroundLocation.js, shared
 * with automatic check-ins so only one location task ever runs.
 */
import { backgroundAvailable, requestAlways, stopAllBackground } from './backgroundLocation';

export const nearbyAvailable = backgroundAvailable;

/* Asks for "Always" location. The Shell then starts the shared task
   once nearby.on is saved. Returns { ok, message }. */
export async function startNearby() {
  if (!backgroundAvailable()) return { ok: false, message: 'Nearby alerts need the full app build.' };
  const r = await requestAlways();
  if (!r.ok) return { ok: false, message: r.message.startsWith('Set Flyer') ? 'Nearby alerts need location set to "Always" for Flyer (Settings → Flyer → Location).' : r.message };
  return { ok: true };
}

/* Used on sign-out and account deletion: stops all background location. */
export async function stopNearby() {
  await stopAllBackground();
}
