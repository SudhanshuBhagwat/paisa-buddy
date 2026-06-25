import { CATEGORY_COLORS } from '@paisa-buddy/shared/categories'

export type CategoryMeta = {
  icon: string
  color: string
}

export const CATEGORY_METADATA: Record<string, CategoryMeta> = {
  'Food':          { icon: 'ForkKnifeIcon',              color: CATEGORY_COLORS['Food'] },
  'Transport':     { icon: 'CarIcon',                    color: CATEGORY_COLORS['Transport'] },
  'Shopping':      { icon: 'ShoppingBagIcon',            color: CATEGORY_COLORS['Shopping'] },
  'Entertainment': { icon: 'FilmSlateIcon',              color: CATEGORY_COLORS['Entertainment'] },
  'Health':        { icon: 'HeartbeatIcon',              color: CATEGORY_COLORS['Health'] },
  'Utilities':     { icon: 'LightningIcon',              color: CATEGORY_COLORS['Utilities'] },
  'Family':        { icon: 'UsersThreeIcon',             color: CATEGORY_COLORS['Family'] },
  'Income':        { icon: 'CoinsIcon',                  color: CATEGORY_COLORS['Income'] },
  'Returns':       { icon: 'ArrowCounterClockwiseIcon',  color: CATEGORY_COLORS['Returns'] },
  'Rent':          { icon: 'HouseIcon',                  color: CATEGORY_COLORS['Rent'] },
  'Investment':    { icon: 'TrendUpIcon',                color: CATEGORY_COLORS['Investment'] },
  'Subscriptions': { icon: 'RepeatIcon',                 color: CATEGORY_COLORS['Subscriptions'] },
  'Transfer':      { icon: 'ArrowsLeftRightIcon',        color: CATEGORY_COLORS['Transfer'] },
  'Other':         { icon: 'DotsThreeIcon',              color: CATEGORY_COLORS['Other'] },
}

export const DEFAULT_CATEGORY_ICON = 'TagIcon'
export const DEFAULT_CATEGORY_COLOR = '#7E8A82'

export function getCategoryIcon(category?: string | null): string {
  if (!category) return DEFAULT_CATEGORY_ICON
  return CATEGORY_METADATA[category]?.icon ?? DEFAULT_CATEGORY_ICON
}
