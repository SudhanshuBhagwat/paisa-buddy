export {
  fetchHomeData as getHomeData,
  fetchReviewData as getReviewData,
  fetchStatsData as getStatsData,
  listInvestments as getInvestments,
} from './api'

export { listAccounts as getAccounts } from '../repositories/accountRepository'
export { getCategoryColors } from '../repositories/categoryRepository'

import { getAllSettings } from '../repositories/settingsRepository'
import { listCategories } from '../repositories/categoryRepository'
import { listAccounts } from '../repositories/accountRepository'
import { getCategoryColors } from '../repositories/categoryRepository'
import { getByMonth, getMonthlySpends, getTotalCount, type MonthlySpend } from '../repositories/transactionRepository'
import { supabase } from './supabase'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'

// ─── Transactions ─────────────────────────────────────────────────────────────

export type TransactionMonthData = {
  transactions: Transaction[]
  monthlySpends: MonthlySpend[]
  accounts: Account[]
  categoryColors: Record<string, string>
}

export async function getTransactionMonthData(month: string): Promise<TransactionMonthData> {
  const [transactions, monthlySpends, accounts, categoryColors] = await Promise.all([
    getByMonth(month),
    getMonthlySpends(),
    listAccounts(),
    getCategoryColors(),
  ])
  return { transactions, monthlySpends, accounts, categoryColors }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type CategoryWithCount = { name: string; color: string; transactionCount: number }

export type SettingsData = {
  displayName: string | null
  expectedMonthlyIncome: number
  upiIds: string[]
  customCategories: CategoryWithCount[]
  predefinedCategories: { name: string; transactionCount: number }[]
  txCount: number
}

export type SettingsQueryData = {
  settings: SettingsData
  email: string | null
}

export async function getSettingsData(): Promise<SettingsQueryData> {
  const [raw, cats, txCount, { data: { session } }] = await Promise.all([
    getAllSettings(),
    listCategories(),
    getTotalCount(),
    supabase.auth.getSession(),
  ])
  const settings: SettingsData = {
    displayName: raw.displayName,
    expectedMonthlyIncome: raw.expectedMonthlyIncome,
    upiIds: raw.upiIds,
    customCategories: cats
      .filter((c) => c.is_custom)
      .map(({ name, color, transactionCount }) => ({ name, color, transactionCount })),
    predefinedCategories: cats
      .filter((c) => !c.is_custom)
      .map(({ name, transactionCount }) => ({ name, transactionCount })),
    txCount,
  }
  return { settings, email: session?.user?.email ?? null }
}
