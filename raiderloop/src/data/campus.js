/**
 * Campus reference data + lookups for Texas Tech (school id "ttu").
 * Every item here was verified against a real source before it was
 * added; sources are noted inline.
 */
import { BUILDINGS } from './buildings';
import { DINING } from './dining';
import { ORGS } from './orgs';
import { isOpenNow } from '../lib/hours';

export { BUILDINGS, DINING, ORGS };

export const buildingById = (id) => BUILDINGS.find((b) => b.id === id);
export const walkLabel = (b) => (b && b.walk ? `${b.walk} min walk` : '');

export const CAT_LABELS = { Worship: 'Faith & Spiritual Life' };
export const catLabel = (c) => CAT_LABELS[c] || c;
export const CAMPUS_CATS = ['All', ...Object.entries(
  BUILDINGS.reduce((acc, b) => { acc[b.kind] = (acc[b.kind] || 0) + 1; return acc; }, {}),
).sort((a, b) => b[1] - a[1]).map(([k]) => k)];

export function placeStatus(b) {
  const open = isOpenNow(b && b.hours);
  if (open === true) return 'Open now';
  if (open === false) return 'Closed';
  return walkLabel(b);
}

export const STUDY = BUILDINGS
  .filter((b) => b.kind === 'Library' || /commons|union/i.test(b.name))
  .sort((a, b) => a.walk - b.walk)
  .slice(0, 6)
  .map((b) => ({ ...b, buildingId: b.id }));

/* ---------- Resources (link out to what TTU already maintains) ---------- */
export const RESOURCES = [
  { id: 'res1', name: 'Math Emporium Tutoring', kind: 'Academic · Free', buildingId: 'holden-hall' },
  { id: 'res2', name: 'Writing Center', kind: 'Academic · Free', buildingId: 'texas-tech-university-library' },
  { id: 'res3', name: 'Student Counseling Center', kind: 'Student Life · By appointment', buildingId: 'student-union' },
  { id: 'res4', name: 'IT Help Central', kind: 'Technology · Walk-in · Printing help', buildingId: 'texas-tech-university-library', url: 'https://www.depts.ttu.edu/ithelpcentral/' },
  { id: 'res5', name: 'Gameday in Raiderland', kind: 'Athletics · Gates, parking & shuttles', url: 'https://texastech.com/sports/2026/7/15/gameday-in-raiderland' },
  { id: 'res6', name: 'Raider Depot', kind: 'Bookstore · Textbooks & merch', url: 'https://www.depts.ttu.edu/bookstore/', buildingId: 'student-union' },
  { id: 'res7', name: 'Football Parking Map', kind: 'Athletics · Lots, ADA & Park & Ride', url: 'https://texastech.com/sports/2026/8/18/football-parking-map' },
  { id: 'res8', name: 'Commuter Parking', kind: 'Parking · Permits & lots', url: 'https://www.depts.ttu.edu/parking/InformationFor/StudentParking/CommuterParking.php' },
  { id: 'res9', name: 'Official Academic Calendar', kind: 'Academics · Deadlines & breaks', url: 'https://www.depts.ttu.edu/officialpublications/calendar/26-27_cal_glance.php' },
];

/* Quick links to systems of record — Flyer never recreates these. */
export const QUICK_LINKS = [
  { id: 'raiderlink', name: 'Raiderlink', note: 'Registration & records', url: 'https://www.raiderlink.ttu.edu' },
  { id: 'canvas', name: 'RaiderCanvas', note: 'Courses & grades', url: 'https://texastech.instructure.com/' },
  { id: 'get', name: 'Transact eAccounts', note: 'Dining & Raider Cash balance', url: 'https://ttu-sp.transactcampus.com/eAccounts' },
  { id: 'depot', name: 'Raider Depot', note: 'Bookstore', url: 'https://www.depts.ttu.edu/bookstore/' },
  { id: 'athletics', name: 'Red Raiders app', note: 'Student tickets & gameday', url: 'https://texastech.com/sports/2021/8/12/gameday-app' },
];

/* ---------- Floor plans ----------
   Only two buildings publish public floor maps students can open
   without a staff login: the Student Union and the Library. Every
   other building gets Flyer's own floor guide (room → floor, the
   entrances students actually use, elevator status), never a link
   to a portal students can't get into. */
export const FLOOR_PLANS = {
  direct: {
    'student-union': { label: 'SUB floor maps', url: 'https://www.depts.ttu.edu/sub/SUBmap.php' },
    'texas-tech-university-library': { label: 'Library floor maps', url: 'https://www.depts.ttu.edu/library/building/checklist/maps.php' },
  },
};
/** The official public floor map for a building, or null. */
export function floorPlanFor(b) {
  if (!b) return null;
  return FLOOR_PLANS.direct[b.id] || null;
}

/* ---------- Commuter parking ----------
   TTU Transportation & Parking Services posts percent-full readings
   for these named commuter lots several times a day (seen on their
   official page, e.g. 08/26/2026: "C1- 100% full, C10- 70% full").
   Live readings come from the getParking function; this list only
   names the lots so the screen has structure while loading. */
