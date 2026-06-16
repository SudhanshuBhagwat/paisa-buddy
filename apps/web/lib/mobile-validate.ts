import 'server-only'
import type { NextRequest } from 'next/server'

export const VALID_TX_TYPES = new Set(['debit', 'credit', 'transfer'])
export const VALID_ACCOUNT_TYPES = new Set(['savings', 'current', 'credit', 'wallet', 'other'])

export const MAX_NAME_LEN = 100
export const MAX_DESC_LEN = 500
export const MAX_UPI_LEN = 64

export function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export function isValidMonth(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s)
}

export function isPositiveInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n > 0
}

export function isNonNegativeInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 0
}

export async function parseBody<T = unknown>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}
