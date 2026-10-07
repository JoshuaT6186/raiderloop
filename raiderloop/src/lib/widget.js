/**
 * Feeds the iOS home-screen widget (targets/widget). The app writes
 * a tiny JSON snapshot into the shared App Group; the widget reads it.
 * Only what the widget shows is shared: next class, its place and
 * time, today's count, and the weather line.
 */
import { useEffect } from 'react';
import { AppleTargets } from './native';
import { WIDGET_APP_GROUP } from '../config';
import { itemsOnDay, todayCode, toMinutes, sortByTime } from './time';

export function useWidgetSync({ scheduleItems, assignments, weather }) {
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
        next: next ? { title: next.title, place: next.place || '', time: next.time, endTime: next.endTime || '' } : null,
        todayCount: today.length,
        due: due ? { title: due.title, due: due.due } : null,
        weather: weather && !weather.loading && !weather.error ? `${weather.temp}° ${weather.condition}` : '',
      }));
      AppleTargets.ExtensionStorage.reloadWidget();
    } catch (e) { /* widget not installed in this build */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(scheduleItems), JSON.stringify(assignments), weather?.temp]);
}
