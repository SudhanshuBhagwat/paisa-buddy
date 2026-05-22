import type { Transaction } from './types'

const fmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatAmount(paise: number): string {
  return fmt.format(paise / 100)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function parseYearMonth(ym: string): Date {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function addMonths(ym: string, delta: number): string {
  const d = parseYearMonth(ym)
  d.setMonth(d.getMonth() + delta)
  return toYearMonth(d)
}

export function formatMonthLabel(ym: string): string {
  const d = parseYearMonth(ym)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function getMonthTransactions(txs: Transaction[], ym: string): Transaction[] {
  return txs.filter((t) => t.date.startsWith(ym)).sort((a, b) => b.date.localeCompare(a.date))
}

export function groupByDate(txs: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>()
  for (const tx of txs) {
    const existing = map.get(tx.date) ?? []
    existing.push(tx)
    map.set(tx.date, existing)
  }
  return map
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const t = new Date()
  const todayStr = t.toISOString().slice(0, 10)
  const yest = new Date(t)
  yest.setDate(yest.getDate() - 1)
  const yestStr = yest.toISOString().slice(0, 10)

  if (dateStr === todayStr) return 'Today'
  if (dateStr === yestStr) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function calcSummary(txs: Transaction[]): { income: number; expense: number; balance: number; transfer: number } {
  let income = 0
  let expense = 0
  let transfer = 0
  for (const tx of txs) {
    if (tx.type === 'credit') income += tx.amount
    else if (tx.type === 'debit') expense += tx.amount
    else if (tx.type === 'transfer') transfer += tx.amount
  }
  return { income, expense, balance: income - expense, transfer }
}

export function groupByCategory(txs: Transaction[], type: 'credit' | 'debit' | 'transfer' = 'debit'): { category: string; total: number }[] {
  const map = new Map<string, number>()
  for (const tx of txs) {
    if (tx.type === type) {
      map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount)
    }
  }
  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

export function nanoid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
