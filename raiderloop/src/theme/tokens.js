/**
 * Flyer design tokens
 * ------------------------------------------------------------
 * Light = "Notebook": cream paper, blue ruled lines, a red margin,
 * navy ink. Dark = "Chalkboard": slate green board, chalk-white
 * text. Post-it notes stay paper-colored in both modes (with dark
 * ink on top), because that's what a sticky note on a chalkboard
 * actually looks like — and it keeps text contrast high either way.
 *
 * Palette is deliberately NOT scarlet-and-black: Flyer's identity is
 * ink blue + highlighter yellow, so it can never read as a copy of
 * any one school's brand.
 */
import { Dimensions, Platform } from 'react-native';

export const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
export const PAD = 18;

export const POSTIT_KEYS = ['yellow', 'pink', 'blue', 'green', 'orange', 'lavender'];

const notebook = {
  mode: 'light',
  paper: '#FBF7EC',
  paperDeep: '#F3EBD8',
  card: '#FFFDF7',
  rule: '#CFE0F2',
  margin: '#F2B3AD',
  ink: '#1F2A44',
  inkSoft: '#4B5571',
  pencil: '#7D786B',
  faint: '#AFA898',
  accent: '#2F5DA8', // ink blue
  accentInk: '#FFFFFF',
  highlight: '#FFE45C',
  redPen: '#C8413B',
  ok: '#2E8256',
  warn: '#B7791F',
  border: 'rgba(31,42,68,0.16)',
  borderStrong: 'rgba(31,42,68,0.32)',
  shadow: '#6B5A35',
  tabBar: '#FFFDF7',
  postit: {
    yellow: '#FFEB85', pink: '#FFC8D5', blue: '#BFE3F8', green: '#CDEDB5', orange: '#FFD3A1', lavender: '#DED0F6',
  },
  postitInk: '#1F2A44',
  postitInkSoft: '#4B5571',
  tape: 'rgba(255,255,255,0.55)',
  mapStyle: [
    { elementType: 'geometry', stylers: [{ color: '#FBF7EC' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#4B5571' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#FBF7EC' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#EFE5CF' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#DCEBCB' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE0F2' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
};

const chalkboard = {
  mode: 'dark',
  paper: '#1E2A25',
  paperDeep: '#17201C',
  card: '#26342E',
  rule: 'rgba(255,255,255,0.045)',
  margin: 'rgba(255,138,128,0.22)',
  ink: '#F4F1E6',
  inkSoft: '#CFCBBD',
  pencil: '#9EA79F',
  faint: '#6F7A73',
  accent: '#9CCBFF',
  accentInk: '#14211C',
  highlight: '#F3E36A',
  redPen: '#FF8A80',
  ok: '#8FD6A8',
  warn: '#F2C46D',
  border: 'rgba(255,255,255,0.14)',
  borderStrong: 'rgba(255,255,255,0.3)',
  shadow: '#000000',
  tabBar: '#26342E',
  postit: {
    yellow: '#F1DE78', pink: '#EDB6C3', blue: '#A9D2EA', green: '#B8DCA1', orange: '#EDC08F', lavender: '#CBBBEA',
  },
  postitInk: '#1F2A44',
  postitInkSoft: '#3E4862',
  tape: 'rgba(255,255,255,0.28)',
  mapStyle: [
    { elementType: 'geometry', stylers: [{ color: '#1E2A25' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#CFCBBD' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1E2A25' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2C3B34' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#24362C' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1A2E3A' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
};

export const THEMES = { light: notebook, dark: chalkboard };

/* Fonts load via expo-font in App.js; until they're ready every
   style falls back to the system font, so nothing is ever invisible. */
export const FONTS = {
  body: 'Nunito_500Medium',
  bodyBold: 'Nunito_700Bold',
  bodyHeavy: 'Nunito_800ExtraBold',
  hand: 'Caveat_600SemiBold',
  handBold: 'Caveat_700Bold',
  marker: 'PermanentMarker_400Regular',
};
export const SYSTEM_FONTS = { body: undefined, bodyBold: undefined, bodyHeavy: undefined, hand: undefined, handBold: undefined, marker: undefined };

export function fontSet(loaded) { return loaded ? FONTS : SYSTEM_FONTS; }

/* Stable pseudo-random tilt per id, so a card doesn't wobble to a
   new angle every re-render. */
export function tiltFor(key, max = 1.6) {
  let h = 0; const s = String(key);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000 * 2 - 1) * max;
}
export function postitFor(key) {
  let h = 7; const s = String(key);
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return POSTIT_KEYS[Math.abs(h) % POSTIT_KEYS.length];
}

export const shadow = (t, depth = 1) => Platform.select({
  ios: { shadowColor: t.shadow, shadowOpacity: t.mode === 'dark' ? 0.45 : 0.16 + depth * 0.04, shadowRadius: 3 + depth * 3, shadowOffset: { width: 0, height: 1 + depth * 2 } },
  android: { elevation: 1 + depth * 2 },
  default: {},
});
