/**
 * Feeds the iOS home-screen widget (targets/widget). The app writes
 * a tiny JSON snapshot into the shared App Group; the widget reads it.
 * Only what the widget shows is shared: next class, its place and
 * time, today's count, and the weather line.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { AppleTargets } from './native';
import { WIDGET_APP_GROUP } from '../config';
import { itemsOnDay, todayCode, toMinutes, sortByTime, localDay } from './time';

/* Sign-out / delete: the widget shows nothing until the next person sets up. */
export function clearWidget() {
  if (!AppleTargets || !AppleTargets.ExtensionStorage) return;
  try {
    new AppleTargets.ExtensionStorage(WIDGET_APP_GROUP).set('snapshot', JSON.stringify({ updated: new Date().toISOString(), day: localDay(), next: null, todayCount: 0, due: null, weather: '' }));
    AppleTargets.ExtensionStorage.reloadWidget();
  } catch (e) { /* widget not installed in this build */ }
}

export function useWidgetSync({ scheduleItems, assignments, weather }) {
  // Re-write when Flyer comes back, so the widget never shows yesterday.
  const [wake, setWake] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') setWake((w) => w + 1); });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!AppleTargets || !AppleTargets.ExtensionStorage) return;
    try {
      const storage = new AppleTargets.ExtensionStorage(WIDGET_APP_GROUP);
      const now = new Date(); const nowM = now.getHours() * 60 + now.getMinutes();
      const today = sortByTime(itemsOnDay(scheduleItems, todayCode()));
      const next = today.find((c) => (toMinutes(c.endTime) ?? toMinutes(c.time)) >= nowM) || null;
      const due = assignments.filter((a) => !a.done && a.due && new Date(a.due) > now).sort((a, b) => new Date(a.due) - new Date(b.due))[0];
      storage.set('snapshot', JSON.stringify({
        updated: now.toISOString(),
        day: localDay(now), // the widget ignores a snapshot from another day
        next: next ? { title: next.title, place: next.place || '', time: next.time, endTime: next.endTime || '' } : null,
        todayCount: today.length,
        due: due ? { title: due.title, due: due.due } : null,
        weather: weather && !weather.loading && !weather.error ? `${weather.temp}° ${weather.condition}` : '',
      }));
      AppleTargets.ExtensionStorage.reloadWidget();
    } catch (e) { /* widget not installed in this build */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(scheduleItems), JSON.stringify(assignments), weather?.temp, wake]);
}
