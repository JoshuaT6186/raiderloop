/**
 * Leave-now times. For each class today, how long the walk is from
 * where you'll be (your last class, or a spot you're standing at) and
 * when to start walking. Straight-line distance with a 1.25x detour
 * factor and 2 minutes of slack, rounded up. Used by the Home card,
 * the lock screen widget, and the leave-now notifications.
 */
import { buildingById, distanceM } from '../data/campus';
import { itemsOnDay, sortByTime, toMinutes, minutesToLabel, todayCode } from './time';

const PACE = 1.35; // m/s
const DETOUR = 1.25;
const SLACK = 2;

export function walkBetween(a, b) {
  const d = distanceM(a, b);
  if (d == null) return null;
  return Math.max(2, Math.ceil((d * DETOUR) / PACE / 60));
}

/**
 * Today's classes with a leave time. `from` is { lat, lng } if you know
 * where the person is right now; otherwise the first class has no walk.
 */
export function leavePlan(scheduleItems, { code = todayCode(), from = null } = {}) {
  const list = sortByTime(itemsOnDay(scheduleItems, code)).filter((c) => toMinutes(c.time) != null);
  return list.map((c, i) => {
    const b = buildingById(c.buildingId);
    const prev = i > 0 ? buildingById(list[i - 1].buildingId) : null;
    const origin = prev || from;
    const walk = b && origin ? walkBetween(origin, b) : null;
    const start = toMinutes(c.time);
    const prevEnd = i > 0 ? toMinutes(list[i - 1].endTime) : null;
    const leave = walk != null ? start - walk - SLACK : null;
    return {
      cls: c,
      building: b,
      fromName: prev ? prev.name : from ? 'where you are' : null,
      start,
      walk,
      leave,
      leaveLabel: leave != null ? minutesToLabel(Math.max(0, leave)) : null,
      // Back-to-back with less time than the walk: worth a heads up.
      tight: walk != null && prevEnd != null && start - prevEnd < walk + SLACK,
    };
  });
}

/** The next thing to leave for (or be in), from right now. */
export function nextLeave(scheduleItems, { now = new Date(), from = null } = {}) {
  const nowM = now.getHours() * 60 + now.getMinutes();
  const plan = leavePlan(scheduleItems, { code: todayCode(now), from });
  return plan.find((p) => (toMinutes(p.cls.endTime) ?? p.start + 50) >= nowM) || null;
}
