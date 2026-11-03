/**
 * Room finder: turns "HOLDEN 00104", "Holden Hall 104" or "MATH 012"
 * into a building on the map, a room, and a floor.
 *
 * Building codes: the five verified on TTU IT Help Central's
 * General Purpose Classrooms page (AGRI, HUMSCI, HOLDEN, MATH,
 * SCIENCE) are matched exactly. Anything else is matched against
 * building names, and if Flyer still can't tell, you pick the building
 * once and Flyer remembers that code on this phone.
 *
 * Floors: most campus rooms start with their floor number (104 is on
 * floor 1, 215 on floor 2). Rooms that start with 0 or B are on the
 * lower level. Flyer says "probably" because a few buildings break
 * the pattern.
 */
import { BUILDINGS } from '../data/buildings';

export const VERIFIED_CODES = {
  AGRI: 'agricultural-sciences-building',
  HUMSCI: 'human-sciences-building',
  HOLDEN: 'holden-hall',
  MATH: 'mathematics-statistics',
  SCIENCE: 'science-building',
};

const STOP = new Set(['building', 'hall', 'center', 'the', 'of', 'and', 'college', 'complex', 'rm', 'room', 'bldg', 'bld', 'ttu', '&']);
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));

/** Best building match for a code or name, with a 0–1 score. */
export function matchBuilding(text, aliases = {}) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (aliases[upper]) {
    const b = BUILDINGS.find((x) => x.id === aliases[upper]);
    if (b) return { building: b, score: 1, how: 'yours' };
  }
  if (VERIFIED_CODES[upper]) {
    const b = BUILDINGS.find((x) => x.id === VERIFIED_CODES[upper]);
    if (b) return { building: b, score: 1, how: 'code' };
  }
  const want = words(raw);
  if (!want.length) return null;
  let best = null;
  for (const b of BUILDINGS) {
    const name = words(b.name);
    const short = (b.short || '').toLowerCase();
    let score = 0;
    if (short && want.includes(short)) score = 0.95;
    // Every typed word must start a word in the building name.
    const hits = want.filter((w) => name.some((n) => n.startsWith(w) || (w.length >= 4 && w.startsWith(n))));
    if (hits.length === want.length) score = Math.max(score, 0.55 + 0.4 * (hits.length / Math.max(name.length, 1)));
    // A squashed code like ENGCTR or ENGLPHIL: initial letters of name words.
    if (!score && upper.length >= 4) {
      const initials = name.map((n) => n.slice(0, 3)).join('').toUpperCase();
      if (initials.startsWith(upper.slice(0, 6))) score = 0.5;
    }
    if (score && (!best || score > best.score || (score === best.score && b.name.length < best.building.name.length))) best = { building: b, score, how: 'name' };
  }
  return best;
}

/** Floor from a room number: "104" → 1, "012" → 0 (lower level). */
export function floorOf(room) {
  const r = String(room || '').toUpperCase().trim();
  if (!r) return null;
  if (/^B/.test(r)) return 0;
  const digits = (r.match(/\d+/) || [''])[0];
  if (!digits) return null;
  if (digits.length >= 3 && digits[0] === '0') return 0;
  return Number(digits[0]);
}
export function floorLabel(f) {
  if (f == null) return '';
  if (f === 0) return 'Lower level';
  return `Floor ${f}`;
}

/** "HOLDEN 00104" → { buildingText: 'HOLDEN', room: '104' } */
export function splitRoom(text) {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  if (!s) return { buildingText: '', room: '' };
  // "Room 104 Holden" / "Rm 104, Holden Hall"
  let m = s.match(/^(?:rm\.?|room)\s*([A-Z]?\d{1,5}[A-Z]?)\b[ ,]*(.*)$/i);
  if (m) return { buildingText: m[2], room: m[1] };
  // "Holden Hall 104" / "HOLDEN 00104" / "ENGCTR 102A" / "Holden Hall, Rm 104"
  m = s.match(/^(.*?)[ ,]*(?:rm\.?|room)?\s*([A-Z]?\d{1,5}[A-Z]?)$/i);
  if (m && m[1]) return { buildingText: m[1], room: m[2] };
  return { buildingText: s, room: '' };
}

const unpad = (room) => {
  const r = String(room || '').toUpperCase();
  // Banner-style padding: 00104 → 104, 00012 → 012
  if (/^00\d{3}[A-Z]?$/.test(r)) return r.slice(2);
  return r;
};

/** Everything the room finder shows for one typed place. */
export function findRoom(text, aliases = {}) {
  const { buildingText, room: rawRoom } = splitRoom(text);
  const room = unpad(rawRoom);
  const match = matchBuilding(buildingText, aliases);
  const floor = floorOf(room);
  return {
    query: String(text || '').trim(),
    code: buildingText.toUpperCase().replace(/[^A-Z0-9]/g, ''),
    buildingText,
    building: match ? match.building : null,
    confidence: match ? match.score : 0,
    how: match ? match.how : null,
    room,
    floor,
    floorText: floorLabel(floor),
  };
}

/** The room part of a class's place, for chips like "Rm 104". */
export function roomLabel(place) {
  const { room } = splitRoom(place);
  return room ? `Rm ${unpad(room)}` : '';
}
