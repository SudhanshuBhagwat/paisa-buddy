import type { Transaction, TransactionType } from '@/lib/types/transaction'
import { parseAmountToPaise } from './amount'

export interface ReviewFormState {
  type: TransactionType
  amountStr: string
  merchant: string
  description: string
  category: string
  accountId: string
  toAccountId: string
  bank: string
  upiRef: string
  date: string
  time: string
  isRecurring: boolean
  investmentId: string
}

export function resolveAiCategory(hint: string | null, categories: string[]): string | null {
  if (!hint) return null
  if (categories.includes(hint)) return hint
  return categories.includes('Other') ? 'Other' : null
}

export function getCategoryHint(tx: Transaction): string | null {
  if (!tx.raw_ai_response) return null
  try {
    const parsed = JSON.parse(tx.raw_ai_response) as { category_hint?: string | null }
    return parsed.category_hint ?? null
  } catch {
    return null
  }
}

export function txToFormState(tx: Transaction): ReviewFormState {
  return {
    type: tx.type,
    amountStr: String(tx.amount / 100),
    merchant: tx.merchant ?? '',
    description: tx.description,
    category: tx.category ?? '',
    accountId: tx.account_id ?? '',
    toAccountId: tx.to_account_id ?? '',
    bank: tx.bank ?? '',
    upiRef: tx.upi_ref ?? '',
    date: tx.date,
    time: tx.time ?? '',
    isRecurring: tx.is_recurring,
    investmentId: tx.investment_id ?? '',
  }
}

export function formStateToPayload(
  form: ReviewFormState,
): Partial<Omit<Transaction, 'id' | 'created_at' | 'user_id'>> {
  const paise = parseAmountToPaise(form.amountStr)
  return {
    type: form.type,
    amount: paise,
    merchant: form.merchant.trim() || null,
    description: form.description.trim(),
    category: form.category || null,
    account_id: form.accountId || null,
    to_account_id: form.type === 'transfer' ? (form.toAccountId || null) : null,
    bank: form.bank.trim() || null,
    upi_ref: form.upiRef.trim() || null,
    date: form.date,
    time: form.time || null,
    is_recurring: form.isRecurring,
    investment_id: form.category === 'Investment' && form.investmentId ? form.investmentId : null,
  }
}

export function isTransactionConfirmable(form: ReviewFormState): boolean {
  const paise = parseAmountToPaise(form.amountStr)
  if (!paise || paise <= 0) return false
  if (!form.description.trim()) return false
  if (!form.category) return false
  if (!form.accountId) return false
  if (form.type === 'transfer' && !form.toAccountId) return false
  return true
}
