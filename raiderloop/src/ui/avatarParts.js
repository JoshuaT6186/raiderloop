/**
 * Avatar options. Everything is a small, original doodle — no
 * logos, no team marks, no copyrighted characters. Stored as a plain
 * config object so it can sync to Firestore for friends to see.
 */

export const SKIN = ['#FDE3CF', '#F6CFAE', '#EBB68E', '#D49B6B', '#B77B4F', '#8F5B37', '#6C4328', '#4A2F1D'];
export const HAIR_COLORS = ['#1F1B1A', '#3B2A20', '#6B4428', '#8E3B22', '#D8B25A', '#EDE3C8', '#B3472B', '#3D6FD1', '#E58BB2', '#7E5BC2', '#3F9B6B', '#9A9A9A'];
export const SHIRT_COLORS = ['#2F5DA8', '#1F2A44', '#C8413B', '#2E8256', '#F2A541', '#7E5BC2', '#E58BB2', '#FFFFFF', '#8A8577', '#3BA7A0'];

export const HAIR_STYLES = [
  { id: 'none', label: 'Bald' }, { id: 'buzz', label: 'Buzz' }, { id: 'short', label: 'Short' },
  { id: 'side', label: 'Side part' }, { id: 'curly', label: 'Curly' }, { id: 'afro', label: 'Afro' },
  { id: 'long', label: 'Long' }, { id: 'bob', label: 'Bob' }, { id: 'bun', label: 'Bun' },
  { id: 'ponytail', label: 'Ponytail' }, { id: 'braids', label: 'Braids' }, { id: 'locs', label: 'Locs' },
];
export const EYES = [
  { id: 'dots', label: 'Classic' }, { id: 'happy', label: 'Happy' }, { id: 'wink', label: 'Wink' },
  { id: 'sleepy', label: 'Sleepy' }, { id: 'wide', label: 'Wide' }, { id: 'stars', label: 'Starry' },
];
export const MOUTHS = [
  { id: 'smile', label: 'Smile' }, { id: 'grin', label: 'Grin' }, { id: 'open', label: 'Wow' },
  { id: 'smirk', label: 'Smirk' }, { id: 'flat', label: 'Chill' }, { id: 'tongue', label: 'Silly' },
];
export const FACIAL_HAIR = [
  { id: 'none', label: 'None' }, { id: 'stubble', label: 'Stubble' }, { id: 'mustache', label: 'Mustache' },
  { id: 'beard', label: 'Beard' }, { id: 'goatee', label: 'Goatee' },
];
export const ACCESSORIES = [
  { id: 'none', label: 'None' }, { id: 'round', label: 'Round glasses' }, { id: 'square', label: 'Square glasses' },
  { id: 'shades', label: 'Shades' }, { id: 'headphones', label: 'Headphones' }, { id: 'earrings', label: 'Earrings' },
];
export const HATS = [
  { id: 'none', label: 'None' }, { id: 'cap', label: 'Cap' }, { id: 'beanie', label: 'Beanie' },
  { id: 'cowboy', label: 'Cowboy' }, { id: 'bucket', label: 'Bucket' }, { id: 'grad', label: 'Grad cap', plus: true },
];
export const SHIRTS = [
  { id: 'tee', label: 'Tee' }, { id: 'hoodie', label: 'Hoodie' }, { id: 'collar', label: 'Collar' }, { id: 'jersey', label: 'Jersey', plus: true },
];
export const BACKGROUNDS = ['yellow', 'pink', 'blue', 'green', 'orange', 'lavender'];

export const DEFAULT_AVATAR = {
  skin: SKIN[2], hair: 'short', hairColor: HAIR_COLORS[1], eyes: 'dots', mouth: 'smile', facialHair: 'none',
  accessory: 'none', hat: 'none', shirt: 'hoodie', shirtColor: SHIRT_COLORS[0], bg: 'yellow', blush: true, number: '26',
};

export function randomAvatar() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return {
    ...DEFAULT_AVATAR,
    skin: pick(SKIN), hair: pick(HAIR_STYLES).id, hairColor: pick(HAIR_COLORS.slice(0, 8)),
    eyes: pick(EYES).id, mouth: pick(MOUTHS.slice(0, 5)).id, facialHair: Math.random() < 0.2 ? pick(FACIAL_HAIR).id : 'none',
    accessory: Math.random() < 0.35 ? pick(ACCESSORIES).id : 'none', hat: Math.random() < 0.25 ? pick(HATS.slice(0, 5)).id : 'none',
    shirt: pick(SHIRTS.slice(0, 3)).id, shirtColor: pick(SHIRT_COLORS), bg: pick(BACKGROUNDS),
  };
}
