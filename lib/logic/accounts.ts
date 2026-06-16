import type { AccountWithBalance } from '@/lib/types/account'
import type { InvestmentWithTotal } from '@/lib/types/investment'

export interface AccountsSummary {
  totalBalance: number
  bankCount: number
  cardCount: number
  totalInvested: number
}

export function deriveAccountsSummary(
  accounts: AccountWithBalance[],
  investments: InvestmentWithTotal[],
): AccountsSummary {
  const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0)
  const bankCount = new Set(accounts.filter((a) => a.bank).map((a) => a.bank!)).size
  const cardCount = accounts.filter((a) => a.type === 'credit').length
  const totalInvested = investments.reduce((s, i) => s + i.total_invested, 0)
  return { totalBalance, bankCount, cardCount, totalInvested }
}
