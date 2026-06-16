// Mirrors apps/web/app/globals.css design tokens exactly

export const C = {
  bg:         '#F4F6F2',
  surface:    '#FFFFFF',
  ink:        '#16201A',
  ink2:       '#5C6B62',
  ink3:       '#94A199',
  line:       '#E7ECE5',
  brand:      '#1A936F',
  brandDeep:  '#0F5132',
  brandPale:  '#E4F1EA',
  pos:        '#157F4C',
  neg:        '#DB5A4B',
  transfer:   '#3B82C4',
  gold:       '#E0A33C',
} as const

// Font family names matching the loaded expo-google-fonts
export const F = {
  regular:    'PlusJakartaSans_400Regular',
  medium:     'PlusJakartaSans_500Medium',
  semibold:   'PlusJakartaSans_600SemiBold',
  bold:       'PlusJakartaSans_700Bold',
  extrabold:  'PlusJakartaSans_800ExtraBold',
  mono:       'SpaceMono_400Regular',
  monoBold:   'SpaceMono_700Bold',
} as const

export const RADIUS = 14
export const ROW_PAD = 11
