import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { I18nProvider } from '@/lib/i18n';
import { ThemeModeProvider, useThemeMode } from '@/lib/theme-mode';

SplashScreen.preventAutoHideAsync();

function ThemedApp() {
  const { scheme } = useThemeMode();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Slot />
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <I18nProvider>
      <ThemeModeProvider>
        <ThemedApp />
      </ThemeModeProvider>
    </I18nProvider>
  );
}
