/**
 * Opening hours (OpenStreetMap opening_hours subset)
 * ------------------------------------------------------------
 * Carried over from RaiderLoop with one real bug fixed: rules can be
 * separated by ';' OR ',' (the Library's real hours are
 * "Mo-Sa 06:00-02:00, Su 10:00-02:00; PH off"), and the old
 * isOpenNow only split on ';', so the Library always read "unknown".
 * Both functions now share one rule splitter.
 */

const OH_DAYS = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 };
export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const OH_CODES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const RULE_RE = /^(?:([A-Za-z]{2}(?:[-,][A-Za-z]{2})*)\s+)?(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/;

/* Split on ';', or on a ',' that follows a completed time range —
   so the comma inside a day list ("Mo,We,Fr 09:00-17:00") is kept. */
function splitRules(spec) {
  return spec.split(/;|(?<=\d{1,2}:\d{2})\s*,/).map((r) => r.trim()).filter(Boolean);
}

function ohMinutes(hhmm) {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

function ohDaySet(token) {
  const days = new Set();
  for (const part of token.split(',')) {
    const range = part.match(/^([A-Za-z]{2})-([A-Za-z]{2})$/);
    if (range) {
      const a = OH_DAYS[range[1]]; const b = OH_DAYS[range[2]];
      if (a === undefined || b === undefined) return null;
      for (let i = 0; i < 7; i++) { const d = (a + i) % 7; days.add(d); if (d === b) break; }
    } else if (OH_DAYS[part] !== undefined) days.add(OH_DAYS[part]);
    else return null;
  }
  return days;
}

/** true | false | null (unknown / unparseable — never guess) */
export function isOpenNow(spec, now = new Date()) {
  if (!spec) return null;
  const s = spec.trim();
  if (/^24\/7$/i.test(s)) return true;
  const dow = (now.getDay() + 6) % 7;
  const mins = now.getHours() * 60 + now.getMinutes();
  let parsedAny = false;
  for (const r of splitRules(s)) {
    if (/^PH\b/.test(r) || /off|closed/i.test(r)) continue;
    const m = r.match(RULE_RE);
    if (!m) return null;
    const days = m[1] ? ohDaySet(m[1]) : null;
    if (m[1] && !days) return null;
    const open = ohMinutes(m[2]); let close = ohMinutes(m[3]);
    if (open === null || close === null) return null;
    parsedAny = true;
    const overnight = close <= open;
    if (overnight) close += 24 * 60;
    const applies = (d) => !days || days.has(d);
    if (applies(dow) && mins >= open && mins < close) return true;
    if (overnight) {
      const prev = (dow + 6) % 7;
      if (applies(prev) && mins + 1440 >= open && mins + 1440 < close) return true;
    }
  }
  return parsedAny ? false : null;
}

/** Minutes until the current open span closes, or null. */
export function minutesUntilClose(spec, now = new Date()) {
  if (!spec || isOpenNow(spec, now) !== true) return null;
  for (let step = 15; step <= 24 * 60; step += 15) {
    const t = new Date(now.getTime() + step * 60000);
    if (isOpenNow(spec, t) === false) return step;
  }
  return null;
}

export function fmt12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === 24 || (h === 0 && m === 0)) return 'Midnight';
  const suffix = h >= 12 ? 'pm' : 'am';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr}${suffix}` : `${hr}:${String(m).padStart(2, '0')}${suffix}`;
}

export function hoursByDay(spec) {
  const todayIdx = (new Date().getDay() + 6) % 7;
  const perDay = Array(7).fill(null);
  if (!spec) return DAY_LABELS.map((day, i) => ({ day, text: 'Hours vary', isToday: i === todayIdx }));
  for (const r of splitRules(spec)) {
    const m = r.match(RULE_RE);
    if (!m) continue;
    const text = `${fmt12(m[2])} – ${fmt12(m[3])}`;
    if (!m[1]) { for (let i = 0; i < 7; i++) perDay[i] = text; continue; }
    for (const part of m[1].split(',')) {
      const range = part.split('-');
      const a = OH_CODES.indexOf(range[0]);
      if (a < 0) continue;
      if (range.length === 1) { perDay[a] = text; continue; }
      const b = OH_CODES.indexOf(range[1]);
      if (b < 0) continue;
      for (let i = a; ; i = (i + 1) % 7) { perDay[i] = text; if (i === b) break; }
    }
  }
  return DAY_LABELS.map((day, i) => ({ day, text: perDay[i] || 'Closed', isToday: i === todayIdx }));
}

export function todayHoursText(spec) {
  const row = hoursByDay(spec).find((r) => r.isToday);
  return row ? row.text : '';
}
