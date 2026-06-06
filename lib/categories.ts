export const CATEGORY_COLORS: Record<string, string> = {
  'Food':          '#1A936F',
  'Transport':     '#2E8B9E',
  'Shopping':      '#C25FA0',
  'Entertainment': '#C77D3A',
  'Health':        '#C65D5D',
  'Utilities':     '#6B8E3D',
  'Income':        '#157F4C',
  'Returns':       '#157F4C',
  'Investment':    '#C99A2E',
  'Transfer':      '#3B82C4',
  'Settlement':    '#3B82C4',
  'Other':         '#7E8A82',
}

export function generatePastelColor(): string {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, 40%, 70%)`
}

export function categoryColor(cat: string | null | undefined, colorMap?: Record<string, string>): string {
  if (!cat) return '#7E8A82'
  if (colorMap?.[cat]) return colorMap[cat]
  return CATEGORY_COLORS[cat] ?? '#7E8A82'
}

export const PREDEFINED_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Health',
  'Utilities',
  'Income',
  'Returns',
  'Investment',
  'Transfer',
  'Settlement',
  'Other',
] as const
