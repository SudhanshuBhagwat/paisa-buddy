import { supabase } from './supabase'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

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
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (res.status === 204) return undefined as T
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

// ─── Auth (no auth headers needed) ──────────────────────────────────────────

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

export async function requestOtp(email: string): Promise<void> {
  await post('/api/auth/send-otp', { email })
}

export async function confirmOtp(email: string, token: string): Promise<{ supabaseToken: string }> {
  return post('/api/auth/verify-otp', { email, token })
}

// ─── Transactions ────────────────────────────────────────────────────────────

import type { Transaction } from '@paisa-buddy/shared/types/transaction'

export type TxInput = {
  type: Transaction['type']
  amount: number
  date: string
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

export async function createAccount(name: string, type: AccountType = 'savings'): Promise<Account> {
  return apiFetch('/api/mobile/accounts', {
    method: 'POST',
    body: JSON.stringify({ name, type }),
  })
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function createCategory(name: string): Promise<{ name: string; color: string }> {
  return apiFetch('/api/mobile/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}
