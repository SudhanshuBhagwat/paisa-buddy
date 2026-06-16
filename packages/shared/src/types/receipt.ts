import type { TransactionType, Confidence } from './transaction'

export type ParsedReceipt = {
  type: TransactionType
  amount: number // paise (integer)
  currency: string
  date: string // YYYY-MM-DD
  time: string | null // HH:MM
  merchant: string | null
  description: string
  upi_ref: string | null
  bank: string | null
  category_hint: string | null
  confidence: Confidence
}
