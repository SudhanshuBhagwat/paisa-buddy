import type { Transaction } from '@paisa-buddy/shared/types/transaction'

export { formatAmount } from '@paisa-buddy/shared/logic/amount'
export {
  today,
  toYearMonth,
  parseYearMonth,
  addMonths,
  formatMonthLabel,
  formatDateLabel,
} from '@paisa-buddy/shared/logic/date'
export { groupByDate, calcSummary, getMonthTransactions } from '@paisa-buddy/shared/logic/transaction'

export function groupByCategory(
  txs: Transaction[],
  type: 'credit' | 'debit' | 'transfer' = 'debit',
): { category: string; total: number }[] {
  const map = new Map<string, number>()
  for (const tx of txs) {
    if (tx.type === type) {
      const cat = tx.category ?? 'Uncategorized'
      map.set(cat, (map.get(cat) ?? 0) + tx.amount)
    }
  }
  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

export function nanoid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
