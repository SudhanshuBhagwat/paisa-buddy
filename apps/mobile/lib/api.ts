import { supabase } from './supabase'

const REQUEST_TIMEOUT_MS = 15000

function getApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
  return configured.replace(/\/+$/, '').replace('https://paisa-buddy.com', 'https://www.paisa-buddy.com')
}

const BASE = getApiBase()

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return undefined as T

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Unexpected response from server (${res.status}).`)
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders()
  const res = await fetchWithTimeout(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (res.status === 204) return undefined as T
  const data = await readJson<{ error?: string } & T>(res)
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

// ─── Auth (no auth headers needed) ──────────────────────────────────────────

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson<{ error?: string } & T>(res)
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

export async function requestOtp(email: string): Promise<void> {
  await post('/api/mobile/auth/send-otp', { email })
}

export async function confirmOtp(email: string, token: string): Promise<{ supabaseToken: string }> {
  return post('/api/mobile/auth/verify-otp', { email, token })
}

// ─── Transactions ────────────────────────────────────────────────────────────

import type { Transaction } from '@paisa-buddy/shared/types/transaction'

export type MonthlySpend = {
  month: string
  spent: number
}

export type TransactionMonthData = {
  transactions: Transaction[]
  monthlySpends: MonthlySpend[]
  accounts: Account[]
  categoryColors: Record<string, string>
}

export type TxInput = {
  type: Transaction['type']
  amount: number
  date: string
  time?: string | null
  merchant?: string | null
  description?: string
  category?: string | null
  account_id?: string | null
  to_account_id?: string | null
  is_recurring?: boolean
}

export async function createTransaction(input: TxInput): Promise<Transaction> {
  return apiFetch('/api/mobile/transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function fetchTransactionMonthData(month: string): Promise<TransactionMonthData> {
  return apiFetch(`/api/mobile/transactions?month=${month}`)
}

export async function updateTransaction(
  id: string,
  data: Partial<TxInput & { reviewed: boolean }>,
): Promise<Transaction> {
  return apiFetch(`/api/mobile/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteTransaction(id: string): Promise<void> {
  return apiFetch(`/api/mobile/transactions/${id}`, { method: 'DELETE' })
}

// ─── Review ───────────────────────────────────────────────────────────────────

export type ReviewData = {
  transactions: Transaction[]
  accounts: Account[]
  categoryColors: Record<string, string>
}

export async function fetchReviewData(): Promise<ReviewData> {
  return apiFetch('/api/mobile/review')
}

export async function confirmAllPending(): Promise<void> {
  return apiFetch('/api/mobile/review/confirm-all', { method: 'POST' })
}

export async function rejectAllPending(): Promise<void> {
  return apiFetch('/api/mobile/review', { method: 'DELETE' })
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

import type { Account, AccountType } from '@paisa-buddy/shared/types/account'

export type HomeData = {
  transactions: Transaction[]
  accounts: Account[]
  settings: { display_name: string | null; expected_monthly_income: number | null }
  categoryColors: Record<string, string>
}

export async function fetchHomeData(): Promise<HomeData> {
  return apiFetch('/api/mobile/home-data')
}

export async function listAccounts(): Promise<Account[]> {
  return apiFetch('/api/mobile/accounts')
}

export async function createAccount(
  name: string,
  type: AccountType = 'savings',
  bank?: string | null,
  opening_balance?: number,
): Promise<Account> {
  return apiFetch('/api/mobile/accounts', {
    method: 'POST',
    body: JSON.stringify({ name, type, bank, opening_balance }),
  })
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function createCategory(name: string): Promise<{ name: string; color: string }> {
  return apiFetch('/api/mobile/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

// ─── Accounts (update / delete) ──────────────────────────────────────────────

export type AccountInput = {
  name?: string
  type?: Account['type']
  bank?: string | null
  opening_balance?: number
}

export async function updateAccount(id: string, data: AccountInput): Promise<Account> {
  return apiFetch(`/api/mobile/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteAccount(id: string): Promise<void> {
  return apiFetch(`/api/mobile/accounts/${id}`, { method: 'DELETE' })
}

// ─── Investments ──────────────────────────────────────────────────────────────

import type { InvestmentWithTotal } from '@paisa-buddy/shared/types/investment'

export async function listInvestments(): Promise<InvestmentWithTotal[]> {
  return apiFetch('/api/mobile/investments')
}

export async function createInvestment(name: string): Promise<InvestmentWithTotal> {
  return apiFetch('/api/mobile/investments', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function updateInvestment(id: string, name: string): Promise<InvestmentWithTotal> {
  return apiFetch(`/api/mobile/investments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export async function deleteInvestment(id: string): Promise<void> {
  return apiFetch(`/api/mobile/investments/${id}`, { method: 'DELETE' })
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

import type { Budget, BudgetWithSpent } from '@paisa-buddy/shared/types/budget'

export async function listBudgets(month: string): Promise<BudgetWithSpent[]> {
  return apiFetch(`/api/mobile/budgets?month=${month}`)
}

export async function upsertBudget(category: string, amount: number): Promise<Budget> {
  return apiFetch('/api/mobile/budgets', {
    method: 'POST',
    body: JSON.stringify({ category, amount }),
  })
}

export async function deleteBudget(id: string): Promise<void> {
  return apiFetch(`/api/mobile/budgets/${id}`, { method: 'DELETE' })
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

export async function fetchStatsData(month: string): Promise<StatsData> {
  return apiFetch(`/api/mobile/stats-data?month=${month}`)
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

export async function fetchSettings(): Promise<SettingsData> {
  return apiFetch('/api/mobile/settings')
}

export async function updateProfile(data: { displayName?: string | null; expectedMonthlyIncome?: number }): Promise<void> {
  return apiFetch('/api/mobile/settings/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function addUpiId(id: string): Promise<void> {
  return apiFetch('/api/mobile/settings/upi', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}

export async function removeUpiId(id: string): Promise<void> {
  return apiFetch('/api/mobile/settings/upi', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function addCustomCategory(name: string): Promise<{ name: string; color: string }> {
  return apiFetch('/api/mobile/settings/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function removeCustomCategory(name: string, unlink: boolean): Promise<void> {
  return apiFetch('/api/mobile/settings/categories', {
    method: 'DELETE',
    body: JSON.stringify({ name, unlink }),
  })
}

export async function clearAllData(): Promise<void> {
  return apiFetch('/api/mobile/settings/clear-data', { method: 'POST' })
}

export async function fetchExportCsv(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const res = await fetchWithTimeout(`${BASE}/api/mobile/export`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) throw new Error('Export failed')
  return res.text()
}
