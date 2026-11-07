/**
 * Flyer on the web. One codebase: the same screens, with a sidebar
 * instead of the bottom tabs on wide windows, sheets as centered
 * panels, and phone-only features (map, Health, widgets, Wallet,
 * location, ads) turned off.
 */
import { Platform, useWindowDimensions } from 'react-native';

export const IS_WEB = Platform.OS === 'web';
export const WIDE_AT = 900;

/** True on the web when the window is wide enough for the sidebar. */
export function useWide() {
  const { width } = useWindowDimensions();
  return IS_WEB && width >= WIDE_AT;
}
export const isWideNow = () => IS_WEB && typeof window !== 'undefined' && window.innerWidth >= WIDE_AT;
