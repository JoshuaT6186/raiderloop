import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { THEMES, fontSet } from './tokens';

const ThemeCtx = createContext({ t: THEMES.light, f: fontSet(false), season: null, seasonLevel: 'off' });
export const useTheme = () => useContext(ThemeCtx);

/**
 * pref: 'system' | 'light' | 'dark'
 * season: the active season from lib/seasons (or null)
 * seasonLevel: 'on' | 'minimal' | 'off' (the user's setting)
 *
 * When a season is active, tape picks up the season's color, and in
 * light mode a season can tint the notebook paper (Valentine's).
 */
export function ThemeProvider({ pref = 'system', fontsLoaded, season = null, seasonLevel = 'on', children }) {
  const sys = useColorScheme();
  const mode = pref === 'system' ? (sys === 'dark' ? 'dark' : 'light') : pref;
  const value = useMemo(() => {
    const base = THEMES[mode];
    const s = seasonLevel === 'off' ? null : season;
    let t = base;
    if (s) {
      t = {
        ...base,
        tape: `${s.tape}${mode === 'dark' ? '99' : 'B3'}`,
        ...(s.paper && mode === 'light' && seasonLevel === 'on' ? { paper: s.paper } : null),
      };
    }
    return { t, f: fontSet(fontsLoaded), mode, season: s, seasonLevel: s ? seasonLevel : 'off' };
  }, [mode, fontsLoaded, season, seasonLevel]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
