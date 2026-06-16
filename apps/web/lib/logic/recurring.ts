import type { Transaction } from '@paisa-buddy/shared/types/transaction'

const STORAGE_KEY = 'pb_recurring_notified_ids'

export function getNewRecurringCount(txs: Transaction[]): number {
  const recurringIds = txs.filter((t) => t.is_recurring).map((t) => t.id)
  const stored: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  const storedSet = new Set(stored)
  return recurringIds.filter((id) => !storedSet.has(id)).length
}

export function markRecurringAsSeen(txs: Transaction[]): void {
  const recurringIds = txs.filter((t) => t.is_recurring).map((t) => t.id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recurringIds))
}
