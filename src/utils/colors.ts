import { useSyncExternalStore } from 'react';
import { storage } from './storage';

export const DarkColors = {
  background: '#0D0D1A',
  surface: '#16162A',
  surfaceRaised: '#1E1E35',
  income: '#00C896',
  expense: '#FF4444',
  text: '#FFFFFF',
  textSecondary: '#9494B8',
  textTertiary: '#55557A',
  accent: '#7C71F5',
  border: '#252545',
  destructive: '#FF3B30',
};

export const LightColors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceRaised: '#E9E9F0',
  income: '#00A87A',
  expense: '#D92929',
  text: '#1C1C1E',
  textSecondary: '#636380',
  textTertiary: '#AEAEB2',
  accent: '#6558EE',
  border: '#D1D1DA',
  destructive: '#FF3B30',
};

export type ColorPalette = typeof DarkColors;

export function useColors(): ColorPalette {
  const mode = useSyncExternalStore(
    (cb) => storage.subscribe('themeMode', cb),
    () => storage.get<'dark' | 'light'>('themeMode', 'dark')
  );
  return mode === 'light' ? LightColors : DarkColors;
}

// Static fallback for non-reactive contexts
export const Colors = DarkColors;
