/**
 * A small iCalendar (.ics) reader for calendar-feed connections:
 * Canvas's personal calendar feed, a Google or Outlook "secret iCal
 * address", or any class calendar link. Runs on the phone; the feed
 * link never leaves it.
 */

function unfold(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}
function unescapeText(v) {
  return String(v || '').replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\').trim();
}

/** "20261104T235900Z", "20261104T235900" (+TZID), or "20261104". */
export function parseIcsDate(value, params = '') {
  const v = String(value || '').trim();
  let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m || /VALUE=DATE(?!-)/i.test(params)) {
    m = m || v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    // All-day: treat as due at 11:59 PM local that day.
    return { date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 0), allDay: true };
  }
  m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const date = z
    ? new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0)))
    : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0));
  return { date, allDay: false };
}

export function parseIcs(text) {
  const lines = unfold(text).split('\n');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(line)) { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const head = line.slice(0, idx); const value = line.slice(idx + 1);
    const [name, ...paramParts] = head.split(';');
    const params = paramParts.join(';');
    const key = name.toUpperCase();
    if (key === 'SUMMARY') cur.title = unescapeText(value);
    else if (key === 'DESCRIPTION') cur.desc = unescapeText(value).slice(0, 600);
    else if (key === 'LOCATION') cur.location = unescapeText(value);
    else if (key === 'URL') cur.url = value.trim();
    else if (key === 'UID') cur.uid = value.trim();
    else if (key === 'DTSTART') cur.start = parseIcsDate(value, params);
    else if (key === 'DTEND') cur.end = parseIcsDate(value, params);
  }
  return events.filter((e) => e.title && e.start && e.start.date && !Number.isNaN(e.start.date.getTime()));
}

/* Canvas feed titles look like "Essay draft [ENGL-1301-005]". */
const COURSE_IN_TITLE = /\s*\[([A-Z]{2,5})[\s-]?(\d{4})[^\]]*\]\s*$/;

/** Splits a feed into dated to-dos (Planner) and calendar events. */
export function icsToPlanner(text, { now = new Date(), days = 120 } = {}) {
  const until = now.getTime() + days * 86400000;
  const out = { assignments: [], events: [] };
  for (const e of parseIcs(text)) {
    const t = e.start.date.getTime();
    if (t < now.getTime() - 86400000 || t > until) continue;
    const m = e.title.match(COURSE_IN_TITLE);
    const id = `ics-${(e.uid || `${e.title}-${t}`).replace(/[^A-Za-z0-9-]/g, '').slice(0, 60)}`;
    if (m || /assignment|quiz|exam|due/i.test(`${e.title} ${e.desc || ''}`)) {
      out.assignments.push({ id, title: e.title.replace(COURSE_IN_TITLE, '').trim(), course: m ? `${m[1]} ${m[2]}` : '', due: e.start.date.toISOString(), url: e.url || '', source: 'feed' });
    } else {
      out.events.push({ id, title: e.title, startsAt: e.start.date.toISOString(), allDay: e.start.allDay, location: e.location || '', url: e.url || '' });
    }
  }
  out.assignments.sort((a, b) => a.due.localeCompare(b.due));
  out.events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return out;
}
