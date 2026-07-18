import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

const STORAGE_KEY = 'livetranslate.themeMode';

type ThemeModeContextValue = {
  mode: ThemeMode;
  scheme: ResolvedScheme;
  setMode: (mode: ThemeMode) => void;
  toggleDarkMode: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === 'light' || raw === 'dark' || raw === 'system') setModeState(raw);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<ThemeModeContextValue>(() => {
    const scheme: ResolvedScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
    return {
      mode,
      scheme,
      setMode,
      toggleDarkMode: () => setMode(scheme === 'dark' ? 'light' : 'dark'),
    };
  }, [mode, systemScheme]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeModeProvider');
  return ctx;
}
