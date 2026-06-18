export {
  fetchHomeData as getHomeData,
  fetchTransactionMonthData as getTransactionMonthData,
  fetchReviewData as getReviewData,
  fetchSettings as getSettings,
  fetchStatsData as getStatsData,
  listAccounts as getAccounts,
  listInvestments as getInvestments,
} from './api'

import { fetchSettings, type SettingsData } from './api'
import { supabase } from './supabase'

export type SettingsQueryData = {
  settings: SettingsData
  email: string | null
}

export async function getSettingsData(): Promise<SettingsQueryData> {
  const [settings, { data: { session } }] = await Promise.all([
    fetchSettings(),
    supabase.auth.getSession(),
  ])
  return { settings, email: session?.user?.email ?? null }
}
