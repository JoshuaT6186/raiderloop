/**
 * One-tap export to Apple / Google Calendar (via the device calendar).
 * Each class becomes a weekly recurring event per meeting day, ending
 * on the last day of classes for the current term. Re-exporting
 * replaces what Flyer added before, using a dedicated "Flyer"
 * calendar so nothing in the student's own calendars is touched.
 */
import { Platform } from 'react-native';
import { Calendar } from './native';
import { toMinutes, DAY_TO_JS } from './time';
import { TERM } from '../config';

const CAL_TITLE = 'Flyer';

async function getFlyerCalendarId() {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = cals.find((c) => c.title === CAL_TITLE && c.allowsModifications);
  if (existing) return existing.id;
  let source;
  if (Platform.OS === 'ios') {
    const def = await Calendar.getDefaultCalendarAsync();
    source = def.source;
  } else {
    source = { isLocalAccount: true, name: CAL_TITLE, type: Calendar.SourceType?.LOCAL || 'LOCAL' };
  }
  return Calendar.createCalendarAsync({
    title: CAL_TITLE, color: '#2F5DA8', entityType: Calendar.EntityTypes.EVENT,
    sourceId: source?.id, source, name: 'flyer', ownerAccount: 'personal', accessLevel: Calendar.CalendarAccessLevel?.OWNER,
  });
}

function firstDateOnOrAfter(start, jsDay) {
  const d = new Date(start); d.setHours(0, 0, 0, 0);
  while (d.getDay() !== jsDay) d.setDate(d.getDate() + 1);
  return d;
}

export async function exportToCalendar({ scheduleItems, assignments }) {
  if (!Calendar) throw new Error("Calendar export isn't available in this build.");
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') throw new Error('Calendar permission was denied. You can turn it on in Settings.');

  const calId = await getFlyerCalendarId();
  // Clear previous Flyer exports in the term window.
  const from = new Date(); from.setMonth(from.getMonth() - 6);
  const to = new Date(`${TERM.finalsEnd}T23:59:00`); to.setMonth(to.getMonth() + 1);
  const old = await Calendar.getEventsAsync([calId], from, to).catch(() => []);
  for (const e of old) await Calendar.deleteEventAsync(e.id, { futureEvents: true }).catch(() => {});

  const termStart = new Date(Math.max(Date.now(), new Date(`${TERM.firstDay}T00:00:00`).getTime()));
  const termEnd = new Date(`${TERM.lastDay}T23:59:00`);
  let count = 0;

  for (const c of scheduleItems.filter((i) => !i.oneOff)) {
    const sm = toMinutes(c.time); const em = toMinutes(c.endTime) ?? (sm != null ? sm + 50 : null);
    if (sm == null) continue;
    for (const code of c.days || []) {
      const day = firstDateOnOrAfter(termStart, DAY_TO_JS[code]);
      if (day > termEnd) continue;
      const startDate = new Date(day); startDate.setMinutes(sm);
      const endDate = new Date(day); endDate.setMinutes(em);
      await Calendar.createEventAsync(calId, {
        title: c.title, location: c.place || '', startDate, endDate, timeZone: 'America/Chicago',
        notes: 'Added by Flyer', alarms: [{ relativeOffset: -15 }],
        recurrenceRule: { frequency: Calendar.Frequency.WEEKLY, endDate: termEnd },
      });
      count++;
    }
  }

  for (const a of assignments.filter((x) => !x.done && x.due && new Date(x.due) > new Date())) {
    const end = new Date(a.due); const start = new Date(end.getTime() - 30 * 60000);
    await Calendar.createEventAsync(calId, {
      title: `Due: ${a.title}`, startDate: start, endDate: end, notes: [a.course, 'Added by Flyer'].filter(Boolean).join('\n'),
      alarms: [{ relativeOffset: -24 * 60 }],
    });
    count++;
  }
  return count;
}
