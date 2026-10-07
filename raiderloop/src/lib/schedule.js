/**
 * Schedule sharing helpers: turn classes into busy blocks (no names
 * or rooms), and find times when a group is free.
 */
import { toMinutes, minutesToLabel } from './time';

export const SHARE_DAYS = ['M', 'T', 'W', 'Th', 'F'];

export function busyBlocks(scheduleItems = []) {
  const out = [];
  for (const c of scheduleItems) {
    if (c.oneOff) continue;
    const s = toMinutes(c.time); const e = toMinutes(c.endTime);
    if (s == null || e == null || e <= s) continue;
    for (const d of c.days || []) out.push({ d, s, e });
  }
  return out;
}

export function fullClasses(scheduleItems = []) {
  return scheduleItems.filter((c) => !c.oneOff).map((c) => ({
    title: c.title, days: c.days || [], time: c.time, endTime: c.endTime, place: c.place || '', buildingId: c.buildingId || null,
  }));
}

/* Free windows for everyone in `people` (each a list of busy blocks),
   weekdays 8 AM–8 PM, at least `minLen` minutes long. */
export function freeWindows(people, { start = 480, end = 1200, minLen = 45, days = SHARE_DAYS } = {}) {
  const res = [];
  for (const d of days) {
    const busy = people.flat().filter((b) => b.d === d).map((b) => [Math.max(b.s, start), Math.min(b.e, end)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
    let cur = start;
    for (const [a, b] of busy) {
      if (a - cur >= minLen) res.push({ d, s: cur, e: a });
      cur = Math.max(cur, b);
    }
    if (end - cur >= minLen) res.push({ d, s: cur, e: end });
  }
  return res;
}

/* Grid of 1-hour cells: true when everyone is free that whole hour. */
export function freeGrid(people, { start = 8, end = 20, days = SHARE_DAYS } = {}) {
  const all = people.flat();
  return days.map((d) => ({
    d,
    hours: Array.from({ length: end - start }, (_, i) => {
      const s = (start + i) * 60; const e = s + 60;
      return { h: start + i, free: !all.some((b) => b.d === d && b.s < e && b.e > s) };
    }),
  }));
}

export const windowLabel = (w) => `${minutesToLabel(w.s)}–${minutesToLabel(w.e)}`;

/* Next real date for a weekday code + minutes, in the future. */
export function nextDateFor(dayCode, mins, now = new Date()) {
  const js = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 }[dayCode];
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    const x = new Date(d); x.setDate(d.getDate() + i);
    if (x.getDay() !== js) continue;
    x.setMinutes(mins);
    if (x > now) return x;
  }
  return null;
}
