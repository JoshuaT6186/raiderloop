/**
 * Sleep and walking math for Sleep & steps, the bedtime nudge, and Home.
 */
import { itemsOnDay, sortByTime, toMinutes, minutesToLabel } from './time';
import { buildingById, distanceM } from '../data/campus';

const CODES = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];

/** Tomorrow's first class and a gentle "asleep by" time (8 hours + 45 min to get ready). */
export function bedtimeFor(scheduleItems, now = new Date()) {
  const tmr = new Date(now); tmr.setDate(tmr.getDate() + 1);
  const first = sortByTime(itemsOnDay(scheduleItems.filter((c) => !c.oneOff), CODES[tmr.getDay()]))[0];
  if (!first) return null;
  const start = toMinutes(first.time);
  if (start == null) return null;
  const asleepBy = (start - 8 * 60 - 45 + 24 * 60) % (24 * 60);
  return { cls: first, startLabel: first.time, asleepBy, asleepLabel: minutesToLabel(asleepBy) };
}

/** About how many minutes you walk between today's classes. */
export function walkingToday(scheduleItems, now = new Date()) {
  const today = sortByTime(itemsOnDay(scheduleItems, CODES[now.getDay()])).map((c) => buildingById(c.buildingId)).filter(Boolean);
  let m = 0;
  for (let i = 1; i < today.length; i++) { const d = distanceM(today[i - 1], today[i]); if (d) m += d; }
  return Math.round(m / 80);
}

