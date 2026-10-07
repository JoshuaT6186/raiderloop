/**
 * RaiderLoop — v0.7
 * -----------------------------------------------------------
 * Expo / React Native.
 * Requires: npx expo install react-native-svg react-native-maps
 *
 * Built to the design brief. The governing rule is section 21:
 * DO NOT INNOVATE UNIFORMLY. Each destination gets the
 * interaction model that fits its purpose, and one shared
 * material language ties them together.
 *
 *   Home      conventional and calm. The front door, not a
 *             dashboard. Curated, not comprehensive.
 *   Discover  the Raider Grid. This is where we break the mold.
 *             Tiles have different internal structures by
 *             content type — not one shape recoloured.
 *   Campus    map-driven, glass floating over it.
 *   Schedule  a deliberately ordinary timeline.
 *   You       a personal control centre.
 *   Ask Red   returns real RaiderLoop content, not paragraphs.
 *
 * Material: Raider Glass (soft surfaces, real borders, quiet
 * shadow) + Raider Bleed (red diffusing up through the surface,
 * used selectively for hierarchy — strong on featured, absent
 * on utility). Red is energy, emphasis and state. Never a
 * background.
 */

import React, {
  createContext, useContext, useMemo, useState, useRef, useEffect,
} from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  SafeAreaView, StatusBar, Platform, Modal, Animated, Easing, Dimensions, Linking, Image,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

let Svg, Defs, RadialGradient, LinearGradient, Stop, Path, Circle, Rect;
try {
  const S = require('react-native-svg');
  Svg = S.default; Defs = S.Defs; RadialGradient = S.RadialGradient; LinearGradient = S.LinearGradient;
  Stop = S.Stop; Path = S.Path; Circle = S.Circle; Rect = S.Rect;
} catch (e) {}

let MapView = null, Marker = null;
if (Platform.OS !== 'web') {
  try { const M = require('react-native-maps'); MapView = M.default; Marker = M.Marker; } catch (e) {}
}

let BlurView = null;
try { BlurView = require('expo-blur').BlurView; } catch (e) {}

/* ============================================================
   THEME
   ============================================================ */

const lightTheme = {
  mode: 'light',
  canvas: '#FBF8F5',
  canvasDeep: '#F4EDE7',
  surface: '#FFFFFF',
  surfaceAlt: '#F5EFEA',
  border: 'rgba(28,20,18,0.08)',
  borderStrong: 'rgba(28,20,18,0.14)',
  text: '#1A1416',
  textMuted: '#716660',
  textFaint: '#A0968F',
  red: '#CC0000',
  redInk: '#8E0000',
  onRed: '#FFFFFF',
  bleedWarm: '#FF7A3D',
  shadow: '#2E1F1B',
  shadowOpacity: 0.10,
  ok: '#2E8B5B',
  info: '#3F6B8C',
  gold: '#B8860B',
};

const darkTheme = {
  mode: 'dark',
  canvas: '#121011',
  canvasDeep: '#0C0A0B',
  surface: '#1D1A1B',
  surfaceAlt: '#262223',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.17)',
  text: '#F6F2F0',
  textMuted: '#9B918C',
  textFaint: '#6C635F',
  red: '#E3253F',
  redInk: '#FF5C74',
  onRed: '#FFFFFF',
  bleedWarm: '#FF6A4D',
  shadow: '#000000',
  shadowOpacity: 0.45,
  ok: '#4CB07C',
  info: '#6E9BC2',
  gold: '#D9A441',
};

/* ============================================================
   GRID METRICS — verified to sum exactly to content width
   ============================================================ */

const PAD = 20;
const GAP = 10;
const GRID_W = SCREEN_W - PAD * 2;          // 350 @ 390

// Tabular numerals so times/countdowns don't shift width as digits
// change — spread into any text style showing a clock time or count.
const NUM = { fontVariant: ['tabular-nums'] };
const HALF = (GRID_W - GAP) / 2;            // 170
const WIDE = (GRID_W - GAP) * 0.615;        // 209
const NARROW = (GRID_W - GAP) * 0.385;      // 131

/* ============================================================
   IMAGERY
   ------------------------------------------------------------
   Real photos, not color blocks — per the design feedback that
   text-only tiles read as a spec document. These four are real,
   verified Unsplash License images (free for commercial use, no
   attribution required) pulled in as stand-ins for the visual
   direction. NONE of these are Texas Tech's own photography —
   swap in real campus/game-day photos you take yourself before
   this goes anywhere near SGA or the Dean's office. Hotlinking
   someone else's stock photo in a pitch deck is a fast way to
   undercut "we built this ourselves."
   ============================================================ */
const IMG = {
  stadium: 'https://images.unsplash.com/photo-1693164586646-f3f877aec626?w=900&q=70&fit=crop&auto=format',
  rally: 'https://images.unsplash.com/photo-1766756467595-fd3f1f62d562?w=900&q=70&fit=crop&auto=format',
  dining: 'https://images.unsplash.com/photo-1666216601827-4f5f88a8c9c2?w=900&q=70&fit=crop&auto=format',
  library: 'https://images.unsplash.com/photo-1741699428220-65f37f3fbbcb?w=900&q=70&fit=crop&auto=format',
};

/* ============================================================
   DATA
   ============================================================ */

const BUILDINGS = [
  { id: 'holden', name: 'Holden Hall', kind: 'Academic', dist: '3 min walk', lat: 33.5843, lng: -101.8756 },
  { id: 'eng', name: 'Engineering Center', kind: 'Academic', dist: '4 min walk', lat: 33.5852, lng: -101.8730 },
  { id: 'sub', name: 'Student Union Building', kind: 'Student life', dist: '3 min walk', lat: 33.5836, lng: -101.8747 },
  { id: 'library', name: 'University Library', kind: 'Library', dist: '5 min walk', lat: 33.5828, lng: -101.8746 },
  { id: 'rec', name: 'Rec Center', kind: 'Recreation', dist: '8 min walk', lat: 33.5900, lng: -101.8790 },
  { id: 'hhs', name: 'Human Sciences', kind: 'Academic', dist: '6 min walk', lat: 33.5825, lng: -101.8770 },
  { id: 'usa', name: 'United Supermarkets Arena', kind: 'Athletics', dist: '12 min walk', lat: 33.5980, lng: -101.8710 },
  { id: 'stadium', name: 'Jones AT&T Stadium', kind: 'Athletics', dist: '15 min walk', lat: 33.5904, lng: -101.8676 },
];
const buildingById = (id) => BUILDINGS.find((b) => b.id === id);
const CAMPUS_CENTER = { latitude: 33.5843, longitude: -101.8746 };

const EVENTS = [
  { id: 'ev1', title: 'Game Development Club', org: 'Game Development Club', date: 'Today', time: '7:00 PM', endTime: '8:30 PM', buildingId: 'eng', room: 'Room 204', category: 'Technology', official: false, live: true, desc: "Kickoff meeting — project pitches, team formation, and an intro to the club's current Unity build." },
  { id: 'ev2', title: 'Live Music on the Green', org: 'Student Union Programs', date: 'Today', time: '8:00 PM', endTime: '10:00 PM', buildingId: 'sub', room: 'SUB Courtyard', category: 'Music', official: true, desc: 'Local student bands play the SUB courtyard. Free, food trucks on site.' },
  { id: 'ev3', title: 'Pickup Basketball', org: 'Rec Sports', date: 'Today', time: '6:00 PM', endTime: '7:30 PM', buildingId: 'rec', room: 'Court 2', category: 'Sports', official: true, desc: 'Open gym, no sign-up needed. Bring a RaiderCard to check in.' },
  { id: 'ev4', title: 'Coffee & Code', org: 'ACM @ Texas Tech', date: 'Tomorrow', time: '10:00 AM', endTime: '12:00 PM', buildingId: 'library', room: '2nd Floor Commons', category: 'Technology', official: false, desc: 'Casual weekly work session — bring a project, get help, meet other CS students.' },
  { id: 'ev5', title: 'Study Abroad Info Session', org: 'International Affairs', date: 'Tomorrow', time: '12:00 PM', endTime: '1:00 PM', buildingId: 'sub', room: 'Escondido Theater', category: 'Academics', official: true, desc: 'Spring and summer programs, funding options, application deadlines.' },
  { id: 'ev6', title: 'Career Fair — Fall Kickoff', org: 'Career Center', date: 'Today', time: '1:00 PM', endTime: '4:00 PM', buildingId: 'usa', room: 'Main Concourse', category: 'Career', official: true, live: true, desc: 'Over 80 employers on site. Business casual, bring copies of your resume.' },
  { id: 'ev7', title: 'Flag Football Sign-Ups', org: 'Rec Sports', date: 'Tomorrow', time: '9:00 AM', endTime: '5:00 PM', buildingId: 'rec', room: 'Front Desk', category: 'Sports', official: true, desc: 'Register a team or sign up as a free agent.' },
  { id: 'ev8', title: 'Chi Alpha Worship Night', org: 'Chi Alpha', date: 'Tomorrow', time: '7:30 PM', endTime: '9:00 PM', buildingId: 'sub', room: 'Matador Room', category: 'Faith', official: false, desc: 'Worship, a short teaching, small groups afterward. All welcome.' },
  { id: 'ev9', title: 'Resume Review Drop-In', org: 'Career Center', date: 'Today', time: '2:00 PM', endTime: '4:00 PM', buildingId: 'sub', room: 'Career Center Suite', category: 'Career', official: true, desc: 'No appointment needed — bring a resume for quick feedback.' },
  { id: 'ev10', title: 'K-Pop Crew Open Practice', org: 'Red Raider K-Pop Club', date: 'Tomorrow', time: '6:00 PM', endTime: '8:00 PM', buildingId: 'rec', room: 'Dance Studio B', category: 'Arts', official: false, desc: 'Beginners welcome — no audition required.' },
  { id: 'ev11', title: 'Battle of the Bands Auditions', org: 'Campus Activities Board', date: 'Today', time: '5:00 PM', endTime: '9:00 PM', buildingId: 'sub', room: 'Allen Theatre', category: 'Music', official: false, desc: 'Sign up for a 10-minute slot. Winners play the fall concert.' },
  { id: 'ev12', title: 'Astronomy Night', org: 'Physics & Astronomy', date: 'Tomorrow', time: '8:30 PM', endTime: '10:00 PM', buildingId: 'library', room: 'South Lawn', category: 'Academics', official: true, desc: 'Telescopes set up by the department. Free, open to everyone.' },
];

const FEATURED = {
  id: 'ev-feat', title: 'Red Raider Rally', org: 'Texas Tech Athletics', date: 'Tonight', time: '7:00 PM',
  endTime: '9:00 PM', buildingId: 'usa', room: 'Outside the Arena', category: 'Campus Events',
  official: true, featured: true, live: true, img: IMG.rally,
  desc: 'Band, cheer, and the whole student section before Saturday. Free, no ticket needed — just show up loud.',
};

const SCHEDULE_SEED = [
  { id: 's1', time: '9:00 AM', endTime: '9:50 AM', title: 'MATH 1320', place: 'Holden Hall 00077', type: 'class', kind: 'Lecture', buildingId: 'holden' },
  { id: 's2', time: '11:00 AM', endTime: '11:50 AM', title: 'CARS 2300', place: 'Human Sciences 00114', type: 'class', kind: 'Lab', buildingId: 'hhs' },
  { id: 's3', time: '1:00 PM', endTime: '1:50 PM', title: 'TSI 0320', place: 'Holden Hall 00073', type: 'class', kind: 'Lecture', buildingId: 'holden' },
  { id: 's4', time: '3:00 PM', endTime: '4:15 PM', title: 'CS 1412', place: 'Engineering Center 00101', type: 'class', kind: 'Lecture', buildingId: 'eng' },
];

const ORGS = [
  { id: 'r1', name: 'Game Development Club', initials: 'GD', tags: 'Technology · Gaming', reason: 'Because you like Technology' },
  { id: 'r2', name: 'ACM @ Texas Tech', initials: 'AC', tags: 'Technology · Academic', reason: 'Popular with CS students' },
  { id: 'r3', name: 'Christians at Tech', initials: 'CT', tags: 'Faith · Community', reason: 'Because you like Faith' },
  { id: 'r4', name: 'Red Raider K-Pop Club', initials: 'KP', tags: 'Arts · Dance', reason: 'New this semester' },
  { id: 'r5', name: 'Society of Hispanic Professional Engineers', initials: 'SH', tags: 'Technology · Professional', reason: 'Popular with engineering majors' },
  { id: 'r6', name: 'Campus Activities Board', initials: 'CA', tags: 'Campus Events', reason: 'Runs most big events' },
];

