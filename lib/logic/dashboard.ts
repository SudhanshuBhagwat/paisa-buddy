import type { BuddyMood } from '@/lib/types'

export interface DashboardStats {
  hasIncomeTarget: boolean
  incomeRemaining: number
  incomeSpentPct: number
  incomeBarColor: string
  buddyMood: BuddyMood
  displayBalance: number
  displayBalanceColor: string
}

export function deriveDashboardStats(
  income: number,
  expense: number,
  balance: number,
  expectedMonthlyIncome: number,
): DashboardStats {
  const hasIncomeTarget = expectedMonthlyIncome > 0
  const incomeRemaining = expectedMonthlyIncome - expense
  const incomeSpentPct = hasIncomeTarget
    ? Math.min(100, Math.round((expense / expectedMonthlyIncome) * 100))
    : 0
  const incomeBarColor =
    incomeSpentPct >= 100 ? 'var(--pb-neg)' : incomeSpentPct >= 80 ? 'var(--pb-gold)' : 'var(--pb-brand)'
  const buddyMood: BuddyMood = hasIncomeTarget
    ? incomeRemaining > 0 ? 'happy' : incomeRemaining < 0 ? 'sad' : 'neutral'
    : balance > 0 ? 'happy' : balance < 0 ? 'sad' : 'neutral'
  const displayBalance = hasIncomeTarget ? incomeRemaining : balance
  const displayBalanceColor = displayBalance >= 0 ? 'var(--pb-pos)' : 'var(--pb-neg)'
  return { hasIncomeTarget, incomeRemaining, incomeSpentPct, incomeBarColor, buddyMood, displayBalance, displayBalanceColor }
}