export const COMMUTER_LOTS = ['C1', 'C4', 'C10', 'C11', 'C12', 'C14', 'C15', 'C16'];
export const PARKING_LINKS = {
  commuter: 'https://www.depts.ttu.edu/parking/InformationFor/StudentParking/CommuterParking.php',
  map: 'https://www.depts.ttu.edu/parking/Resources/CampusMaps.php',
  updates: 'https://www.facebook.com/TTUparking/',
};

/* ---------- Citibus starter set (verified stop names) ---------- */
export const BUS_STOPS = [
  { id: 'bus-holden', name: 'Holden Hall', buildingId: 'holden-hall', route: 'Red Raider' },
  { id: 'bus-west', name: 'West Hall', buildingId: 'west-hall', route: 'Red Raider' },
  { id: 'bus-library', name: 'TTU Library', buildingId: 'texas-tech-university-library', route: 'Red Raider' },
].map((s) => { const b = buildingById(s.buildingId); return { ...s, lat: b?.lat, lng: b?.lng }; });

/* ---------- Football (verified 2026 schedule) ---------- */
export const FOOTBALL_SCHEDULE = [
  { kickoff: '2026-09-05T18:00:00', opponent: 'Abilene Christian', homeAway: 'home', venue: 'Galaxy Stadium', buildingId: 'jones-att-stadium', result: 'W 33-10' },
  { kickoff: '2026-09-12T18:30:00', opponent: 'Oregon State', homeAway: 'away', venue: 'Reser Stadium', buildingId: null, result: null },
  { kickoff: '2026-09-18T19:00:00', opponent: 'Houston', homeAway: 'home', venue: 'Galaxy Stadium', buildingId: 'jones-att-stadium', result: null },
  { kickoff: '2026-09-26T12:00:00', opponent: 'Sam Houston', homeAway: 'home', venue: 'Galaxy Stadium', buildingId: 'jones-att-stadium', result: null },
  { kickoff: '2026-10-03T12:00:00', opponent: 'Colorado', homeAway: 'away', venue: 'Folsom Field', buildingId: null, result: null },
  { kickoff: '2026-10-17T12:00:00', opponent: 'Arizona State', homeAway: 'home', venue: 'Galaxy Stadium', buildingId: 'jones-att-stadium', result: null },
  { kickoff: '2026-10-24T12:00:00', opponent: 'Cincinnati', homeAway: 'away', venue: 'Nippert Stadium', buildingId: null, result: null },
  { kickoff: '2026-10-31T12:00:00', opponent: 'Arizona', homeAway: 'home', venue: 'Galaxy Stadium', buildingId: 'jones-att-stadium', result: null },
  { kickoff: '2026-11-07T12:00:00', opponent: 'West Virginia', homeAway: 'home', venue: 'Galaxy Stadium', buildingId: 'jones-att-stadium', result: null },
  { kickoff: '2026-11-14T12:00:00', opponent: 'Oklahoma State', homeAway: 'away', venue: 'Boone Pickens Stadium', buildingId: null, result: null },
  { kickoff: '2026-11-21T12:00:00', opponent: 'Baylor', homeAway: 'away', venue: 'McLane Stadium', buildingId: null, result: null },
  { kickoff: '2026-11-26T19:00:00', opponent: 'TCU', homeAway: 'home', venue: 'Galaxy Stadium', buildingId: 'jones-att-stadium', result: null },
];
export const nextGame = (now = new Date()) => FOOTBALL_SCHEDULE.find((g) => new Date(g.kickoff) > now) || null;
export function lastGame(now = new Date()) {
  const played = FOOTBALL_SCHEDULE.filter((g) => new Date(g.kickoff) <= now && g.result);
  return played.length ? played[played.length - 1] : null;
}
export function gameDateLabel(iso, now = new Date()) {
  const d = new Date(iso);
  const days = Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}
/* Is a home game happening right now (kickoff -3h to +4h)? Used to
   offer "Gameday sharing" with friends. */
export function liveHomeGame(now = new Date()) {
  return FOOTBALL_SCHEDULE.find((g) => {
    if (g.homeAway !== 'home') return false;
    const k = new Date(g.kickoff).getTime();
    return now.getTime() > k - 3 * 3600000 && now.getTime() < k + 4 * 3600000;
  }) || null;
}

export const SPORTS_LIST = ['Football', 'Basketball', "Women's Basketball", 'Baseball', 'Softball', 'Soccer', 'Volleyball', 'Track'];

/* ---------- Orgs: categories + Greek life ---------- */
export const ORG_CATEGORIES = [...new Set(ORGS.map((o) => o.tags))].sort();
const GREEK_LETTERS = /\b(Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega)\b/;
/* Many sororities are tagged "General" in the export, so Greek life
   is detected by the org's own name (two+ Greek letters, or an
   explicit fraternity/sorority word), not just the category. Honor
   societies with Greek names are excluded. */
