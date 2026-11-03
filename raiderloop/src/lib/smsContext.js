/**
 * The short summary Text Flyer is allowed to know: your classes, what's
 * due soon, and your major. Nothing about friends, location, or posts.
 * Only sent while Text Flyer is turned on (Connections → Text Flyer).
 */
import { metaLine } from './time';

export function smsContext({ scheduleItems = [], assignments = [], userMajor = '', userClassYear = '' }) {
  const now = new Date();
  const week = scheduleItems.filter((c) => !c.oneOff);
  const due = assignments
    .filter((a) => !a.done && a.due && new Date(a.due) > now)
    .sort((a, b) => new Date(a.due) - new Date(b.due))
    .slice(0, 10);
  return [
    `Student: ${metaLine(userClassYear, userMajor) || 'not specified'}.`,
    `Weekly classes: ${week.length ? week.map((c) => `${c.title} ${(c.days || []).join('/')} ${c.time}${c.endTime ? `-${c.endTime}` : ''}${c.place ? ` @ ${c.place}` : ''}`).join('; ') : 'none added'}.`,
    `Coming up due: ${due.length ? due.map((a) => `${a.title}${a.course ? ` (${a.course})` : ''} due ${new Date(a.due).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`).join('; ') : 'nothing'}.`,
    `Summary updated ${now.toLocaleString('en-US', { timeZone: 'America/Chicago' })} Central.`,
  ].join('\n').slice(0, 5800);
}
