import type { Transaction, TransactionType } from '@/lib/types/transaction'

export interface TransactionUIFilters {
  date?: string | null
  category?: string | null
  type?: TransactionType | null
  account?: string | null
  recurringOnly?: boolean
  search?: string
}

export function filterTransactions(txs: Transaction[], filters: TransactionUIFilters): Transaction[] {
  const q = (filters.search ?? '').trim().toLowerCase()
  return txs.filter(
    (t) =>
      (!filters.date || t.date === filters.date) &&
      (!filters.category || t.category === filters.category) &&
      (!filters.type || t.type === filters.type) &&
      (!filters.account || t.account_id === filters.account) &&
      (!filters.recurringOnly || t.is_recurring) &&
      (!q || t.merchant?.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
  )
}

export function getRecentCategories(txs: Transaction[], limit = 3): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tx of [...txs].sort((a, b) => b.date.localeCompare(a.date))) {
    if (tx.category && !seen.has(tx.category)) {
      seen.add(tx.category)
      result.push(tx.category)
      if (result.length === limit) break
    }
  }
  return result
}

export function groupTransactionsByMonth(txs: Transaction[]): { month: string; txs: Transaction[] }[] {
  const map = new Map<string, Transaction[]>()
  for (const tx of txs) {
    const key = tx.date.slice(0, 7)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(tx)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, txs]) => ({ month, txs }))
}
