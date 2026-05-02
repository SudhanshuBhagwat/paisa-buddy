import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { storage } from '@/utils/storage';

const THEME_KEY = 'themeMode';

export function useTheme() {
  const mode = useSyncExternalStore(
    (cb) => storage.subscribe(THEME_KEY, cb),
    () => storage.get<'dark' | 'light'>(THEME_KEY, 'dark')
  );

  function setMode(next: 'dark' | 'light') {
    storage.set(THEME_KEY, next);
    Appearance.setColorScheme(next);
  }

  return { mode, setMode, isDark: mode === 'dark' };
}
