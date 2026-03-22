export const colors = {
  primary: '#6C63FF',
  primaryLight: '#8F88FF',
  primaryDark: '#4A42D6',

  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',

  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',

  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const typography = {
  fontSizeXs: 12,
  fontSizeSm: 14,
  fontSizeMd: 16,
  fontSizeLg: 18,
  fontSizeXl: 20,
  fontSize2xl: 24,
  fontSize3xl: 30,
} as const;

export type ColorKey = keyof typeof colors;
export type SpacingKey = keyof typeof spacing;
