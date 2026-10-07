/* Time + schedule helpers shared across screens. */

export const WEEK_DAYS = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];
export const WEEK_DAY_LABELS = { M: 'Mon', T: 'Tue', W: 'Wed', Th: 'Thu', F: 'Fri', Sa: 'Sat', Su: 'Sun' };
export const WEEK_DAY_FULL = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', Th: 'Thursday', F: 'Friday', Sa: 'Saturday', Su: 'Sunday' };
// JS getDay() index (0=Sun) for each code
export const DAY_TO_JS = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };

export function todayCode(d = new Date()) {
  return ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'][d.getDay()];
}

export function itemsOnDay(items, code) {
  return items.filter((i) => !i.days || i.days.includes(code));
}

/** "9:00 AM" → minutes since midnight, or null */
export function toMinutes(t) {
  if (!t) return null;
  const m = String(t).match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (/pm/i.test(m[3]) && h !== 12) h += 12;
  if (/am/i.test(m[3]) && h === 12) h = 0;
  return h * 60 + min;
}

export function minutesToLabel(mins) {
  const h = Math.floor(mins / 60) % 24; const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function overlaps(aS, aE, bS, bE) {
  const v = [aS, aE, bS, bE].map(toMinutes);
  if (v.some((x) => x === null)) return false;
  return v[0] < v[3] && v[2] < v[1];
}

export function sortByTime(items) {
  return [...items].sort((a, b) => (toMinutes(a.time) ?? 0) - (toMinutes(b.time) ?? 0));
}

/** Joins non-empty parts with a middle dot — no "· ·" gaps. */
export function metaLine(...parts) {
  return parts.filter((p) => p != null && String(p).trim() !== '').join(' · ');
}

export function dateAt(base, mins) {
  const d = new Date(base); d.setHours(0, 0, 0, 0); d.setMinutes(mins); return d;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function relDayLabel(date, now = new Date()) {
  const a = new Date(date); a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function dueLabel(iso, now = new Date()) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const ms = d - now;
  if (ms < 0) return `Was due ${relDayLabel(d, now).toLowerCase()} · ${time}`;
  if (ms < 3600000) return `Due in ${Math.max(1, Math.round(ms / 60000))} min`;
  return `${relDayLabel(d, now)} · ${time}`;
}

export function daysUntil(isoDate, now = new Date()) {
  const a = new Date(`${isoDate}T00:00:00`); const b = new Date(now); b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
