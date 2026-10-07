/**
 * Nearby-friend alerts — the only Flyer feature that uses location in
 * the background, and only after you turn it on.
 * ------------------------------------------------------------
 *  • Mutual: you're alerted about a friend only if you picked them
 *    AND they picked you.
 *  • Nobody sees anyone's location. The server compares two coarse
 *    positions (~110 m rounding) and sends "Maya is nearby".
 *  • Campus only: off campus, your last position is erased.
 *  • Quiet hours 11 PM–7 AM, and at most one alert per pair every
 *    3 hours.
 *  • iOS shows its own location arrow while this is on, and you can
 *    turn it off here or in Settings at any time.
 * The task below must be defined when the app starts (App.js imports
 * this file), because iOS can wake the app just to run it.
 */
import { Platform } from 'react-native';
import { TaskManager, Location } from './native';
import { api } from './firebase';

export const NEARBY_TASK = 'flyer-nearby-alerts';

if (TaskManager && Location && Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(NEARBY_TASK, async ({ data, error }) => {
      if (error || !data || !data.locations || !data.locations.length) return;
      const loc = data.locations[data.locations.length - 1];
      try { await api.nearbyPing({ lat: loc.coords.latitude, lng: loc.coords.longitude }); } catch (e) { /* offline — next update will try again */ }
    });
  } catch (e) { /* already defined (fast refresh) */ }
}

export const nearbyAvailable = () => !!(TaskManager && Location && Platform.OS !== 'web');

export async function nearbyRunning() {
  if (!nearbyAvailable()) return false;
  return Location.hasStartedLocationUpdatesAsync(NEARBY_TASK).catch(() => false);
}

/* Returns { ok, message }. Asks for "While Using", then "Always". */
export async function startNearby() {
  if (!nearbyAvailable()) return { ok: false, message: 'Nearby alerts need the full app build.' };
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { ok: false, message: 'Location is off for Flyer — turn it on in Settings first.' };
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return { ok: false, message: 'Nearby alerts need location set to "Always" for Flyer (Settings → Flyer → Location). Everything else works without it.' };
  await Location.startLocationUpdatesAsync(NEARBY_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 150,
    deferredUpdatesDistance: 150,
    deferredUpdatesInterval: 5 * 60000,
    pausesUpdatesAutomatically: true,
    activityType: Location.ActivityType?.Other,
    showsBackgroundLocationIndicator: true,
    foregroundService: { notificationTitle: 'Flyer nearby alerts are on', notificationBody: 'Turn them off any time in Friends → Sharing.' },
  });
  return { ok: true };
}

export async function stopNearby() {
  if (await nearbyRunning()) await Location.stopLocationUpdatesAsync(NEARBY_TASK).catch(() => {});
}
