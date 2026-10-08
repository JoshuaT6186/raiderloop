/**
 * Flyer — entry point.
 * Loads fonts (falls back to system fonts if they fail), then mounts
 * state → theme → shell. Theme preference lives in app state, so the
 * ThemeProvider sits inside AppProvider.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Nunito_500Medium, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { AppProvider, useApp } from './src/state/AppContext';
import { ThemeProvider } from './src/theme/ThemeContext';
import Shell from './src/Shell';
// Defines the background location task (automatic check-ins and
// nearby alerts). iOS can launch the app
// just to run it, so it has to be registered at startup.
import './src/lib/backgroundLocation';

function Themed({ fontsLoaded }) {
  const { theme } = useApp();
  return (
    <ThemeProvider pref={theme} fontsLoaded={fontsLoaded}>
      <Shell />
    </ThemeProvider>
  );
}

export default function App() {
  const [loaded, error] = useFonts({
    Nunito_500Medium, Nunito_700Bold, Nunito_800ExtraBold, Caveat_600SemiBold, Caveat_700Bold, PermanentMarker_400Regular,
  });
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Themed fontsLoaded={loaded && !error} />
      </AppProvider>
    </SafeAreaProvider>
  );
}
