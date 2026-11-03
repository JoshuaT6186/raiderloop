/**
 * Feeds the iOS home-screen widget (targets/widget). The app writes
 * a tiny JSON snapshot into the shared App Group; the widget reads it.
 * Only what the widget shows is shared: next class, its place and
 * time, when to leave for it, today's count, the next due date, and
 * the weather line. The lock screen widgets read the same snapshot.
 */
import { useEffect, useState } from 'react';
import { AppleTargets } from './native';
import { WIDGET_APP_GROUP, SHARE } from '../config';
import { itemsOnDay, todayCode, toMinutes, sortByTime, dateAt, minutesToLabel } from './time';
import { nextLeave } from './leave';

export function useWidgetSync({ scheduleItems, assignments, weather, savedEvents = [] }) {
  /* Refresh every 15 minutes while the app is open so "next" moves on. */
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((x) => x + 1), 15 * 60000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!AppleTargets || !AppleTargets.ExtensionStorage) return;
    try {
      const storage = new AppleTargets.ExtensionStorage(WIDGET_APP_GROUP);
      const now = new Date(); const nowM = now.getHours() * 60 + now.getMinutes();
      const today = sortByTime(itemsOnDay(scheduleItems, todayCode()));
      const next = today.find((c) => (toMinutes(c.endTime) ?? toMinutes(c.time)) >= nowM) || null;
      const lv = nextLeave(scheduleItems, { now });
      const leaveAt = lv && next && lv.cls.id === next.id && lv.leave != null ? dateAt(now, lv.leave).toISOString() : null;
      const startAt = next && toMinutes(next.time) != null ? dateAt(now, toMinutes(next.time)).toISOString() : null;
      const due = assignments.filter((a) => !a.done && a.due && new Date(a.due) > now).sort((a, b) => new Date(a.due) - new Date(b.due))[0];
      storage.set('snapshot', JSON.stringify({
        updated: now.toISOString(),
        next: next ? { title: next.title, place: next.place || '', time: next.time, endTime: next.endTime || '', startAt, leaveAt, walk: lv && lv.cls.id === next.id ? lv.walk : null } : null,
        todayCount: today.length,
        due: due ? { title: due.title, due: due.due } : null,
        weather: weather && !weather.loading && !weather.error ? `${weather.temp}° ${weather.condition}` : '',
      }));
      /* For the Flyer drawer in Messages: events you saved, and today's
         free gaps as ready-made poll options. */
      const gaps = [];
      for (let i = 1; i < today.length; i++) {
        const a = toMinutes(today[i - 1].endTime); const b = toMinutes(today[i].time);
        if (a != null && b != null && b - a >= 60 && b > nowM) gaps.push(`Today ${minutesToLabel(Math.max(a, nowM + 15 - ((nowM + 15) % 15)))}`);
      }
      const lastEnd = today.length ? toMinutes(today[today.length - 1].endTime) : null;
      if (lastEnd != null && lastEnd < 21 * 60) gaps.push(`Today ${minutesToLabel(Math.max(lastEnd + 30, nowM + 30 - ((nowM + 30) % 15)))}`);
      storage.set('imessage', JSON.stringify({
        base: SHARE.base,
        items: savedEvents.filter((e) => !e.startsAt || new Date(e.startsAt) > new Date(now.getTime() - 3 * 3600000)).slice(0, 30).map((e) => ({
          id: String(e.id), title: e.title || 'Event', when: [e.date, e.time].filter(Boolean).join(' '), place: e.location || '', url: e.shareUrl || e.sourceUrl || e.url || '',
        })),
        freeToday: gaps.slice(0, 3),
      }));
      AppleTargets.ExtensionStorage.reloadWidget();
    } catch (e) { /* widget not installed in this build */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(scheduleItems), JSON.stringify(assignments), weather?.temp, tick, JSON.stringify(savedEvents.map((e) => e.id))]);
}