export function isGreek(o) {
  if (o.tags === 'Fraternities & Sororities') return true;
  if (o.tags === 'Honor Societies') return false;
  if (/honor|honour|professional|national society/i.test(o.name + ' ' + (o.reason || ''))) return false;
  const letters = (o.name.match(new RegExp(GREEK_LETTERS.source, 'g')) || []).length;
  return letters >= 2 || /fraternity|sorority/i.test(o.name);
}
export const GREEK_ORGS = ORGS.filter(isGreek);

export const INTERESTS = ['Sports', 'Music', 'Arts', 'Technology', 'Gaming', 'Career', 'Faith', 'Academics', 'Campus Events', 'Greek Life', 'Outdoors', 'Service'];

/* Interest → org category affinity for "For you" picks. */
export const INTEREST_TO_TAGS = {
  Sports: ['Sport Clubs'], Music: ['Arts & Media'], Arts: ['Arts & Media'], Technology: ['STEM & Engineering'],
  Gaming: ['General Student Organizations'], Career: ['Business', 'Health & Pre-Professional', 'Law'],
  Faith: ['Faith & Religious Life'], Academics: ['Honor Societies', 'STEM & Engineering'],
  'Campus Events': ['General Student Organizations'], 'Greek Life': ['Fraternities & Sororities'],
  Outdoors: ['Agriculture & Natural Resources', 'Sport Clubs'], Service: ['Service & Philanthropy'],
};

/* "Picked for you": score each org by its category AND by words in
   its own name/description, so "Gaming" finds the esports and chess
   clubs rather than every org in the catch-all General category.
   Greek chapters only appear for students who chose Greek Life. */
const INTEREST_WORDS = {
  Sports: /sport|athlet|club team|rugby|soccer|lacrosse|volleyball|climb|run|cycl|martial|fencing/i,
  Music: /music|band|choir|sing|orchestra|a cappella|guitar|dj/i,
  Arts: /\bart|dance|theat|film|design|photo|paint|draw|creative|writ|poet/i,
  Technology: /comput|tech|engineer|code|coding|program|robot|\bai\b|cyber|data|software|hack/i,
  Gaming: /\bgam(e|es|ing|er|ers)\b|esport|chess|tabletop|anime|board game|smash/i,
  Career: /career|professional|business|consult|finance|market|pre-|entrepreneur|leader/i,
  Faith: /faith|christ|bible|church|catholic|muslim|islam|jewish|hindu|ministr|fellowship|baptist|worship|gospel/i,
  Academics: /honor|scholar|research|academic|study|society/i,
  'Campus Events': /event|program|activit|social|festival/i,
  Outdoors: /outdoor|hik|climb|camp|wildlife|ranch|rodeo|fish|hunt|nature/i,
  Service: /service|volunteer|philanthrop|community|charit|habitat|outreach/i,
};
export function orgsForInterests(interests, n = 8, seed = new Date().getDate()) {
  const hash = (id) => { let h = seed; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h) % 1000; };
  const nonGreek = ORGS.filter((o) => !isGreek(o));
  // One shelf per interest, then deal them out round-robin so every
  // interest is represented (not just whichever matches the most orgs).
  const shelves = interests.map((i) => {
    if (i === 'Greek Life') return GREEK_ORGS;
    const re = INTEREST_WORDS[i]; const tags = new Set(INTEREST_TO_TAGS[i] || []);
    return nonGreek.filter((o) => (re && re.test(`${o.name} ${o.reason || ''}`)) || (tags.has(o.tags) && o.tags !== 'General Student Organizations'));
  }).map((list) => [...list].sort((a, b) => hash(a.id) - hash(b.id)));
  const out = []; const seen = new Set();
  for (let round = 0; out.length < n && shelves.some((l) => l.length > round); round++) {
    for (const list of shelves) {
      const o = list[round];
      if (o && !seen.has(o.id) && out.length < n) { seen.add(o.id); out.push(o); }
    }
  }
  if (out.length < n) {
    for (const o of [...nonGreek].sort((a, b) => hash(a.id) - hash(b.id))) {
      if (out.length >= n) break;
      if (!seen.has(o.id)) { seen.add(o.id); out.push(o); }
    }
  }
  return out;
}

/* Real building-name matcher for scanned schedules. */
export function matchBuildingName(rawName) {
  if (!rawName) return null;
  const q = rawName.toLowerCase().trim();
  let hit = BUILDINGS.find((b) => b.name.toLowerCase() === q);
  if (hit) return hit.id;
  hit = BUILDINGS.find((b) => b.name.toLowerCase().includes(q) || q.includes(b.name.toLowerCase()));
  if (hit) return hit.id;
  const qWords = q.split(/\s+/).filter((w) => w.length > 2);
  let best = null; let bestScore = 0;
  for (const b of BUILDINGS) {
    const bWords = b.name.toLowerCase().split(/\s+/);
    const score = qWords.filter((w) => bWords.some((bw) => bw.includes(w) || w.includes(bw))).length;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return bestScore > 0 ? best.id : null;
}

/* Straight-line distance in meters. */
export function distanceM(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371000; const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat); const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/* ~1.35 m/s walking pace, same assumption as the original walk times. */
export const walkMinutes = (m) => (m == null ? null : Math.max(1, Math.round(m / 1.35 / 60)));
