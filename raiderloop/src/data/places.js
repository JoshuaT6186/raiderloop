/**
 * Check-in places and flight-score rules — the same JSON files the
 * server uses (functions/src/shared), so the app never promises
 * points the server won't give.
 */
import PLACES_FILE from '../../functions/src/shared/places.json';
import RULES from '../../functions/src/shared/flight.json';

export const FLIGHT = RULES;
export const PLACES = [...PLACES_FILE.places, ...(PLACES_FILE.extra || [])];
export const placeById = (id) => PLACES.find((p) => p.id === id) || null;
export const isCheckInPlace = (id) => !!placeById(id);
export const tierLabel = (tier) => RULES.tierLabels[tier] || 'Spot';
export const tierPoints = (tier) => RULES.points[tier] || 0;

export function levelFor(score = 0) {
  let lvl = RULES.levels[0];
  for (const l of RULES.levels) if (score >= l.min) lvl = l;
  const next = RULES.levels.find((l) => l.min > score) || null;
  const progress = next ? (score - lvl.min) / (next.min - lvl.min) : 1;
  return { title: lvl.title, min: lvl.min, next, toNext: next ? next.min - score : 0, progress: Math.max(0, Math.min(1, progress)) };
}

/* Buildings you have class in earn no points (they're your routine). */
export const classBuildingIds = (scheduleItems = []) => [...new Set(scheduleItems.filter((c) => !c.oneOff && c.buildingId).map((c) => c.buildingId))];

export const STAMP_COLORS = { game: '#C8413B', event: '#B7791F', rec: '#2F5DA8', spot: '#2E8256', dining: '#8A4FBF' };
