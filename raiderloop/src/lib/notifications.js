/**
 * Local notifications — no server involved.
 * ------------------------------------------------------------
 * Schedules, for the next 7 days:
 *   • class reminders N minutes before each class, with a weather
 *     heads-up when the forecast at class time calls for one
 *   • assignment reminders N hours before each due date
 *   • saved-event reminders 30 minutes before (when the event has a
 *     real date and time)
 * Always clears Flyer's previously scheduled notifications first, so
 * editing a class never leaves a stale reminder behind. iOS caps
 * pending local notifications at 64, so the list is trimmed to the
 * soonest 60.
 */
import { useEffect } from 'react';
import { Notifications } from './native';
import { toMinutes, todayCode, DAY_TO_JS } from './time';
import { fetchWeather, forecastAt, weatherNote } from './hooks';

export async function ensureNotificationPermission(ask = true) {
  if (!Notifications) return false;
  const perm = await Notifications.getPermissionsAsync();
  if (perm.granted) return true;
  if (!ask || !perm.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}

function nextOccurrences(item, days = 7) {
  const out = [];
  const mins = toMinutes(item.time);
  if (mins == null) return out;
  const base = new Date(); base.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    const code = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'][d.getDay()];
    if (item.oneOff && i > 0) break;
    if (item.days && !item.days.includes(code)) continue;
    if (item.oneOff && !(item.days || []).includes(todayCode())) continue;
    const at = new Date(d); at.setMinutes(mins);
    out.push(at);
  }
  return out;
}

export async function rescheduleAll({ scheduleItems, assignments, savedEvents, notif, schoolId }) {
  if (!Notifications) return;
  const ok = await ensureNotificationPermission(false);
  if (!ok) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const queue = [];

  let hourly = null;
  if (notif.weather) { try { hourly = (await fetchWeather(schoolId)).hourly; } catch (e) { hourly = null; } }

  if (notif.classes) {
    for (const item of scheduleItems) {
      for (const start of nextOccurrences(item)) {
        const fire = new Date(start.getTime() - (notif.leadMinutes || 15) * 60000);
        if (fire.getTime() <= now) continue;
        const wx = notif.weather && hourly ? weatherNote(forecastAt(hourly, start)) : null;
        queue.push({
          at: fire,
          title: `${item.title} in ${notif.leadMinutes || 15} min`,
          body: [item.place, wx].filter(Boolean).join(' · ') || 'Time to head over.',
        });
      }
    }
  }

  if (notif.assignments) {
    for (const a of assignments) {
      if (a.done || !a.due) continue;
      const due = new Date(a.due).getTime();
      const fire = due - (notif.assignmentLeadHours || 24) * 3600000;
      if (fire > now) queue.push({ at: new Date(fire), title: `Due ${notif.assignmentLeadHours >= 24 ? 'tomorrow' : 'soon'}: ${a.title}`, body: a.course || 'Assignment' });
      const lastCall = due - 2 * 3600000;
      if (lastCall > now && (notif.assignmentLeadHours || 24) > 2) queue.push({ at: new Date(lastCall), title: `2 hours left: ${a.title}`, body: a.course || 'Assignment' });
    }
  }

  if (notif.saved) {
    for (const ev of savedEvents) {
      if (!ev.startsAt) continue;
      const fire = new Date(ev.startsAt).getTime() - 30 * 60000;
      if (fire > now) queue.push({ at: new Date(fire), title: `${ev.title} starts in 30 min`, body: ev.location || '' });
    }
  }

  queue.sort((a, b) => a.at - b.at);
  for (const n of queue.slice(0, 60)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body },
      trigger: { type: 'date', date: n.at },
    }).catch(() => {});
  }
}

export function useNotificationScheduler(app) {
  const { hydrated, onboarded, scheduleItems, assignments, savedEvents, notif, schoolId } = app;
  useEffect(() => {
    if (!hydrated || !onboarded) return;
    const id = setTimeout(() => { rescheduleAll({ scheduleItems, assignments, savedEvents, notif, schoolId }).catch(() => {}); }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, onboarded, JSON.stringify(scheduleItems), JSON.stringify(assignments), JSON.stringify(savedEvents.map((e) => e.id)), JSON.stringify(notif)]);
}

export { DAY_TO_JS };
