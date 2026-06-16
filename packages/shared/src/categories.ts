export const CATEGORY_COLORS: Record<string, string> = {
  'Food':          '#1A936F',
  'Transport':     '#2E8B9E',
  'Shopping':      '#C25FA0',
  'Entertainment': '#C77D3A',
  'Health':        '#C65D5D',
  'Utilities':     '#6B8E3D',
  'Income':        '#157F4C',
  'Returns':       '#7B5EA7',
  'Investment':    '#C99A2E',
  'Transfer':      '#3B82C4',
  'Settlement':    '#9B6B9E',
  'Other':         '#7E8A82',
}

// Approximate hues of all predefined hex colors — custom color generation avoids these
const PREDEFINED_HUES = [160, 190, 315, 30, 0, 84, 148, 265, 42, 210, 290, 145]

/**
 * Generates a color maximally distant (in hue) from all existing colors.
 * Pass existing custom category hsl colors so new ones don't clash.
 */
export function generateUniqueColor(existingHslColors: string[] = []): string {
  const usedHues: number[] = [...PREDEFINED_HUES]

  for (const c of existingHslColors) {
    const m = c.match(/hsl\(\s*(\d+(?:\.\d+)?)/)
    if (m) usedHues.push(parseFloat(m[1]))
  }

  let bestHue = 0
  let bestMinDist = -1

  for (let h = 0; h < 360; h += 5) {
    const minDist = Math.min(...usedHues.map((u) => {
      const d = Math.abs(h - u)
      return Math.min(d, 360 - d)
    }))
    if (minDist > bestMinDist) {
      bestMinDist = minDist
      bestHue = h
    }
  }

  return `hsl(${bestHue}, 55%, 45%)`
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