const DINING = [
  { id: 'd1', name: 'The Market at Stangel', status: 'Open until 9 PM', open: true, dist: '4 min', buildingId: 'sub' },
  { id: 'd2', name: 'Sam\'s Place West', status: 'Open until 11 PM', open: true, dist: '6 min', buildingId: 'rec' },
  { id: 'd3', name: 'Fresh Plate', status: 'Closed', open: false, dist: '3 min', buildingId: 'sub' },
];

const STUDY = [
  { id: 'st1', name: 'University Library', status: 'Open until 10 PM', seats: 'Quiet floors open', buildingId: 'library' },
  { id: 'st2', name: 'SUB Commons', status: 'Open until 8 PM', seats: 'Busy', buildingId: 'sub' },
];

const RESOURCES = [
  { id: 'res1', name: 'Math Emporium Tutoring', kind: 'Academic · Free', buildingId: 'holden' },
  { id: 'res2', name: 'Writing Center', kind: 'Academic · Free', buildingId: 'library' },
  { id: 'res3', name: 'Student Counseling Center', kind: 'Student Life · By appointment', buildingId: 'sub' },
  { id: 'res4', name: 'IT Help Central', kind: 'Technology · Walk-in', buildingId: 'library' },
];

const SPORTS_NEXT = {
  id: 'sp1', opponent: 'Oklahoma State', when: 'Sat, Nov 14 · 6:00 PM',
  venue: 'Jones AT&T Stadium', buildingId: 'stadium', note: 'Blackout — wear black',
};

/* Campus Update only renders when there is genuinely something
   worth knowing. Set to null on an ordinary day. */
const CAMPUS_UPDATE = {
  id: 'cu1',
  title: 'Lot C1 closed through Friday',
  body: 'Resurfacing near Holden Hall. Use Lot C2 or the Flint Avenue garage.',
  source: 'Transportation & Parking',
};

const WEATHER = { temp: 84, condition: 'Clear', city: 'Lubbock' };

const INTERESTS = ['Sports', 'Music', 'Arts', 'Technology', 'Gaming', 'Career', 'Faith', 'Academics', 'Campus Events'];
// One shared stroke-icon system — same 24x24 grid, same stroke
// weight, used for tabs, interest tags, save marks, and chevrons.
// Replaces the earlier mix of hand-drawn SVG + emoji + text glyphs,
// which read as three different visual languages stitched together.
const ICON_PATHS = {
  home: 'M3.5 10.2 12 3.5l8.5 6.7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z',
  discover: 'M4 5.5h6.5v6.5H4zM13.5 5.5H20v4.2h-6.5zM4 15h6.5v3.5H4zM13.5 12.7H20v5.8h-6.5z',
  campus: 'M12 21s-6.5-5.4-6.5-10.2A6.5 6.5 0 0 1 18.5 10.8C18.5 15.6 12 21 12 21z',
  schedule: 'M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
  you: 'M12 11.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM5 20.5c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6',
  chevron: 'M9 5l7 7-7 7',
  starOutline: 'M12 3.5l2.55 5.4 5.95.6-4.45 4.05 1.25 5.85L12 16.4l-5.3 3-1.25-5.85-4.45-4.05 5.95-.6z',
  red: 'M4 5.5h16v10.5H8l-3 3.2v-3.2H4z',
  dining: 'M7 3v7a2 2 0 0 0 4 0V3M9 10v11M15 3c-1.2 0-2 1.5-2 4s.8 4 2 4v10',
  Sports: 'M4 4h16v16H4zM4 12h16M12 4v16M6.5 6.5l3 3M17.5 17.5l-3-3M17.5 6.5l-3 3M6.5 17.5l3-3',
  Music: 'M9 18a2.2 2.2 0 1 1-2.2-2.2A2.2 2.2 0 0 1 9 18zM9 18V6l10-2v10M18 14a2.2 2.2 0 1 1-2.2-2.2A2.2 2.2 0 0 1 18 14z',
  Arts: 'M12 3a9 9 0 1 0 0 18c1.4 0 1.7-1.2.9-2s-.4-2.1 1-2.1H16a3.5 3.5 0 0 0 3.5-3.5C19.5 7.5 16.1 3 12 3zM7.5 12a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4zM9.8 8.3a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4zM14.3 8.3a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z',
  Technology: 'M4 5.5h16v10.5H4zM9 20h6M12 16v4',
  Gaming: 'M6 9h12l1.5 8a2 2 0 0 1-2 2.4c-1 0-1.7-.6-2-1.5L15 16H9l-.5 1.9c-.3.9-1 1.5-2 1.5A2 2 0 0 1 4.5 17zM8 11.5v3M6.5 13h3M15.3 12h.01M17.3 13.5h.01',
  Career: 'M4 8h16v11H4zM8 8V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V8M4 13h16',
  Faith: 'M12 3v18M6 8h12M8 21l4-13 4 13',
  Academics: 'M2 8l10-4 10 4-10 4zM6 10.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-5.5M22 8v6.5',
  'Campus Events': 'M4 4.5h13l3 4-3 4H4zM4 4.5v15',
};

function Icon({ id, size = 20, color = '#000', strokeWidth = 2, fill }) {
  if (!Svg) return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color }} />;
  const d = ICON_PATHS[id];
  if (!d) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} fill={fill || 'none'} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const RED_REPLIES = [
  { match: ['tonight', 'happening', 'fun', 'do', 'bored'], text: 'Three things tonight.', eventIds: ['ev1', 'ev2', 'ev3'] },
  { match: ['class', 'next class', 'where is my'], text: 'Your next class is CS 1412 in the Engineering Center.', buildingId: 'eng' },
  { match: ['eat', 'food', 'hungry', 'lunch', 'dinner'], text: "Here's what's open near you.", buildingIds: ['sub', 'rec'] },
  { match: ['study', 'quiet', 'library'], text: 'Two study spots close by.', buildingIds: ['library', 'sub'] },
  { match: ['club', 'organization', 'org', 'join'], text: 'A few organizations you might like.', orgIds: ['r1', 'r2', 'r3'] },
  { match: ['tutor', 'help', 'resource', 'counseling'], text: 'Student resources that can help.', resourceIds: ['res1', 'res2', 'res3'] },
  { match: ['hi', 'hello', 'hey'], text: "Hey — I'm Red. Ask what's happening tonight, or where your next class is." },
];

const RED_SUGGESTIONS = [
  "What's happening tonight?",
  'Where is my next class?',
  'Where can I study?',
  'Find coding organizations',
];

function toMinutes(t) {
  if (!t) return null;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (/pm/i.test(m[3]) && h !== 12) h += 12;
  if (/am/i.test(m[3]) && h === 12) h = 0;
  return h * 60 + min;
}
function overlaps(aS, aE, bS, bE) {
  const v = [aS, aE, bS, bE].map(toMinutes);
  if (v.some((x) => x === null)) return false;
  return v[0] < v[3] && v[2] < v[1];
}
function allEvents() { return [FEATURED, ...EVENTS]; }
function eventById(id) { return allEvents().find((e) => e.id === id); }

/* A real, working action: hands off to the device's own Maps app
   rather than faking turn-by-turn we can't actually build here. */
function openDirections(building) {
  if (!building) return;
  const label = encodeURIComponent(building.name);
  const url = Platform.select({
    ios: `maps://?daddr=${building.lat},${building.lng}&q=${label}`,
    android: `google.navigation:q=${building.lat},${building.lng}(${label})`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${building.lat},${building.lng}`,
  });
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${building.lat},${building.lng}`);
  });
}

const MAP_STYLE_LIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#FBF8F5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#716660' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FBF8F5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#F0E8E1' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#F5EFEA' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E7E1D3' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#E1D9D3' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
const MAP_STYLE_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#121011' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9B918C' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#121011' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#262223' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1D1A1B' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#181516' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

/* ============================================================
   STATE
   ============================================================ */

const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

