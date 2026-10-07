import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { THEMES, fontSet } from './tokens';

const ThemeCtx = createContext({ t: THEMES.light, f: fontSet(false) });
export const useTheme = () => useContext(ThemeCtx);

/** pref: 'system' | 'light' | 'dark' */
export function ThemeProvider({ pref = 'system', fontsLoaded, children }) {
  const sys = useColorScheme();
  const mode = pref === 'system' ? (sys === 'dark' ? 'dark' : 'light') : pref;
  const value = useMemo(() => ({ t: THEMES[mode], f: fontSet(fontsLoaded), mode }), [mode, fontsLoaded]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
