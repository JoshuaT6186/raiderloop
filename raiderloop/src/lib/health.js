/**
 * Apple Health, read-only and on the phone. Flyer asks for three
 * things (sleep, steps, exercise minutes), shows them next to your
 * class schedule, and never saves or sends them anywhere: no server,
 * no ads, no analytics (App Store Guideline 5.1.3).
 */
import { HealthKit } from './native';

export const HEALTH_READ = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierAppleExerciseTime',
];
const ASLEEP = new Set([1, 3, 4, 5]); // asleep (unspecified), core, deep, REM

export function healthAvailable() {
  try { return !!(HealthKit && HealthKit.isHealthDataAvailable && HealthKit.isHealthDataAvailable()); } catch (e) { return false; }
}

export async function connectHealth() {
  if (!healthAvailable()) return false;
  try { await HealthKit.requestAuthorization({ toRead: HEALTH_READ }); return true; } catch (e) { return false; }
}

/** Total minutes covered by a set of [start, end] intervals (overlaps merged). */
export function unionMinutes(intervals) {
  const list = intervals.map(([a, b]) => [new Date(a).getTime(), new Date(b).getTime()]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0; let cur = null;
  for (const [a, b] of list) {
    if (!cur) { cur = [a, b]; continue; }
    if (a <= cur[1]) cur[1] = Math.max(cur[1], b);
    else { total += cur[1] - cur[0]; cur = [a, b]; }
  }
  if (cur) total += cur[1] - cur[0];
  return Math.round(total / 60000);
}

async function sumToday(id, unit) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  try {
    const r = await HealthKit.queryStatisticsForQuantity(id, ['cumulativeSum'], { filter: { date: { startDate: start, endDate: new Date() } }, unit });
    return r && r.sumQuantity ? Math.round(r.sumQuantity.quantity) : 0;
  } catch (e) { return null; }
}

/** Last night's sleep plus today's steps and exercise minutes. */
export async function readToday() {
  if (!healthAvailable()) return null;
  const from = new Date(); from.setDate(from.getDate() - 1); from.setHours(18, 0, 0, 0);
  const to = new Date(); to.setHours(12, 0, 0, 0);
  let sleepMinutes = null;
  try {
    const samples = await HealthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 0, filter: { date: { startDate: from, endDate: to } } });
    const asleep = (samples || []).filter((s) => ASLEEP.has(Number(s.value))).map((s) => [s.startDate, s.endDate]);
    sleepMinutes = asleep.length ? unionMinutes(asleep) : null;
  } catch (e) { sleepMinutes = null; }
  const [steps, exercise] = await Promise.all([sumToday('HKQuantityTypeIdentifierStepCount', 'count'), sumToday('HKQuantityTypeIdentifierAppleExerciseTime', 'min')]);
  return { sleepMinutes, steps, exercise };
}

export const hm = (mins) => (mins == null ? '—' : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`);