function AppProvider({ children }) {
  const [savedIds, setSavedIds] = useState(new Set());
  const [followedOrgIds, setFollowedOrgIds] = useState(new Set());
  const [orgDetailId, setOrgDetailId] = useState(null);
  const [infoSheet, setInfoSheet] = useState(null);
  const [scheduleItems, setScheduleItems] = useState(SCHEDULE_SEED);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [interests, setInterests] = useState([]);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState('home');
  const [detailId, setDetailId] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [redOpen, setRedOpen] = useState(false);
  const [quietDay, setQuietDay] = useState(false);
  const [discoverCategory, setDiscoverCategory] = useState(null);
  const [pendingRedQuestion, setPendingRedQuestion] = useState(null);

  const toggleSave = (id) => setSavedIds((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleFollow = (id) => setFollowedOrgIds((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const addToSchedule = (ev, { force = false } = {}) => {
    if (!force) {
      const clash = scheduleItems.find((i) => overlaps(i.time, i.endTime || i.time, ev.time, ev.endTime || ev.time));
      if (clash) { setConflict({ incoming: ev, existing: clash }); return; }
    }
    setScheduleItems((p) => [...p, {
      id: `sch-${ev.id}`, time: ev.time, endTime: ev.endTime, title: ev.title,
      place: `${buildingById(ev.buildingId)?.name || ''} · ${ev.room}`,
      type: 'event', buildingId: ev.buildingId,
    }].sort((a, b) => toMinutes(a.time) - toMinutes(b.time)));
  };

  const goToBuilding = (id) => { setSelectedBuildingId(id); setDetailId(null); setTab('campus'); };

  return (
    <AppContext.Provider value={{
      savedIds, toggleSave, scheduleItems, addToSchedule,
      followedOrgIds, toggleFollow, orgDetailId, setOrgDetailId, infoSheet, setInfoSheet,
      selectedBuildingId, setSelectedBuildingId, goToBuilding,
      interests, setInterests, onboarded, setOnboarded,
      tab, setTab, detailId, setDetailId, conflict, setConflict,
      redOpen, setRedOpen, quietDay, setQuietDay,
      discoverCategory, setDiscoverCategory, pendingRedQuestion, setPendingRedQuestion,
    }}>{children}</AppContext.Provider>
  );
}

/* ============================================================
   MATERIAL — Raider Glass + Raider Bleed
   ------------------------------------------------------------
   Bleed intensity carries hierarchy, per the brief:
     2  featured content
     1  secondary content
     0  utility tiles (no bleed at all)
   ============================================================ */

let bleedId = 0;

function Bleed({ t, intensity = 1, corner = 'topRight' }) {
  const id = useRef(`bl${bleedId++}`).current;
  if (!intensity || !Svg) return null;
  const peak = intensity === 2 ? 0.30 : 0.15;
  const pos = {
    topRight: { cx: '88%', cy: '4%' },
    topLeft: { cx: '12%', cy: '4%' },
    bottomRight: { cx: '92%', cy: '96%' },
    bottomLeft: { cx: '8%', cy: '96%' },
  }[corner];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx={pos.cx} cy={pos.cy} r="78%">
            <Stop offset="0%" stopColor={t.bleedWarm} stopOpacity={peak} />
            <Stop offset="38%" stopColor={t.red} stopOpacity={peak * 0.62} />
            <Stop offset="100%" stopColor={t.red} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/* Small walking figure — used next to walk-time distances so the
   number reads at a glance instead of requiring the word "walk". */
function WalkGlyph({ color = '#000', size = 13 }) {
  if (!Svg) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: 5 }}>
      <Circle cx="14" cy="4.5" r="2.2" fill={color} />
      <Path d="M13 8 L9 11 L10 16 L8 21 M13 8 L16 10 L15 14 L18 17 M9 11 L14 12"
        stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* An animated pulsing dot — used wherever something is happening
   live or imminently, so it reads as active rather than static. */
function LiveDot({ color, size = 7 }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0.1] });
  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center', marginRight: 7 }}>
      <Animated.View style={{ position: 'absolute', width: size * 2, height: size * 2, borderRadius: size, backgroundColor: color, transform: [{ scale }], opacity }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

function CalendarGlyph({ color, size = 16 }) {
  return <Icon id="schedule" size={size} color={color} strokeWidth={2} />;
}

function Glass({ s, t, children, style, onPress, radius = 20, lift = 1, bleed = 0, bleedCorner = 'topRight', ring, tint }) {
  const W = onPress ? Pressable : View;
  return (
    <View style={[{
      borderRadius: radius,
      shadowColor: t.shadow,
      shadowOpacity: t.shadowOpacity * (lift === 2 ? 2.1 : lift === 0 ? 0.9 : 1.5),
      shadowRadius: lift === 2 ? 26 : lift === 0 ? 9 : 15,
      shadowOffset: { width: 0, height: lift === 2 ? 11 : lift === 0 ? 3 : 6 },
      elevation: lift === 2 ? 8 : lift === 0 ? 2 : 4,
    }, style]}>
      <W onPress={onPress} style={{
        borderRadius: radius, backgroundColor: tint || t.surface,
        borderWidth: tint ? 0 : ring ? 1.4 : 0.5, borderColor: ring || t.border, overflow: 'hidden',
      }}>
        {!tint ? <Bleed t={t} intensity={bleed} corner={bleedCorner} /> : null}
        <View>{children}</View>
      </W>
    </View>
  );
}

/* Frosted, blurred surfaces for the nav bar and modal backdrops —
   real translucency instead of a flat opaque card / dark rectangle.
   Rendered as an absolute-fill layer behind existing content rather
   than swapping element types, so it drops in without touching any
   JSX structure elsewhere. No-ops cleanly if expo-blur isn't
   installed. */
function BlurFill({ t, style }) {
  if (!BlurView) return null;
  return (
    <BlurView
      intensity={t.mode === 'dark' ? 50 : 40}
      tint={t.mode}
      style={style || StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

function SectionLabel({ s, children, action, onAction }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionLabel}>{children}</Text>
      {action ? <Pressable onPress={onAction} hitSlop={8}><Text style={s.sectionAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

function Pill({ s, t, label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.pill, active && { backgroundColor: t.red, borderColor: t.red }]}>
      <Text style={[s.pillText, active && { color: t.onRed }]}>{label}</Text>
    </Pressable>
  );
}

/* One continuous rounded container with thin dividers between rows —
   only the outer corners round, matching native Settings-style
   grouped lists instead of five separate floating cards. */
function GroupedList({ s, t, items }) {
  return (
    <View style={[s.groupedList, { shadowColor: t.shadow, shadowOpacity: t.shadowOpacity * 0.9, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 }]}>
      {items.map((item, i) => (
        <Pressable key={item.title} onPress={item.onPress} style={[s.groupedRow, i < items.length - 1 && s.groupedRowDivider]}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{item.title}</Text>
            {item.meta ? <Text style={s.rowMeta}>{item.meta}</Text> : null}
          </View>
          {item.right !== undefined ? item.right : <Icon id="chevron" size={16} color={t.textFaint} strokeWidth={2.2} />}
        </Pressable>
      ))}
    </View>
  );
}

function Row({ s, t, title, meta, note, right, onPress }) {
  return (
    <Glass s={s} t={t} onPress={onPress} style={{ marginBottom: 9 }}>
      <View style={s.rowInner}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>{title}</Text>
          {meta ? <Text style={s.rowMeta}>{meta}</Text> : null}
          {note ? <Text style={s.rowNote}>{note}</Text> : null}
        </View>
        {right !== undefined ? right : <Icon id="chevron" size={16} color={t.textFaint} strokeWidth={2.2} />}
      </View>
    </Glass>
  );
}

function TabGlyph({ t, id, active }) {
  const c = active ? t.red : t.textFaint;
  const sw = active ? 2.2 : 1.8;
  if (!Svg) return <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c }} />;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d={ICON_PATHS[id]} stroke={c} strokeWidth={sw} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {id === 'campus' ? <Circle cx="12" cy="10.5" r="2.3" stroke={c} strokeWidth={sw} fill="none" /> : null}
    </Svg>
  );
}

/* ============================================================
   HOME — the front door
   ------------------------------------------------------------
   Deliberately conventional. Section 3 of the brief: this is the
   screen students return to all day, so it must be immediately
   legible. The material does the distinguishing, not the layout.
   Curated, not comprehensive — Campus Update only appears when
   there is genuinely something to say, and weather sits inline
   with the greeting rather than claiming a card of its own.
   ============================================================ */

function HomeScreen({ s, t }) {
  const {
    scheduleItems, setTab, goToBuilding, setDetailId, quietDay, interests,
    setRedOpen, setDiscoverCategory, setPendingRedQuestion,
  } = useApp();
  const now = new Date();
  const hour = now.getHours();
  const nowM = hour * 60 + now.getMinutes();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const day = useMemo(
    () => [...scheduleItems].sort((a, b) => toMinutes(a.time) - toMinutes(b.time)),
    [scheduleItems]
  );
  const next = day.find((i) => (toMinutes(i.time) ?? 0) >= nowM);
  const rest = day.filter((i) => i.id !== next?.id).slice(0, 3);

  const todays = EVENTS.filter((e) => e.date === 'Today');
  const happening = (quietDay ? todays.slice(0, 1) : todays).slice(0, 3);

  // Restrained: one or two genuinely useful recommendations, not ten.
  const forYou = useMemo(() => {
    const pool = interests.length
      ? EVENTS.filter((e) => interests.includes(e.category))
      : EVENTS;
    return pool.filter((e) => e.date !== 'Today').slice(0, 2);
  }, [interests]);

  const minsUntil = next ? (toMinutes(next.time) ?? 0) - nowM : null;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenContent} showsVerticalScrollIndicator={false}>
      <View style={s.greetRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>
            <Text style={s.greetingLight}>{greeting},</Text>{'\n'}Red Raider
          </Text>
        </View>
        <View style={s.weatherInline}>
          <Text style={s.weatherTemp}>{WEATHER.temp}°</Text>
          <Text style={s.weatherMeta}>{WEATHER.condition}</Text>
          <Text style={s.weatherCity}>{WEATHER.city}</Text>
        </View>
      </View>

      {/* NEXT UP — solid hero card, real contrast instead of a
          white card floating among other white cards */}
      {next ? (
        <>
          <SectionLabel s={s}>NEXT UP</SectionLabel>
          <Glass s={s} t={t} radius={22} lift={2} tint={t.red}>
            <View style={s.nextInner}>
              <Text style={s.heroTitle}>{next.title}</Text>
              <Text style={s.heroMeta}>{next.time} · {next.place}</Text>
              <View style={s.heroWalkRow}>
                <WalkGlyph color="rgba(255,255,255,0.85)" />
                <Text style={s.heroWalkText}>{buildingById(next.buildingId)?.dist || 'On campus'}</Text>
              </View>
              {minsUntil !== null && minsUntil >= 0 && minsUntil < 180 ? (
                <View style={s.heroCountdownRow}>
                  <LiveDot color="#FFFFFF" />
                  <Text style={s.heroCountdown}>
                    {minsUntil === 0 ? 'Starting now' : `In ${minsUntil} minutes`}
                  </Text>
                </View>
              ) : null}
              <View style={s.nextChipRow}>
                <Pressable style={s.nextChipLight} onPress={() => openDirections(buildingById(next.buildingId))}>
                  <Text style={s.nextChipLightText}>Directions</Text>
                </Pressable>
                <Pressable style={s.nextChipLight} onPress={() => goToBuilding(next.buildingId)}>
                  <Text style={s.nextChipLightText}>Building Map</Text>
                </Pressable>
              </View>
            </View>
          </Glass>
        </>
      ) : null}

      {/* QUICK ACTIONS — real shortcuts into data the app actually
          has, not the mockup's fabricated bus-ETA/balance widgets. */}
      <View style={s.quickActionsRow}>
        <Pressable style={s.quickAction} onPress={() => setRedOpen(true)}>
          <Icon id="red" size={17} color={t.red} strokeWidth={2} />
          <Text style={s.quickActionText}>Ask Red</Text>
        </Pressable>
        <Pressable style={s.quickAction} onPress={() => { setDiscoverCategory('dining'); setTab('discover'); }}>
          <Icon id="dining" size={17} color={t.info} strokeWidth={1.8} />
          <Text style={s.quickActionText}>Dining</Text>
        </Pressable>
        <Pressable style={s.quickAction} onPress={() => { setDiscoverCategory('study'); setTab('discover'); }}>
          <Icon id="Academics" size={17} color={t.gold} strokeWidth={2} />
          <Text style={s.quickActionText}>Study Spots</Text>
        </Pressable>
      </View>

      {/* YOUR DAY — a preview, not a second Schedule screen */}
      {rest.length ? (
        <>
          <SectionLabel s={s} action="Schedule" onAction={() => setTab('schedule')}>YOUR DAY</SectionLabel>
          <Glass s={s} t={t} radius={20}>
            <View style={{ paddingVertical: 4 }}>
              {rest.map((i, idx) => {
                const past = (toMinutes(i.time) ?? 0) < nowM;
                return (
                  <Pressable key={i.id} onPress={() => goToBuilding(i.buildingId)}
                    style={[s.dayLine, idx < rest.length - 1 && s.dayLineDivider, past && { opacity: 0.42 }]}>
                    <Text style={s.dayTime}>{i.time}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.dayTitle}>{i.title}</Text>
                      <Text style={s.dayPlace} numberOfLines={1}>{i.place}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Glass>
        </>
      ) : null}

      {/* HAPPENING TODAY — curated, three at most */}
      {happening.length ? (
        <>
          <SectionLabel s={s} action="See all" onAction={() => setTab('discover')}>HAPPENING TODAY</SectionLabel>
          {happening.map((e) => (
            <Glass key={e.id} s={s} t={t} radius={18} bleed={1} onPress={() => setDetailId(e.id)} style={{ marginBottom: 9 }}>
              <View style={s.rowInner}>
                <View style={s.timeChip}>
                  <Text style={s.timeChipTime}>{e.time.replace(':00', '')}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{e.title}</Text>
                  <Text style={s.rowMeta}>{buildingById(e.buildingId)?.name}</Text>
                </View>
                <Icon id="chevron" size={16} color={t.textFaint} strokeWidth={2.2} />
              </View>
            </Glass>
          ))}
        </>
      ) : null}

      {/* FOR YOU — restrained */}
      {forYou.length ? (
        <>
          <SectionLabel s={s}>FOR YOU</SectionLabel>
          {forYou.map((e) => (
            <Row key={e.id} s={s} t={t} title={e.title}
              meta={`${e.date} · ${e.time} · ${buildingById(e.buildingId)?.name}`}
              note={interests.includes(e.category) ? `Because you like ${e.category}` : 'Popular this week'}
              onPress={() => setDetailId(e.id)} />
          ))}
        </>
      ) : null}

      {/* CAMPUS UPDATE — only when there's something worth knowing */}
      {CAMPUS_UPDATE ? (
        <>
          <SectionLabel s={s}>CAMPUS UPDATE</SectionLabel>
          <Glass s={s} t={t} radius={18} lift={0}>
            <View style={s.updateInner}>
              <Text style={s.updateTitle}>{CAMPUS_UPDATE.title}</Text>
              <Text style={s.updateBody}>{CAMPUS_UPDATE.body}</Text>
              <Text style={s.updateSource}>{CAMPUS_UPDATE.source}</Text>
            </View>
          </Glass>
        </>
      ) : null}

      {/* ASK RED — always-visible entry points, not just a floating
          button you have to remember exists. Tapping one opens the
          sheet and fires that question immediately. */}
      <SectionLabel s={s}>ASK RED</SectionLabel>
      <View style={s.redChipWrap}>
        {RED_SUGGESTIONS.slice(0, 3).map((q) => (
          <Pressable key={q} style={s.redChip} onPress={() => { setPendingRedQuestion(q); setRedOpen(true); }}>
            <Text style={s.redChipText}>{q}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

/* ============================================================
   DISCOVER — THE RAIDER GRID
   ------------------------------------------------------------
   Section 9 of the brief is the load-bearing rule here: tiles
   must not all be "rounded rectangle + icon + gradient + text."
   The content type decides the tile's internal structure.

     Featured      large type, strong bleed, save affordance
     Tonight       a count, time-oriented
     Sports        next fixture, scoreboard-ish framing
     Dining        utility — status dots, open/closed, no bleed
     Organizations a collection — stacked initials marks
     Study         utility — availability first
     Arts          editorial, minimal
     Resources     plain, calm, no decoration

   Selecting a tile expands it in place (section 12) rather than
   pushing a new screen.
   ============================================================ */

/* A real linear gradient (not a stacked-opacity hack) so text sits
   legibly over a photo without flattening the image underneath. */
function PhotoOverlay({ strength = 0.72 }) {
  if (!Svg) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${strength * 0.6})` }]} />;
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="photoFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity="0" />
            <Stop offset="0.45" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity={strength} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#photoFade)" />
      </Svg>
    </View>
  );
}

function TileFeatured({ s, t, ev, saved, onToggleSave, onOpen }) {
  return (
    <Glass s={s} t={t} radius={20} lift={2} onPress={onOpen} style={{ width: GRID_W, marginBottom: GAP }}>
      <View style={{ width: GRID_W, height: 200 }}>
        <Image source={{ uri: ev.img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <PhotoOverlay strength={0.8} />
        <View style={s.featInner}>
          <View style={s.featTopRow}>
            {ev.live ? (
              <View style={s.liveBadge}><View style={s.liveDot} /><Text style={s.liveBadgeText}>LIVE TONIGHT</Text></View>
            ) : (
              <Text style={s.featEyebrowPhoto}>{ev.date.toUpperCase()} · {ev.time}</Text>
            )}
            <Pressable onPress={onToggleSave} hitSlop={12}>
              <Icon id="starOutline" size={22} color={saved ? t.red : 'rgba(255,255,255,0.85)'} strokeWidth={1.8} fill={saved ? t.red : 'none'} />
            </Pressable>
          </View>
          <Text style={s.featTitlePhoto}>{ev.title}</Text>
          <Text style={s.featMetaPhoto}>{buildingById(ev.buildingId)?.name}</Text>
        </View>
      </View>
    </Glass>
  );
}

function TileTonight({ s, t, count, onOpen }) {
  return (
    <Glass s={s} t={t} radius={20} bleed={1} bleedCorner="topRight" onPress={onOpen}
      style={{ width: NARROW, marginBottom: GAP }}>
      <View style={s.tileTall}>
        <View style={s.tileIconRow}>
          <CalendarGlyph color={t.red} size={16} />
          <Text style={s.tileKicker}>TONIGHT</Text>
        </View>
        <Text style={s.bigNumber}>{count}</Text>
        <Text style={s.tileSub}>events after 5 PM</Text>
      </View>
    </Glass>
  );
}

function TileSports({ s, t, onOpen }) {
  return (
    <Glass s={s} t={t} radius={20} onPress={onOpen} style={{ width: WIDE, marginBottom: GAP }}>
      <View style={{ height: 148 }}>
        <Image source={{ uri: IMG.stadium }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <PhotoOverlay strength={0.75} />
        <View style={s.tileTallPhoto}>
          <Text style={s.tileKickerPhoto}>NEXT HOME GAME</Text>
          <View style={s.sportsRow}>
            <Text style={s.sportsUsPhoto}>TTU</Text>
            <Text style={s.sportsVsPhoto}>vs</Text>
            <Text style={s.sportsThemPhoto}>{SPORTS_NEXT.opponent}</Text>
          </View>
          <Text style={s.tileSubPhoto}>{SPORTS_NEXT.when}</Text>
        </View>
      </View>
    </Glass>
  );
}

/* Utility tile: no bleed at all, per the hierarchy rule. */
function TileDining({ s, t, onOpen }) {
  const openCount = DINING.filter((d) => d.open).length;
  return (
    <Glass s={s} t={t} radius={20} lift={0} onPress={onOpen}
      style={{ width: WIDE, marginBottom: GAP }}>
      <View style={s.tileUtility}>
        <View style={s.utilityHead}>
          <Image source={{ uri: IMG.dining }} style={s.diningThumb} resizeMode="cover" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.tileKicker}>DINING</Text>
            <Text style={s.utilityCount}>{openCount} open now</Text>
          </View>
        </View>
        {DINING.slice(0, 3).map((d) => (
          <View key={d.id} style={s.utilityLine}>
            <View style={[s.statusDot, { backgroundColor: d.open ? t.ok : t.textFaint }]} />
            <Text style={s.utilityName} numberOfLines={1}>{d.name}</Text>
            <Text style={s.utilityDist}>{d.dist}</Text>
          </View>
        ))}
      </View>
    </Glass>
  );
}

function TileOrgs({ s, t, onOpen }) {
  return (
    <Glass s={s} t={t} radius={20} bleed={1} bleedCorner="bottomLeft" onPress={onOpen}
      style={{ width: NARROW, marginBottom: GAP }}>
      <View style={s.tileTall}>
        <Text style={s.tileKicker}>ORGS</Text>
        <View style={s.markStack}>
          {ORGS.slice(0, 4).map((o, i) => (
            <View key={o.id} style={[s.orgMark, { marginLeft: i === 0 ? 0 : -11, zIndex: 10 - i }]}>
              <Text style={s.orgMarkText}>{o.initials}</Text>
            </View>
          ))}
        </View>
        <Text style={s.tileSub}>{ORGS.length * 58}+ active</Text>
      </View>
    </Glass>
  );
}

function TileStudy({ s, t, onOpen }) {
  return (
    <Glass s={s} t={t} radius={20} lift={0} bleed={0} onPress={onOpen}
      style={{ width: HALF, marginBottom: GAP }}>
      <View style={s.tileUtility}>
        <Text style={s.tileKicker}>STUDY SPACES</Text>
        {STUDY.map((x) => (
          <View key={x.id} style={{ marginTop: 9 }}>
            <Text style={s.utilityName} numberOfLines={1}>{x.name}</Text>
            <Text style={s.utilityFine}>{x.status}</Text>
          </View>
        ))}
      </View>
    </Glass>
  );
}

function TileArts({ s, t, ev, onOpen }) {
  return (
    <Glass s={s} t={t} radius={20} onPress={onOpen} style={{ width: HALF, marginBottom: GAP }}>
      <View style={{ height: 148 }}>
        <Image source={{ uri: IMG.library }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <PhotoOverlay strength={0.7} />
        <View style={s.tileTallPhoto}>
          <Text style={s.tileKickerPhoto}>ARTS & CULTURE</Text>
          <Text style={s.artsTitlePhoto} numberOfLines={2}>{ev.title}</Text>
          <Text style={s.tileSubPhoto}>{ev.date} · {ev.time}</Text>
        </View>
      </View>
    </Glass>
  );
}

function TileResources({ s, t, onOpen }) {
  return (
    <Glass s={s} t={t} radius={20} lift={0} bleed={0} onPress={onOpen}
      style={{ width: GRID_W, marginBottom: GAP }}>
      <View style={s.resourceInner}>
        <View style={{ flex: 1 }}>
          <Text style={s.tileKicker}>GET HELP</Text>
          <Text style={s.resourceLine}>Tutoring, writing, counseling, IT</Text>
        </View>
        <Icon id="chevron" size={16} color={t.textFaint} strokeWidth={2.2} />
      </View>
    </Glass>
  );
}

/* Expanded view — section 12: the tile becomes the focus in
   place, rather than navigating away. */
function CategoryModal({ s, t, kind, onClose }) {
  const { setDetailId, goToBuilding, setOrgDetailId } = useApp();
  if (!kind) return null;

  const titles = {
    tonight: 'Tonight', sports: 'Athletics', dining: 'Dining',
    orgs: 'Organizations', study: 'Study Spaces', arts: 'Arts & Culture', resources: 'Get Help',
  };
  const tonight = EVENTS.filter((e) => e.date === 'Today' && (toMinutes(e.time) ?? 0) >= 17 * 60);
  const arts = EVENTS.filter((e) => ['Arts', 'Music'].includes(e.category));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[s.categoryScreen, { backgroundColor: t.canvas }]}>
        <View style={s.categoryTopBar}>
          <Pressable onPress={onClose} hitSlop={12} style={s.categoryBack}>
            <Text style={s.categoryBackText}>‹</Text>
          </Pressable>
          <Text style={s.categoryHeaderTitle}>{titles[kind]}</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={s.categoryContent} showsVerticalScrollIndicator={false}>

          {/* TONIGHT — a timeline, since the whole point is "in what order" */}
          {kind === 'tonight' && (
            tonight.length ? tonight.map((e, i) => (
              <View key={e.id} style={s.timelineRow}>
                <View style={s.timelineGutter}><Text style={s.timelineTime}>{e.time}</Text></View>
                <View style={[s.timelineRail, { backgroundColor: t.red, opacity: i === 0 ? 1 : 0.3 }]} />
                <View style={{ flex: 1 }}>
                  <Glass s={s} t={t} radius={16} bleed={i === 0 ? 1 : 0} onPress={() => setDetailId(e.id)}>
                    <View style={s.timelineCard}>
                      <Text style={s.rowTitle}>{e.title}</Text>
                      <Text style={s.rowMeta}>{buildingById(e.buildingId)?.name}</Text>
                    </View>
                  </Glass>
                </View>
              </View>
            )) : (
              <Text style={s.emptyBody}>Nothing left tonight — check tomorrow in Discover.</Text>
            )
          )}

          {/* SPORTS — a scoreboard treatment, not a list row */}
          {kind === 'sports' && (
            <Glass s={s} t={t} radius={22} lift={2} bleed={1} bleedCorner="topRight"
              onPress={() => goToBuilding(SPORTS_NEXT.buildingId)}>
              <View style={s.scoreboardInner}>
                <Text style={s.tileKicker}>NEXT HOME GAME</Text>
                <View style={s.scoreboardRow}>
                  <View style={s.scoreboardSide}>
                    <Text style={s.scoreboardTeam}>TTU</Text>
                  </View>
                  <Text style={s.scoreboardVs}>VS</Text>
                  <View style={s.scoreboardSide}>
                    <Text style={s.scoreboardTeam} numberOfLines={2}>{SPORTS_NEXT.opponent}</Text>
                  </View>
                </View>
                <Text style={s.nextMeta}>{SPORTS_NEXT.when}</Text>
                <Text style={s.rowMeta}>{buildingById(SPORTS_NEXT.buildingId)?.name}</Text>
                <View style={s.noticeTag}><Text style={s.noticeTagText}>{SPORTS_NEXT.note.toUpperCase()}</Text></View>
              </View>
            </Glass>
          )}

          {/* DINING — utility list, status-first, no bleed */}
          {kind === 'dining' && DINING.map((d) => (
            <Row key={d.id} s={s} t={t} title={d.name} meta={`${d.status} · ${d.dist}`}
              onPress={() => goToBuilding(d.buildingId)}
              right={<View style={[s.statusDot, { backgroundColor: d.open ? t.ok : t.textFaint, marginLeft: 10 }]} />} />
          ))}

          {/* ORGS — a directory grid of marks, not a vertical list */}
          {kind === 'orgs' && (
            <View style={s.orgDirectory}>
              {ORGS.map((o) => (
                <Pressable key={o.id} onPress={() => setOrgDetailId(o.id)} style={s.orgDirTile}>
                  <View style={s.orgDirMark}><Text style={s.orgDirMarkText}>{o.initials}</Text></View>
                  <Text style={s.orgDirName} numberOfLines={2}>{o.name}</Text>
                  <Text style={s.orgDirTags} numberOfLines={1}>{o.tags}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* STUDY — availability-first utility, matches dining's register */}
          {kind === 'study' && STUDY.map((x) => (
            <Row key={x.id} s={s} t={t} title={x.name} meta={`${x.status} · ${x.seats}`}
              onPress={() => goToBuilding(x.buildingId)} />
          ))}

          {/* ARTS — editorial, one column, generous type */}
          {kind === 'arts' && (
            arts.length ? arts.map((e) => (
              <Pressable key={e.id} onPress={() => setDetailId(e.id)} style={s.artsEditorialRow}>
                <Text style={s.artsEditorialTitle}>{e.title}</Text>
                <Text style={s.artsEditorialMeta}>{e.date} · {e.time} · {buildingById(e.buildingId)?.name}</Text>
              </Pressable>
            )) : <Text style={s.emptyBody}>Nothing under Arts & Culture right now.</Text>
          )}

          {/* RESOURCES — plain, calm, no decoration, matches its tile */}
          {kind === 'resources' && RESOURCES.map((r) => (
            <Row key={r.id} s={s} t={t} title={r.name} meta={`${r.kind} · ${buildingById(r.buildingId)?.name}`}
              onPress={() => goToBuilding(r.buildingId)} />
          ))}

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function DiscoverScreen({ s, t }) {
  const {
    setDetailId, savedIds, toggleSave, setOrgDetailId, goToBuilding,
    discoverCategory: expanded, setDiscoverCategory: setExpanded,
  } = useApp();
  const [query, setQuery] = useState('');

  const tonightCount = EVENTS.filter((e) => e.date === 'Today' && (toMinutes(e.time) ?? 0) >= 17 * 60).length;
  const artsEvent = EVENTS.find((e) => e.category === 'Arts') || EVENTS.find((e) => e.category === 'Music');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return {
      events: allEvents().filter((e) => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)),
      orgs: ORGS.filter((o) => o.name.toLowerCase().includes(q)),
      places: BUILDINGS.filter((b) => b.name.toLowerCase().includes(q)),
    };
  }, [query]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenContent} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Discover</Text>

      <View style={s.search}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput style={s.searchInput} placeholder="Search events, places, organizations…"
          placeholderTextColor={t.textFaint} value={query} onChangeText={setQuery} />
      </View>

      {results ? (
        <View style={{ marginTop: 18 }}>
          {results.events.length ? (<><SectionLabel s={s}>EVENTS</SectionLabel>
            {results.events.map((e) => (
              <Row key={e.id} s={s} t={t} title={e.title}
                meta={`${e.date} · ${e.time} · ${buildingById(e.buildingId)?.name}`}
                onPress={() => setDetailId(e.id)} />
            ))}</>) : null}
          {results.orgs.length ? (<><SectionLabel s={s}>ORGANIZATIONS</SectionLabel>
            {results.orgs.map((o) => <Row key={o.id} s={s} t={t} title={o.name} meta={o.tags} onPress={() => setOrgDetailId(o.id)} />)}</>) : null}
          {results.places.length ? (<><SectionLabel s={s}>PLACES</SectionLabel>
            {results.places.map((b) => <Row key={b.id} s={s} t={t} title={b.name} meta={`${b.kind} · ${b.dist}`} onPress={() => goToBuilding(b.id)} />)}</>) : null}
          {!results.events.length && !results.orgs.length && !results.places.length ? (
            <Glass s={s} t={t}><View style={s.emptyInner}>
              <Text style={s.emptyTitle}>Nothing matched "{query}"</Text>
              <Text style={s.emptyBody}>Try a broader search, or ask Red.</Text>
            </View></Glass>
          ) : null}
        </View>
      ) : (
        <>
          <SectionLabel s={s}>FOR YOU</SectionLabel>
          <TileFeatured s={s} t={t} ev={FEATURED} saved={savedIds.has(FEATURED.id)}
            onToggleSave={() => toggleSave(FEATURED.id)} onOpen={() => setDetailId(FEATURED.id)} />

          <CategoryModal s={s} t={t} kind={expanded} onClose={() => setExpanded(null)} />

          <View style={s.gridRow}>
            <TileSports s={s} t={t} onOpen={() => setExpanded(expanded === 'sports' ? null : 'sports')} />
            <TileTonight s={s} t={t} count={tonightCount} onOpen={() => setExpanded(expanded === 'tonight' ? null : 'tonight')} />
          </View>

          <View style={s.gridRow}>
            <TileOrgs s={s} t={t} onOpen={() => setExpanded(expanded === 'orgs' ? null : 'orgs')} />
            <TileDining s={s} t={t} onOpen={() => setExpanded(expanded === 'dining' ? null : 'dining')} />
          </View>

          <View style={s.gridRow}>
            <TileStudy s={s} t={t} onOpen={() => setExpanded(expanded === 'study' ? null : 'study')} />
            {artsEvent ? (
              <TileArts s={s} t={t} ev={artsEvent} onOpen={() => setExpanded(expanded === 'arts' ? null : 'arts')} />
            ) : null}
          </View>

          <TileResources s={s} t={t} onOpen={() => setExpanded(expanded === 'resources' ? null : 'resources')} />
        </>
      )}
    </ScrollView>
  );
}

/* ============================================================
   CAMPUS — map is the innovation, glass floats above it
   ============================================================ */

const DRAWER_MIN = 220;
const DRAWER_MAX = SCREEN_H * 0.68;

function CampusScreen({ s, t }) {
  const { selectedBuildingId, setSelectedBuildingId } = useApp();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const h = useRef(new Animated.Value(DRAWER_MIN)).current;

  useEffect(() => {
    Animated.spring(h, { toValue: expanded ? DRAWER_MAX : DRAWER_MIN, useNativeDriver: false, damping: 20, stiffness: 130 }).start();
  }, [expanded]);

  const list = query.trim()
    ? BUILDINGS.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
    : BUILDINGS;
  const selected = buildingById(selectedBuildingId);
  const liveIds = new Set(EVENTS.filter((e) => e.live).map((e) => e.buildingId));

  return (
    <View style={{ flex: 1 }}>
      <View style={StyleSheet.absoluteFill}>
        {MapView ? (
          <MapView style={StyleSheet.absoluteFill}
            initialRegion={{ ...CAMPUS_CENTER, latitudeDelta: 0.014, longitudeDelta: 0.014 }}
            customMapStyle={t.mode === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
            region={selected ? { latitude: selected.lat, longitude: selected.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 } : undefined}>
            {BUILDINGS.map((b) => (
              <Marker key={b.id} coordinate={{ latitude: b.lat, longitude: b.lng }}
                title={b.name} description={liveIds.has(b.id) ? 'Happening now' : b.kind}
                pinColor={b.id === selectedBuildingId ? t.red : undefined}
                onPress={() => setSelectedBuildingId(b.id)} />
            ))}
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: 40 }]}>
            <Text style={s.emptyTitle}>Map needs a real device</Text>
            <Text style={s.emptyBody}>react-native-maps can't render in a web preview. Open in Expo Go.</Text>
          </View>
        )}
      </View>

      <SafeAreaView pointerEvents="box-none" style={s.campusTop}>
        <View style={[s.search, s.campusSearch]}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput style={s.searchInput} placeholder="Search buildings" placeholderTextColor={t.textFaint}
            value={query} onChangeText={setQuery} />
        </View>
      </SafeAreaView>

      <Animated.View style={[s.drawer, { height: h }]}>
        <Pressable onPress={() => setExpanded(!expanded)} style={s.drawerGrip}>
          <View style={s.drawerHandle} />
        </Pressable>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
          {selected ? (
            <Glass s={s} t={t} radius={18} lift={2} bleed={1} bleedCorner="bottomLeft" style={{ marginBottom: 14 }}>
              <View style={s.nextInner}>
                <Text style={s.sectionLabel}>SELECTED</Text>
                <Text style={s.nextTitle}>{selected.name}</Text>
                <Text style={s.nextMeta}>{selected.kind} · {selected.dist}</Text>
                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <Pressable style={s.primaryBtn} onPress={() => openDirections(selected)}>
                    <Text style={s.primaryBtnText}>Directions</Text>
                  </Pressable>
                  <Pressable style={s.ghostBtn} onPress={() => setSelectedBuildingId(null)}>
                    <Text style={s.ghostBtnText}>Clear</Text>
                  </Pressable>
                </View>
              </View>
            </Glass>
          ) : null}
          {list.map((b) => (
            <Row key={b.id} s={s} t={t} title={b.name} meta={`${b.kind} · ${b.dist}`}
              note={liveIds.has(b.id) ? 'Something happening now' : undefined}
              onPress={() => { setSelectedBuildingId(b.id); setExpanded(false); }} />
          ))}
          {!list.length ? (
            <Glass s={s} t={t}><View style={s.emptyInner}>
              <Text style={s.emptyTitle}>No match</Text>
            </View></Glass>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/* ============================================================
   SCHEDULE — deliberately conventional (section 16)
   ============================================================ */

/* A real line tracking the current time, inserted at its actual
   chronological position in the list — not a pixel-math overlay
   guessing at row heights. */
function NowMarker({ s, t }) {
  const now = new Date();
  const label = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={s.nowMarkerRow}>
      <View style={s.timelineGutter}>
        <Text style={[s.nowMarkerLabel, NUM]}>{label}</Text>
      </View>
      <View style={s.nowMarkerAxis}>
        <LiveDot color={t.red} size={5.5} />
      </View>
      <View style={s.nowMarkerLine} />
    </View>
  );
}

function ScheduleScreen({ s, t }) {
  const { scheduleItems, goToBuilding } = useApp();
  const [view, setView] = useState('Day');
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const sorted = [...scheduleItems].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  const week = [
    { d: 'M', n: '24', c: 4 }, { d: 'T', n: '25', c: 2 }, { d: 'W', n: '26', c: 5 },
    { d: 'T', n: '27', c: 3 }, { d: 'F', n: '28', c: 1 }, { d: 'S', n: '29', c: sorted.length }, { d: 'S', n: '30', c: 0 },
  ];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenContent} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Schedule</Text>
      <Text style={s.pageSub}>Saturday, August 30</Text>

      <View style={s.segment}>
        {['Day', 'Week'].map((v) => (
          <Pressable key={v} onPress={() => setView(v)} style={[s.segmentItem, view === v && { backgroundColor: t.red }]}>
            <Text style={[s.segmentText, view === v && { color: t.onRed }]}>{v}</Text>
          </Pressable>
        ))}
      </View>

      {view === 'Day' ? (
        <View style={{ marginTop: 18 }}>
          {(() => {
            const nowIdx = sorted.findIndex((i) => (toMinutes(i.time) ?? 0) >= nowM);
            const insertAt = nowIdx === -1 ? sorted.length : nowIdx;
            const rows = [];
            sorted.forEach((i, idx) => {
              if (idx === insertAt) rows.push({ kind: 'now-marker', id: 'now-marker' });
              rows.push({ kind: 'item', ...i });
            });
            if (insertAt === sorted.length) rows.push({ kind: 'now-marker', id: 'now-marker' });

            const subjectColor = (title) => {
              const prefix = (title || '').split(' ')[0];
              const map = { MATH: '#3F8F5C', CS: '#3F6B9C', CARS: '#C17A2E', TSI: '#7B5FA6' };
              return map[prefix] || t.textFaint;
            };
            const subjectPrefix = (title) => (title || '').split(' ')[0];

            return rows.map((row) => {
              if (row.kind === 'now-marker') return <NowMarker key="now-marker" s={s} t={t} />;
              const i = row;
              const start = toMinutes(i.time) ?? 0;
              const past = start < nowM;
              const isNext = !past && sorted.find((x) => (toMinutes(x.time) ?? 0) >= nowM)?.id === i.id;
              const subj = subjectColor(i.title);
              return (
                <View key={i.id} style={s.timelineRow}>
                  <View style={s.timelineGutter}>
                    <Text style={[s.timelineTime, past && { opacity: 0.4 }]}>{i.time}</Text>
                  </View>
                  <View style={[s.timelineRail, { backgroundColor: past ? t.border : t.red, opacity: past ? 1 : isNext ? 1 : 0.35 }]} />
                  <View style={{ flex: 1, opacity: past ? 0.45 : 1 }}>
                    <Glass s={s} t={t} radius={16} lift={isNext ? 1 : 0}
                      ring={isNext ? t.red : undefined} onPress={() => goToBuilding(i.buildingId)}>
                      <View style={[s.timelineCard, { flexDirection: 'row' }]}>
                        <View style={[s.subjectAccent, { backgroundColor: subj }]} />
                        <View style={{ flex: 1 }}>
                          <View style={s.timelineCardTop}>
                            <View style={[s.kindTag, { backgroundColor: subj }]}>
                              <Text style={s.kindTagText}>{subjectPrefix(i.title)}</Text>
                            </View>
                            {isNext ? <Text style={s.nowTag}>NEXT</Text> : null}
                          </View>
                          <Text style={s.rowTitle}>{i.title}</Text>
                          <Text style={s.rowMeta}>{i.place}</Text>
                        </View>
                      </View>
                    </Glass>
                  </View>
                </View>
              );
            });
          })()}
          {!sorted.length ? (
            <Glass s={s} t={t}><View style={s.emptyInner}>
              <Text style={s.emptyTitle}>Nothing scheduled</Text>
            </View></Glass>
          ) : null}
        </View>
      ) : (
        <View style={{ marginTop: 18 }}>
          <View style={s.weekRow}>
            {week.map((d) => (
              <View key={d.n} style={s.weekCol}>
                <Text style={s.weekDay}>{d.d}</Text>
                <View style={s.weekTrack}>
                  <View style={[s.weekFill, { height: Math.max(5, d.c * 14), backgroundColor: d.n === '30' ? t.red : t.borderStrong }]} />
                </View>
                <Text style={[s.weekNum, d.n === '30' && { color: t.red, fontWeight: '800' }]}>{d.n}</Text>
              </View>
            ))}
          </View>
          <Text style={s.weekCaption}>Taller bars are busier days.</Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ============================================================
   YOU — personal control centre (section 17)
   ============================================================ */

function YouScreen({ s, t, dark, setDark }) {
  const { interests, setInterests, savedIds, setDetailId, quietDay, setQuietDay, setInfoSheet } = useApp();
  const toggle = (i) => setInterests((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const saved = allEvents().filter((e) => savedIds.has(e.id));

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenContent} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>You</Text>

      <Glass s={s} t={t} radius={22} lift={2} bleed={1} bleedCorner="topRight">
        <View style={s.profileInner}>
          <Pressable onPress={() => setDark(!dark)} style={s.avatar}>
            <Text style={s.avatarText}>JT</Text>
          </Pressable>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.profileName}>Joshua Taylor</Text>
            <Text style={s.rowMeta}>Computer Science · Class of 2030</Text>
          </View>
          <Text style={s.avatarHint}>Tap for {dark ? 'light' : 'dark'}</Text>
        </View>
      </Glass>

      <SectionLabel s={s} action={saved.length ? 'Clear' : undefined}>SAVED</SectionLabel>
      {saved.length ? saved.map((e) => (
        <Row key={e.id} s={s} t={t} title={e.title}
          meta={`${e.date} · ${e.time} · ${buildingById(e.buildingId)?.name}`}
          onPress={() => setDetailId(e.id)} />
      )) : (
        <Glass s={s} t={t} lift={0}><View style={s.emptyInner}>
          <Text style={s.emptyBody}>Nothing saved yet. Tap the star on anything in Discover.</Text>
        </View></Glass>
      )}

      <SectionLabel s={s}>INTERESTS</SectionLabel>
      <View style={s.tagCloud}>
        {INTERESTS.map((i) => {
          const active = interests.includes(i);
          return (
            <Pressable key={i} onPress={() => toggle(i)} style={[s.tagChip, active && { backgroundColor: t.red, borderColor: t.red }]}>
              <View style={{ marginRight: 6 }}>
                <Icon id={i} size={15} color={active ? t.onRed : t.textMuted} strokeWidth={2} />
              </View>
              <Text style={[s.tagLabel, active && { color: t.onRed }]}>{i}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionLabel s={s}>PREFERENCES</SectionLabel>
      <Row s={s} t={t} title="Dark mode" meta={dark ? 'On' : 'Off'} onPress={() => setDark(!dark)}
        right={<View style={[s.toggle, dark && { backgroundColor: t.red, borderColor: t.red }]}>
          <View style={[s.toggleKnob, dark && { alignSelf: 'flex-end' }]} /></View>} />
      <Row s={s} t={t} title="Simulate a light day" meta="Demo control" onPress={() => setQuietDay(!quietDay)}
        right={<View style={[s.toggle, quietDay && { backgroundColor: t.red, borderColor: t.red }]}>
          <View style={[s.toggleKnob, quietDay && { alignSelf: 'flex-end' }]} /></View>} />

      <SectionLabel s={s}>SETTINGS</SectionLabel>
      <GroupedList s={s} t={t} items={
        ['Favorite places', 'Connected services', 'Notifications', 'Privacy & data', 'Help & feedback']
          .map((x) => ({ title: x, onPress: () => setInfoSheet(x) }))
      } />
      <Text style={s.versionText}>RaiderLoop · 0.7.0</Text>
    </ScrollView>
  );
}

/* ============================================================
   ASK RED — returns real RaiderLoop content (section 18)
   ============================================================ */

function AskRed({ s, t, onClose }) {
  const { goToBuilding, setDetailId, savedIds, toggleSave, setOrgDetailId, pendingRedQuestion, setPendingRedQuestion } = useApp();
  const [input, setInput] = useState('');
  const [thread, setThread] = useState([]);

  const ask = (text) => {
    const q = (text || input).trim();
    if (!q) return;
    const low = q.toLowerCase();
    const hit = RED_REPLIES.find((r) => r.match.some((m) => low.includes(m)));
    setThread((p) => [...p, { role: 'u', text: q }, { role: 'r', hit: hit || { text: "I don't have verified information on that yet." } }]);
    setInput('');
  };

  useEffect(() => {
    if (pendingRedQuestion) {
      ask(pendingRedQuestion);
      setPendingRedQuestion(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetBackdrop}>
        <BlurFill t={t} />
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheet}>
          <Bleed t={t} intensity={1} corner="topRight" />
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Ask Red</Text>
          <Text style={s.sheetSub}>Anything about campus.</Text>

          <ScrollView style={{ maxHeight: SCREEN_H * 0.42, marginTop: 16 }} showsVerticalScrollIndicator={false}>
            {thread.length === 0 ? RED_SUGGESTIONS.map((q) => (
              <Glass key={q} s={s} t={t} radius={15} lift={0} onPress={() => ask(q)} style={{ marginBottom: 8 }}>
                <View style={s.suggestInner}><Text style={s.suggestText}>{q}</Text></View>
              </Glass>
            )) : thread.map((m, i) => m.role === 'u' ? (
              <View key={i} style={s.bubble}><Text style={s.bubbleText}>{m.text}</Text></View>
            ) : (
              <View key={i} style={{ marginBottom: 14 }}>
                <Text style={s.redText}>{m.hit.text}</Text>
                {(m.hit.eventIds || []).map((id) => {
                  const e = eventById(id); if (!e) return null;
                  const sv = savedIds.has(e.id);
                  return (
                    <Glass key={id} s={s} t={t} radius={15} style={{ marginBottom: 8 }}>
                      <View style={s.redResult}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rowTitle}>{e.title}</Text>
                          <Text style={s.rowMeta}>{e.time} · {buildingById(e.buildingId)?.name}</Text>
                        </View>
                        <Pressable onPress={() => toggleSave(e.id)} hitSlop={10} style={{ marginRight: 14 }}>
                          <Icon id="starOutline" size={18} color={sv ? t.red : t.textFaint} strokeWidth={1.8} fill={sv ? t.red : 'none'} />
                        </Pressable>
                        <Pressable onPress={() => { onClose(); setDetailId(e.id); }} hitSlop={10}>
                          <Text style={s.redAction}>View</Text>
                        </Pressable>
                      </View>
                    </Glass>
                  );
                })}
                {(m.hit.buildingIds || []).map((id) => {
                  const b = buildingById(id); if (!b) return null;
                  return <Row key={id} s={s} t={t} title={b.name} meta={`${b.kind} · ${b.dist}`}
                    onPress={() => { onClose(); goToBuilding(id); }} />;
                })}
                {(m.hit.orgIds || []).map((id) => {
                  const o = ORGS.find((x) => x.id === id); if (!o) return null;
                  return <Row key={id} s={s} t={t} title={o.name} meta={o.tags}
                    onPress={() => { onClose(); setOrgDetailId(id); }} />;
                })}
                {(m.hit.resourceIds || []).map((id) => {
                  const r = RESOURCES.find((x) => x.id === id); if (!r) return null;
                  return <Row key={id} s={s} t={t} title={r.name} meta={r.kind}
                    onPress={() => { onClose(); goToBuilding(r.buildingId); }} />;
                })}
                {m.hit.buildingId ? (
                  <Row s={s} t={t} title={buildingById(m.hit.buildingId)?.name} meta="Take me there"
                    onPress={() => { onClose(); goToBuilding(m.hit.buildingId); }} />
                ) : null}
              </View>
            ))}
          </ScrollView>

          <View style={s.askRow}>
            <TextInput style={s.askInput} placeholder="Ask anything…" placeholderTextColor={t.textFaint}
              value={input} onChangeText={setInput} onSubmitEditing={() => ask()} returnKeyType="send" />
            <Pressable style={s.askSend} onPress={() => ask()}><Text style={s.askSendText}>↑</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ============================================================
   THE EVENT — one object, five contexts (section 14)
   ============================================================ */

function DetailSheet({ s, t }) {
  const { detailId, setDetailId, savedIds, toggleSave, addToSchedule, scheduleItems, goToBuilding } = useApp();
  const ev = eventById(detailId);
  if (!ev) return null;
  const b = buildingById(ev.buildingId);
  const saved = savedIds.has(ev.id);
  const added = scheduleItems.some((i) => i.id === `sch-${ev.id}`);
  const close = () => setDetailId(null);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={s.sheetBackdrop}>
        <BlurFill t={t} />
        <Pressable style={{ flex: 1 }} onPress={close} />
        <View style={s.sheet}>
          <Bleed t={t} intensity={ev.featured ? 2 : 1} corner="topRight" />
          <View style={s.sheetHandle} />
          <View style={s.detailMetaRow}>
            <Text style={s.detailOrg}>{ev.org}</Text>
            {ev.official ? <Text style={s.detailOfficial}>· Official</Text> : null}
          </View>
          <Text style={s.detailTitle}>{ev.title}</Text>
          <Text style={s.rowMeta}>{ev.date} · {ev.time} – {ev.endTime}</Text>
          <Text style={s.rowMeta}>{b?.name} · {ev.room}</Text>
          <Text style={s.detailBody}>{ev.desc}</Text>
          <View style={s.detailActions}>
            <Pressable style={added ? s.ghostBtn : s.primaryBtn} onPress={() => !added && addToSchedule(ev)}>
              <Text style={added ? s.ghostBtnText : s.primaryBtnText}>{added ? 'On your schedule' : 'Add to Schedule'}</Text>
            </Pressable>
            <Pressable style={s.ghostBtn} onPress={() => toggleSave(ev.id)}>
              <Text style={s.ghostBtnText}>{saved ? 'Saved' : 'Save'}</Text>
            </Pressable>
            <Pressable style={s.ghostBtn} onPress={() => goToBuilding(ev.buildingId)}>
              <Text style={s.ghostBtnText}>Navigate</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OrgDetail({ s, t }) {
  const { orgDetailId, setOrgDetailId, followedOrgIds, toggleFollow, setDetailId } = useApp();
  const org = ORGS.find((o) => o.id === orgDetailId);
  if (!org) return null;
  const following = followedOrgIds.has(org.id);
  const related = EVENTS.filter((e) => e.org === org.name);
  const close = () => setOrgDetailId(null);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={s.sheetBackdrop}>
        <BlurFill t={t} />
        <Pressable style={{ flex: 1 }} onPress={close} />
        <View style={s.sheet}>
          <Bleed t={t} intensity={1} corner="topRight" />
          <View style={s.sheetHandle} />
          <View style={s.orgHeadRow}>
            <View style={s.orgHeadMark}><Text style={s.orgHeadMarkText}>{org.initials}</Text></View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.detailTitle}>{org.name}</Text>
              <Text style={s.rowMeta}>{org.tags}</Text>
            </View>
          </View>
          <Text style={s.detailBody}>{org.reason}</Text>

          <Pressable
            style={following ? s.ghostBtn : s.primaryBtn}
            onPress={() => toggleFollow(org.id)}
          >
            <Text style={following ? s.ghostBtnText : s.primaryBtnText}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </Pressable>

          {related.length ? (
            <>
              <SectionLabel s={s}>UPCOMING FROM THIS ORG</SectionLabel>
              {related.map((e) => (
                <Row key={e.id} s={s} t={t} title={e.title}
                  meta={`${e.date} · ${e.time} · ${buildingById(e.buildingId)?.name}`}
                  onPress={() => { close(); setDetailId(e.id); }} />
              ))}
            </>
          ) : (
            <Text style={[s.rowMeta, { marginTop: 16 }]}>No upcoming events from this org right now.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* A generic, honest stand-in for settings that don't have a real
   backing implementation in this prototype yet. Tapping produces
   real feedback — a sheet with a plain description — rather than
   silence, which is worse than admitting a feature isn't built. */
function InfoSheet({ s, t }) {
  const { infoSheet, setInfoSheet } = useApp();
  const COPY = {
    'Favorite places': 'Places you star in Campus will collect here, so you can jump straight to them without searching.',
    'Connected services': 'This is where you\'d link a calendar or campus account so RaiderLoop can read your real schedule instead of the seeded one in this prototype.',
    'Notifications': 'Controls for what RaiderLoop can alert you about — a class starting soon, an event you saved, a campus update.',
    'Privacy & data': 'What RaiderLoop uses and why, in plain language, plus a way to delete your data.',
    'Help & feedback': 'A way to report something broken or suggest what RaiderLoop should do next.',
  };
  if (!infoSheet) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setInfoSheet(null)}>
      <View style={s.conflictBackdrop}>
        <BlurFill t={t} />
        <Glass s={s} t={t} radius={20} lift={2} style={{ width: SCREEN_W - 48 }}>
          <View style={{ padding: 22 }}>
            <Text style={s.conflictTitle}>{infoSheet}</Text>
            <Text style={s.rowMeta}>{COPY[infoSheet] || 'Not built out in this prototype yet.'}</Text>
            <Pressable style={[s.ghostBtn, { alignSelf: 'stretch', alignItems: 'center', marginTop: 16, marginRight: 0 }]}
              onPress={() => setInfoSheet(null)}>
              <Text style={s.ghostBtnText}>Close</Text>
            </Pressable>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

function ConflictPrompt({ s, t }) {
  const { conflict, setConflict, addToSchedule } = useApp();
  if (!conflict) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={s.conflictBackdrop}>
        <BlurFill t={t} />
        <Glass s={s} t={t} radius={20} lift={2} style={{ width: SCREEN_W - 48 }}>
          <View style={{ padding: 22 }}>
            <Text style={s.conflictTitle}>Schedule conflict</Text>
            <Text style={s.rowMeta}>
              "{conflict.incoming.title}" overlaps "{conflict.existing.title}" at {conflict.existing.time}.
            </Text>
            <Pressable style={[s.primaryBtn, { alignSelf: 'stretch', alignItems: 'center', marginTop: 18, marginRight: 0 }]}
              onPress={() => { addToSchedule(conflict.incoming, { force: true }); setConflict(null); }}>
              <Text style={s.primaryBtnText}>Add anyway</Text>
            </Pressable>
            <Pressable style={[s.ghostBtn, { alignSelf: 'stretch', alignItems: 'center', marginRight: 0 }]}
              onPress={() => setConflict(null)}>
              <Text style={s.ghostBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

function Onboarding({ s, t }) {
  const { setInterests, setOnboarded } = useApp();
  const [sel, setSel] = useState([]);
  const toggle = (i) => setSel((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  return (
    <View style={[s.screen, { padding: 26, justifyContent: 'center' }]}>
      <Text style={s.brandBig}>RAIDER<Text style={{ color: t.red }}>LOOP</Text></Text>
      <Text style={s.onboardTitle}>What are you into?</Text>
      <Text style={s.onboardSub}>This shapes what RaiderLoop shows you.</Text>
      <View style={[s.pillWrap, { marginTop: 24, marginBottom: 28 }]}>
        {INTERESTS.map((i) => <Pill key={i} s={s} t={t} label={i} active={sel.includes(i)} onPress={() => toggle(i)} />)}
      </View>
      <Pressable style={[s.primaryBtn, { alignSelf: 'stretch', alignItems: 'center', marginRight: 0 }]}
        onPress={() => { setInterests(sel.length ? sel : ['Campus Events']); setOnboarded(true); }}>
        <Text style={s.primaryBtnText}>{sel.length ? `Continue with ${sel.length}` : 'Skip for now'}</Text>
      </Pressable>
    </View>
  );
}

/* ============================================================
   SHELL — structural navigation stays predictable (section 19)
   ============================================================ */

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'discover', label: 'Discover' },
  { id: 'campus', label: 'Campus' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'you', label: 'You' },
];

/* Ask Red should feel active across every screen, per the
   feedback — a soft pulsing ring rather than a static pill. */
function AskRedFab({ s, t, onPress }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, {
      toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, []);
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.5, 0.4, 0] });

  return (
    <View style={s.redFabWrap} pointerEvents="box-none">
      <Animated.View style={[s.redFabRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
      <Pressable style={s.redFab} onPress={onPress}>
        <View style={s.redFabDot} />
        <Text style={s.redFabText}>Ask Red</Text>
      </Pressable>
    </View>
  );
}

function Shell({ s, t, dark, setDark }) {
  const { tab, setTab, onboarded, detailId, conflict, redOpen, setRedOpen, orgDetailId, infoSheet } = useApp();
  if (!onboarded) {
    return <SafeAreaView style={[s.root, { backgroundColor: t.canvas }]}><Onboarding s={s} t={t} /></SafeAreaView>;
  }
  return (
    <SafeAreaView style={[s.root, { backgroundColor: t.canvas }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen s={s} t={t} />}
        {tab === 'discover' && <DiscoverScreen s={s} t={t} />}
        {tab === 'campus' && <CampusScreen s={s} t={t} />}
        {tab === 'schedule' && <ScheduleScreen s={s} t={t} />}
        {tab === 'you' && <YouScreen s={s} t={t} dark={dark} setDark={setDark} />}
      </View>

      <AskRedFab s={s} t={t} onPress={() => setRedOpen(true)} />

      <View style={s.navWrap}>
        <View style={s.nav}>
          <BlurFill t={t} style={s.navBlurFill} />
          {TABS.map((x) => {
            const active = tab === x.id;
            return (
              <Pressable key={x.id} style={s.navItem} onPress={() => setTab(x.id)}>
                <TabGlyph t={t} id={x.id} active={active} />
                <Text style={[s.navLabel, active && { color: t.red, fontWeight: '700' }]}>{x.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {redOpen ? <AskRed s={s} t={t} onClose={() => setRedOpen(false)} /> : null}
      {detailId ? <DetailSheet s={s} t={t} /> : null}
      {orgDetailId ? <OrgDetail s={s} t={t} /> : null}
      {infoSheet ? <InfoSheet s={s} t={t} /> : null}
      {conflict ? <ConflictPrompt s={s} t={t} /> : null}
    </SafeAreaView>
  );
}

export default function Index() {
  const [dark, setDark] = useState(true); // dark is now the default theme
  const t = dark ? darkTheme : lightTheme;
  const s = useMemo(() => makeStyles(t), [t]);
  return <AppProvider><Shell s={s} t={t} dark={dark} setDark={setDark} /></AppProvider>;
}

/* ============================================================
   STYLES
   ============================================================ */

function makeStyles(t) {
  return StyleSheet.create({
    root: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    screen: { flex: 1 },
    screenContent: { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 168 },

    /* HOME */
    greetRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
    greeting: { fontSize: 27, fontWeight: '700', color: t.text, letterSpacing: -0.6, lineHeight: 33 },
    greetingLight: { fontWeight: '300', color: t.textMuted },
    weatherInline: { alignItems: 'flex-end', paddingTop: 4 },
    weatherTemp: { fontSize: 26, fontWeight: '300', color: t.text, letterSpacing: -1, ...NUM },
    weatherMeta: { fontSize: 12, color: t.textMuted, marginTop: -2 },
    weatherCity: { fontSize: 11, color: t.textFaint, marginTop: 1 },

    nextInner: { padding: 20 },
    nextTitle: { fontSize: 21, fontWeight: '700', color: t.text, letterSpacing: -0.4 },
    nextMeta: { fontSize: 14, color: t.textMuted, marginTop: 5 },
    heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 },
    heroMeta: { fontSize: 14, color: 'rgba(255,255,255,0.88)', marginTop: 5 },
    heroWalkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    heroWalkText: { fontSize: 12.5, color: 'rgba(255,255,255,0.8)', fontWeight: '600', ...NUM },
    heroCountdownRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },

    quickActionsRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
    quickAction: {
      flex: 1, alignItems: 'center', backgroundColor: t.surface, borderRadius: 14,
      borderWidth: 0.5, borderColor: t.border, paddingVertical: 12,
      shadowColor: t.shadow, shadowOpacity: t.shadowOpacity * 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    },
    quickActionText: { fontSize: 11, fontWeight: '700', color: t.text, marginTop: 6 },

    redChipWrap: { marginTop: 4 },
    redChip: {
      backgroundColor: t.surface, borderRadius: 14, borderWidth: 0.5, borderColor: t.border,
      paddingVertical: 13, paddingHorizontal: 16, marginBottom: 9,
      shadowColor: t.shadow, shadowOpacity: t.shadowOpacity * 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    },
    redChipText: { fontSize: 14, color: t.text, fontWeight: '500' },
    heroCountdown: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', ...NUM },
    nextChipRow: { flexDirection: 'row', marginTop: 16 },
    nextChipLight: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 11, paddingVertical: 9, paddingHorizontal: 16, marginRight: 9 },
    nextChipLightText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 },

    dayLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 },
    dayLineDivider: { borderBottomWidth: 1, borderBottomColor: t.border },
    dayTime: { width: 74, fontSize: 12.5, fontWeight: '700', color: t.textMuted, letterSpacing: 0.2 },
    dayTitle: { fontSize: 14.5, fontWeight: '600', color: t.text },
    dayPlace: { fontSize: 12, color: t.textFaint, marginTop: 2 },

    timeChip: {
      width: 52, height: 52, borderRadius: 13, backgroundColor: t.surfaceAlt,
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
      borderWidth: 1, borderColor: t.border,
    },
    timeChipTime: { fontSize: 12.5, fontWeight: '800', color: t.text, letterSpacing: -0.2 },

    updateInner: { padding: 18 },
    updateTitle: { fontSize: 15, fontWeight: '700', color: t.text },
    updateBody: { fontSize: 13.5, color: t.textMuted, marginTop: 5, lineHeight: 19 },
    updateSource: { fontSize: 11, color: t.textFaint, marginTop: 10, fontWeight: '600', letterSpacing: 0.3 },

    /* SHARED */
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 11 },
    sectionLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.5, color: t.textFaint },
    sectionAction: { fontSize: 13, color: t.red, fontWeight: '600' },
    pageTitle: { fontSize: 30, fontWeight: '700', color: t.text, letterSpacing: -0.8, marginBottom: 4 },
    pageSub: { fontSize: 14.5, color: t.textMuted, marginBottom: 18 },
    brandBig: { fontSize: 17, fontWeight: '800', letterSpacing: 2, color: t.text, marginBottom: 30 },

    rowInner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
    groupedList: { borderRadius: 18, backgroundColor: t.surface, overflow: 'hidden', borderWidth: 0.5, borderColor: t.border },
    groupedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
    groupedRowDivider: { borderBottomWidth: 0.5, borderBottomColor: t.border },
    rowTitle: { fontSize: 15, fontWeight: '600', color: t.text },
    rowMeta: { fontSize: 13, color: t.textMuted, marginTop: 3, lineHeight: 18 },
    rowNote: { fontSize: 12, color: t.red, marginTop: 5, fontWeight: '600' },

    search: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surfaceAlt, borderRadius: 15, borderWidth: 1, borderColor: t.border, paddingHorizontal: 14, height: 48 },
    searchIcon: { fontSize: 17, color: t.textFaint, marginRight: 9 },
    searchInput: { flex: 1, fontSize: 15, color: t.text, padding: 0 },
    pill: { borderRadius: 999, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, paddingHorizontal: 15, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
    pillText: { fontSize: 13, color: t.text, fontWeight: '600' },
    pillWrap: { flexDirection: 'row', flexWrap: 'wrap' },

    /* GRID */
    gridRow: { flexDirection: 'row', justifyContent: 'space-between' },
    tileKicker: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4, color: t.textFaint },
    tileIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tileSub: { fontSize: 12, color: t.textMuted, marginTop: 6 },
    tileTall: { padding: 16, minHeight: 138, justifyContent: 'space-between' },
    tileUtility: { padding: 16, minHeight: 138 },

    featInner: { padding: 20, minHeight: 200, justifyContent: 'flex-end' },
    featTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    featEyebrow: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.3, color: t.red },
    featEyebrowPhoto: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.3, color: '#FFFFFF' },
    featTitle: { fontSize: 28, fontWeight: '700', color: t.text, letterSpacing: -0.9, marginTop: 18, lineHeight: 32 },
    featTitlePhoto: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.7, marginTop: 10, lineHeight: 30 },
    featMeta: { fontSize: 14, color: t.textMuted, marginTop: 6 },
    featMetaPhoto: { fontSize: 13.5, color: 'rgba(255,255,255,0.85)', marginTop: 5 },
    featTag: { alignSelf: 'flex-start', marginTop: 14, backgroundColor: t.red, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
    featTagText: { color: t.onRed, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.red, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginRight: 6 },
    liveBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800', letterSpacing: 1 },

    tileTallPhoto: { flex: 1, padding: 15, justifyContent: 'flex-end' },
    tileKickerPhoto: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4, color: 'rgba(255,255,255,0.75)' },
    tileSubPhoto: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
    sportsUsPhoto: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 },
    sportsVsPhoto: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginHorizontal: 7, fontWeight: '600' },
    sportsThemPhoto: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2, flexShrink: 1 },
    artsTitlePhoto: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 8, letterSpacing: -0.3, lineHeight: 20 },
    diningThumb: { width: 40, height: 40, borderRadius: 10 },

    bigNumber: { fontSize: 46, fontWeight: '300', color: t.text, letterSpacing: -2.5, marginTop: 4, ...NUM },
    sportsRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8, flexWrap: 'wrap' },
    sportsUs: { fontSize: 22, fontWeight: '800', color: t.red, letterSpacing: -0.5 },
    sportsVs: { fontSize: 12, color: t.textFaint, marginHorizontal: 8, fontWeight: '600' },
    sportsThem: { fontSize: 17, fontWeight: '600', color: t.text, letterSpacing: -0.3, flexShrink: 1 },
    sportsNote: { fontSize: 11.5, color: t.red, fontWeight: '700', marginTop: 6 },

    utilityHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    utilityCount: { fontSize: 10.5, fontWeight: '700', color: t.ok, marginTop: 2 },
    utilityLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 9 },
    utilityName: { flex: 1, fontSize: 13, color: t.text, fontWeight: '500' },
    utilityDist: { fontSize: 11.5, color: t.textFaint, marginLeft: 8 },
    utilityFine: { fontSize: 11.5, color: t.textMuted, marginTop: 2 },

    markStack: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    orgMark: {
      width: 32, height: 32, borderRadius: 16, backgroundColor: t.surfaceAlt,
      borderWidth: 1.5, borderColor: t.surface, alignItems: 'center', justifyContent: 'center',
    },
    orgMarkText: { fontSize: 10.5, fontWeight: '800', color: t.textMuted },
    artsTitle: { fontSize: 16, fontWeight: '700', color: t.text, marginTop: 10, letterSpacing: -0.3, lineHeight: 20 },

    /* SCHEDULE: now-marker + kind tags */
    nowMarkerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
    nowMarkerLabel: { fontSize: 10.5, fontWeight: '800', color: t.red, letterSpacing: 0.3, ...NUM },
    nowMarkerAxis: { width: 14.5, alignItems: 'center', justifyContent: 'center' },
    nowMarkerLine: { flex: 1, height: 1.5, backgroundColor: t.red, opacity: 0.5 },
    timelineCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    kindTag: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, marginRight: 8 },
    kindTagText: { fontSize: 8.5, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.8 },


    resourceInner: { flexDirection: 'row', alignItems: 'center', padding: 18 },
    resourceLine: { fontSize: 14, color: t.text, fontWeight: '600', marginTop: 5 },

    expandHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 12 },
    expandTitle: { fontSize: 19, fontWeight: '700', color: t.text, letterSpacing: -0.4 },
    expandClose: { fontSize: 13, color: t.red, fontWeight: '600' },

    /* CATEGORY MODAL — a real full-screen destination */
    categoryScreen: { flex: 1 },
    categoryTopBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12, paddingTop: Platform.OS === 'android' ? 10 : 4, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: t.border,
    },
    categoryBack: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    categoryBackText: { fontSize: 28, color: t.text, fontWeight: '300', marginTop: -3 },
    categoryHeaderTitle: { fontSize: 17, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
    categoryContent: { padding: PAD, paddingBottom: 60 },

    /* Sports — scoreboard */
    scoreboardInner: { padding: 22 },
    scoreboardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 14 },
    scoreboardSide: { flex: 1, alignItems: 'center' },
    scoreboardTeam: { fontSize: 19, fontWeight: '800', color: t.text, letterSpacing: -0.4, textAlign: 'center' },
    scoreboardVs: { fontSize: 12, fontWeight: '700', color: t.textFaint, marginHorizontal: 14 },
    noticeTag: { alignSelf: 'flex-start', marginTop: 14, backgroundColor: t.red, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
    noticeTagText: { color: t.onRed, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },

    /* Orgs — a directory grid */
    orgDirectory: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    orgDirTile: { width: HALF, marginBottom: 20, alignItems: 'flex-start' },
    orgDirMark: { width: 46, height: 46, borderRadius: 23, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
    orgDirMarkText: { fontSize: 13, fontWeight: '800', color: t.textMuted },
    orgDirName: { fontSize: 13.5, fontWeight: '600', color: t.text, lineHeight: 17 },
    orgDirTags: { fontSize: 11.5, color: t.textFaint, marginTop: 3 },

    /* Arts — editorial */
    artsEditorialRow: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: t.border },
    artsEditorialTitle: { fontSize: 20, fontWeight: '700', color: t.text, letterSpacing: -0.4, lineHeight: 25 },
    artsEditorialMeta: { fontSize: 13, color: t.textMuted, marginTop: 6 },

    /* CAMPUS */
    campusTop: { position: 'absolute', top: 0, left: 0, right: 0 },
    campusSearch: { margin: 16, backgroundColor: t.surface, shadowColor: t.shadow, shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
    drawer: {
      position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.canvas,
      borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18,
      shadowColor: t.shadow, shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 12,
    },
    drawerGrip: { paddingVertical: 12, alignItems: 'center' },
    drawerHandle: { width: 42, height: 4.5, borderRadius: 3, backgroundColor: t.borderStrong },

    /* SCHEDULE */
    segment: { flexDirection: 'row', backgroundColor: t.surfaceAlt, borderRadius: 13, padding: 4, borderWidth: 1, borderColor: t.border },
    segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
    segmentText: { fontSize: 13.5, fontWeight: '600', color: t.textMuted },
    timelineRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 10 },
    timelineGutter: { width: 66, paddingTop: 15 },
    timelineTime: { fontSize: 12, fontWeight: '700', color: t.textMuted, ...NUM },
    timelineRail: { width: 2.5, borderRadius: 2, marginRight: 12 },
    timelineCard: { padding: 14, paddingLeft: 0 },
    subjectAccent: { width: 4, alignSelf: 'stretch', marginLeft: 0, marginRight: 12, borderRadius: 2 },
    nowTag: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: t.red, marginBottom: 5 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    weekCol: { alignItems: 'center', flex: 1 },
    weekDay: { fontSize: 10, fontWeight: '800', color: t.textFaint, marginBottom: 8 },
    weekTrack: { height: 76, justifyContent: 'flex-end' },
    weekFill: { width: 7, borderRadius: 4 },
    weekNum: { fontSize: 12.5, fontWeight: '600', color: t.textMuted, marginTop: 8 },
    weekCaption: { fontSize: 12, color: t.textFaint, textAlign: 'center', marginTop: 18 },

    /* YOU */
    profileInner: { flexDirection: 'row', alignItems: 'center', padding: 20 },
    avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: t.red, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: t.onRed, fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
    avatarHint: { fontSize: 10.5, color: t.textFaint, fontWeight: '600' },
    tagCloud: { flexDirection: 'row', flexWrap: 'wrap' },
    tagChip: {
      flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: t.borderStrong,
      backgroundColor: t.surface, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8, marginBottom: 8,
    },
    tagLabel: { fontSize: 13, color: t.text, fontWeight: '600' },
    profileName: { fontSize: 19, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
    toggle: { width: 46, height: 27, borderRadius: 999, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.borderStrong, padding: 3, justifyContent: 'center' },
    toggleKnob: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#FFFFFF' },
    versionText: { fontSize: 12, color: t.textFaint, textAlign: 'center', marginTop: 30 },

    /* BUTTONS */
    primaryBtn: { backgroundColor: t.red, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18, marginRight: 8, marginTop: 8 },
    primaryBtnText: { color: t.onRed, fontWeight: '700', fontSize: 13.5 },
    ghostBtn: { borderRadius: 12, borderWidth: 1, borderColor: t.borderStrong, paddingVertical: 11, paddingHorizontal: 18, marginRight: 8, marginTop: 8 },
    ghostBtnText: { color: t.text, fontWeight: '600', fontSize: 13.5 },

    /* SHEETS */
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
    sheet: { backgroundColor: t.canvas, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: Platform.OS === 'ios' ? 34 : 22, overflow: 'hidden' },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: t.borderStrong, alignSelf: 'center', marginBottom: 18 },
    sheetTitle: { fontSize: 22, fontWeight: '700', color: t.text, letterSpacing: -0.4 },
    sheetSub: { fontSize: 13.5, color: t.textMuted, marginTop: 4 },
    detailMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    orgHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    orgHeadMark: { width: 50, height: 50, borderRadius: 25, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center' },
    orgHeadMarkText: { fontSize: 15, fontWeight: '800', color: t.textMuted },
    detailOrg: { fontSize: 11.5, fontWeight: '700', color: t.textMuted, letterSpacing: 0.3 },
    detailOfficial: { fontSize: 11.5, fontWeight: '700', color: t.red, marginLeft: 4 },
    detailTitle: { fontSize: 24, fontWeight: '700', color: t.text, letterSpacing: -0.6, marginBottom: 8 },
    detailBody: { fontSize: 14.5, color: t.textMuted, lineHeight: 21, marginTop: 14 },
    detailActions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },

    suggestInner: { padding: 14 },
    suggestText: { fontSize: 14.5, color: t.text },
    bubble: { alignSelf: 'flex-end', backgroundColor: t.red, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 10, marginBottom: 12, maxWidth: '85%' },
    bubbleText: { color: t.onRed, fontSize: 14.5 },
    redText: { fontSize: 15, color: t.text, marginBottom: 10, lineHeight: 21 },
    redResult: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15 },
    redAction: { fontSize: 13, fontWeight: '700', color: t.red },
    askRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
    askInput: { flex: 1, backgroundColor: t.surface, borderRadius: 15, borderWidth: 1, borderColor: t.borderStrong, paddingHorizontal: 16, height: 48, fontSize: 15, color: t.text, marginRight: 9 },
    askSend: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.red, alignItems: 'center', justifyContent: 'center' },
    askSendText: { color: t.onRed, fontSize: 20, fontWeight: '700' },

    /* MISC */
    emptyInner: { padding: 24, alignItems: 'center' },
    emptyTitle: { fontSize: 15, fontWeight: '600', color: t.text, textAlign: 'center' },
    emptyBody: { fontSize: 13.5, color: t.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
    conflictBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center' },
    conflictTitle: { fontSize: 18, fontWeight: '700', color: t.text, marginBottom: 8 },
    onboardTitle: { fontSize: 27, fontWeight: '700', color: t.text, letterSpacing: -0.6 },
    onboardSub: { fontSize: 15, color: t.textMuted, marginTop: 8, lineHeight: 21 },

    /* ASK RED FAB + NAV */
    redFabWrap: { position: 'absolute', bottom: 104, right: 20, alignItems: 'center', justifyContent: 'center' },
    redFabRing: {
      position: 'absolute', width: 120, height: 52, borderRadius: 26,
      backgroundColor: t.red,
    },
    redFab: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.red, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999,
      shadowColor: t.red, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 9,
    },
    redFabDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.onRed, marginRight: 8 },
    redFabText: { color: t.onRed, fontWeight: '700', fontSize: 13.5 },

    navWrap: { paddingHorizontal: 14, paddingBottom: Platform.OS === 'ios' ? 26 : 14, paddingTop: 4 },
    nav: {
      flexDirection: 'row', backgroundColor: t.mode === 'dark' ? 'rgba(29,26,27,0.72)' : 'rgba(255,255,255,0.72)',
      borderRadius: 24, borderWidth: 1, borderColor: t.border, overflow: 'hidden',
      paddingTop: 10, paddingBottom: 10,
      shadowColor: t.shadow, shadowOpacity: t.shadowOpacity * 1.6, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
    },
    navBlurFill: { ...StyleSheet.absoluteFillObject },
    navItem: { flex: 1, alignItems: 'center' },
    navLabel: { fontSize: 9.5, color: t.textFaint, marginTop: 4, fontWeight: '600' },
  });
}
