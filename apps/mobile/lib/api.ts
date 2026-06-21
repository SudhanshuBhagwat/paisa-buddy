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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function requestOtp(email: string): Promise<void> {
  await post('/api/mobile/auth/send-otp', { email })
}

export async function confirmOtp(email: string, token: string): Promise<{ supabaseToken: string }> {
  return post('/api/mobile/auth/verify-otp', { email, token })
}

// ─── Investments (still served from API) ──────────────────────────────────────

import type { InvestmentWithTotal } from '@paisa-buddy/shared/types/investment'

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

export async function listInvestments(): Promise<InvestmentWithTotal[]> {
  return apiFetch('/api/mobile/investments')
}
