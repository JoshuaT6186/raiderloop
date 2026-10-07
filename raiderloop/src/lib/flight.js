/**
 * Check-ins. One location reading, taken right now while the app is
 * open, is sent with the check-in; the server decides if you're close
 * enough and how many points it's worth. Nothing is tracked.
 */
import { Location } from './native';
import { api, errText } from './firebase';
import { getForegroundPermission } from './location';
import { classBuildingIds } from '../data/places';

export async function freshFix() {
  if (!Location) throw new Error('Location needs the full app build.');
  if (!(await getForegroundPermission(true))) throw new Error('Turn on location for Flyer in Settings to check in.');
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy || 50 };
}

export async function checkInAt({ placeId, eventId, scheduleItems }) {
  try {
    const fix = await freshFix();
    const res = await api.checkIn({ placeId: placeId || null, eventId: eventId || null, ...fix, classBuildingIds: classBuildingIds(scheduleItems) });
    return { ok: true, ...res.data };
  } catch (e) {
    return { ok: false, message: errText(e, "Couldn't check in — try again.") };
  }
}

export async function meetupCheckIn(id) {
  try {
    const fix = await freshFix();
    const res = await api.meetupCheckIn({ id, ...fix });
    return { ok: true, ...res.data };
  } catch (e) {
    return { ok: false, message: errText(e, "Couldn't check in — try again.") };
  }
}
