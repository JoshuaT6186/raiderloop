/**
 * Seasonal app icons (fall leaves, winter lights, New Year fireworks,
 * Valentine's hearts, St. Patrick's shamrocks). iOS shows a small
 * "You have changed the icon" alert whenever an app changes its icon,
 * so Flyer only switches when you tap Switch, never by itself.
 * Icons live in assets/icons and are listed in app.json.
 */
import { useEffect, useState } from 'react';
import { AltIcons } from './native';

export const SEASON_ICONS = { fall: 'Fall', winter: 'Winter', newyear: 'NewYear', valentine: 'Valentine', stpatrick: 'StPatrick' };
export const ICON_LABELS = { Fall: 'Fall leaves', Winter: 'Winter lights', NewYear: 'New Year', Valentine: "Valentine's", StPatrick: "St. Patrick's" };

export const iconsSupported = () => !!(AltIcons && AltIcons.supportsAlternateIcons);

export function currentIcon() {
  try { return AltIcons && AltIcons.getAppIconName ? AltIcons.getAppIconName() : null; } catch (e) { return null; }
}

/** name: one of SEASON_ICONS values, or null for the regular icon. */
export async function setIcon(name) {
  if (!iconsSupported()) return false;
  try { await AltIcons.setAlternateAppIcon(name || null); return true; } catch (e) { return false; }
}

/** What the Home card should offer, if anything. */
export function iconOffer({ season, seasonIcon, iconAsked, current }) {
  if (!iconsSupported() || seasonIcon === 'off') return null;
  const want = season ? SEASON_ICONS[season.id] : null;
  if (want && current !== want && iconAsked !== season.id) return { kind: 'switch', name: want, season };
  if (!want && current && Object.values(SEASON_ICONS).includes(current) && iconAsked !== `back-${current}`) return { kind: 'back', name: null, from: current };
  return null;
}

export function useCurrentIcon() {
  const [name, setName] = useState(currentIcon());
  useEffect(() => { setName(currentIcon()); }, []);
  return [name, async (n) => { const ok = await setIcon(n); if (ok) setName(n); return ok; }];
}
