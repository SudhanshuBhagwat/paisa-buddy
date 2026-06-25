export { listAccounts as getAccounts } from '../repositories/accountRepository'
export { getCategoryColors } from '../repositories/categoryRepository'

import { getAllSettings } from '../repositories/settingsRepository'
import { listCategories } from '../repositories/categoryRepository'
import { listAccounts } from '../repositories/accountRepository'
import { getCategoryColors } from '../repositories/categoryRepository'
import {
  getAll,
  getByMonth,
  getByMonths,
  getMonthlySpends,
  getCategorySpendsByMonth,
  getTotalCount,
  getUnreviewed,
  type MonthlySpend,
} from '../repositories/transactionRepository'
import { listPlans } from '../repositories/planRepository'
import { listLearnedMappings, type LearnedMapping } from '../repositories/learnedMappingRepository'
import { getActiveReviewSession, type ReviewSession } from '../repositories/reviewSessionRepository'
import { getLatestCompletedImportSession, countTransactionsForImportSession, type ImportSession } from '../repositories/importRepository'
import { addMonths } from '@paisa-buddy/shared/logic/date'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'
import type { BudgetWithSpent } from '@paisa-buddy/shared/types/budget'

// ─── Review ───────────────────────────────────────────────────────────────────

export type ReviewData = {
  transactions: Transaction[]
  accounts: Account[]
  categoryColors: Record<string, string>
}

export async function getReviewData(): Promise<ReviewData> {
  const [transactions, accounts, categoryColors] = await Promise.all([
    getUnreviewed(),
    listAccounts(),
    getCategoryColors(),
  ])
  return { transactions, accounts, categoryColors }
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export async function getHomeData(): Promise<{
  transactions: Transaction[]
  accounts: Account[]
  settings: { display_name: string | null; expected_monthly_income: number | null }
  categoryColors: Record<string, string>
  reviewSession: ReviewSession | null
}> {
  const [transactions, accounts, settings, categoryColors, reviewSession] = await Promise.all([
    getAll(),
    listAccounts(),
    getAllSettings(),
    getCategoryColors(),
    getActiveReviewSession(),
  ])
  return {
    transactions,
    accounts,
    settings: {
      display_name: settings.displayName,
      expected_monthly_income: settings.expectedMonthlyIncome || null,
    },
    categoryColors,
    reviewSession,
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

export async function getTransactionMonthsData(months: string[]): Promise<TransactionMonthData> {
  const [transactions, monthlySpends, accounts, categoryColors] = await Promise.all([
    getByMonths(months),
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

// ─── Export ───────────────────────────────────────────────────────────────────

function escCsv(v: string | null | undefined): string {
  const s = v ?? ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function generateExportCsv(): Promise<string> {
  const [transactions, accounts] = await Promise.all([getAll(), listAccounts()])
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]))
  const rows: string[] = [
    'Date,Time,Merchant,Description,Category,Type,Amount (₹),Account,Recurring,Reviewed',
    ...transactions
      .sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''))
      .map((tx) => [
        escCsv(tx.date),
        escCsv(tx.time),
        escCsv(tx.merchant),
        escCsv(tx.description),
        escCsv(tx.category),
        escCsv(tx.type),
        (tx.amount / 100).toFixed(2),
        escCsv(tx.account_id ? accountMap.get(tx.account_id) ?? '' : ''),
        tx.is_recurring ? 'Yes' : '',
        tx.reviewed ? 'Yes' : '',
      ].join(',')),
  ]
  return rows.join('\n')
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type CategoryWithCount = { name: string; color: string; transactionCount: number }

export type SettingsData = {
  displayName: string | null
  expectedMonthlyIncome: number
  upiIds: string[]
  learnedMappings: LearnedMapping[]
  customCategories: CategoryWithCount[]
  predefinedCategories: { name: string; transactionCount: number }[]
  txCount: number
  accountCount: number
  categoryCount: number
  latestImport: ImportSession | null
  latestImportTxCount: number
}

export type SettingsQueryData = {
  settings: SettingsData
  email: string | null
}

export async function getSettingsData(): Promise<SettingsQueryData> {
  const [raw, cats, accounts, txCount, learnedMappings, latestImport] = await Promise.all([
    getAllSettings(),
    listCategories(),
    listAccounts(),
    getTotalCount(),
    listLearnedMappings(10),
    getLatestCompletedImportSession(),
  ])
  const latestImportTxCount = latestImport ? await countTransactionsForImportSession(latestImport.id) : 0
  const settings: SettingsData = {
    displayName: raw.displayName,
    expectedMonthlyIncome: raw.expectedMonthlyIncome,
    upiIds: raw.upiIds,
    learnedMappings,
    customCategories: cats
      .filter((c) => c.is_custom)
      .map(({ name, color, transactionCount }) => ({ name, color, transactionCount })),
    predefinedCategories: cats
      .filter((c) => !c.is_custom)
      .map(({ name, transactionCount }) => ({ name, transactionCount })),
    txCount,
    accountCount: accounts.length,
    categoryCount: cats.length,
    latestImport,
    latestImportTxCount,
  }
  return { settings, email: raw.email }
}
