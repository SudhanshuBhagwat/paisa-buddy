export {
  fetchHomeData as getHomeData,
  fetchTransactionMonthData as getTransactionMonthData,
  fetchReviewData as getReviewData,
  fetchStatsData as getStatsData,
  listInvestments as getInvestments,
} from './api'

export { listAccounts as getAccounts } from '../repositories/accountRepository'
export { getCategoryColors } from '../repositories/categoryRepository'

import { getAllSettings } from '../repositories/settingsRepository'
import { listCategories } from '../repositories/categoryRepository'
import { getTotalCount } from '../repositories/transactionRepository'
import { supabase } from './supabase'

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
