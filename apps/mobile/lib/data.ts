export {
  fetchReviewData as getReviewData,
  listInvestments as getInvestments,
} from './api'

export { listAccounts as getAccounts } from '../repositories/accountRepository'
export { getCategoryColors } from '../repositories/categoryRepository'

import { getAllSettings } from '../repositories/settingsRepository'
import { listCategories } from '../repositories/categoryRepository'
import { listAccounts } from '../repositories/accountRepository'
import { getCategoryColors } from '../repositories/categoryRepository'
import {
  getAll,
  getByMonth,
  getMonthlySpends,
  getCategorySpendsByMonth,
  getTotalCount,
  type MonthlySpend,
} from '../repositories/transactionRepository'
import { listPlans } from '../repositories/planRepository'
import { supabase } from './supabase'
import { addMonths } from '@paisa-buddy/shared/logic/date'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'
import type { BudgetWithSpent } from '@paisa-buddy/shared/types/budget'

// ─── Home ─────────────────────────────────────────────────────────────────────

export async function getHomeData(): Promise<{
  transactions: Transaction[]
  accounts: Account[]
  settings: { display_name: string | null; expected_monthly_income: number | null }
  categoryColors: Record<string, string>
}> {
  const [transactions, accounts, settings, categoryColors] = await Promise.all([
    getAll(),
    listAccounts(),
    getAllSettings(),
    getCategoryColors(),
  ])
  return {
    transactions,
    accounts,
    settings: {
      display_name: settings.displayName,
      expected_monthly_income: settings.expectedMonthlyIncome || null,
    },
    categoryColors,
  }
}

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

// ─── Stats ────────────────────────────────────────────────────────────────────

export type StatsData = {
  transactions: Transaction[]
  monthlySpends: MonthlySpend[]
  budgets: BudgetWithSpent[]
  categoryColors: Record<string, string>
  accounts: Account[]
  settings: { expected_monthly_income: number | null }
  previousMonthCategorySpends: { category: string; total: number }[]
}

export async function getStatsData(month: string): Promise<StatsData> {
  const prevMonth = addMonths(month, -1)
  const [transactions, monthlySpends, budgets, categoryColors, accounts, settings, previousMonthCategorySpends] = await Promise.all([
    getByMonth(month),
    getMonthlySpends(),
    listPlans(month),
    getCategoryColors(),
    listAccounts(),
    getAllSettings(),
    getCategorySpendsByMonth(prevMonth),
  ])
  return {
    transactions,
    monthlySpends,
    budgets,
    categoryColors,
    accounts,
    settings: { expected_monthly_income: settings.expectedMonthlyIncome || null },
    previousMonthCategorySpends,
  }
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
