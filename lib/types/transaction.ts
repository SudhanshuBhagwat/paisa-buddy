export type TransactionType = 'debit' | 'credit' | 'transfer'
export type Confidence = 'high' | 'medium' | 'low'

export type Transaction = {
  id: string
  account_id: string | null
  to_account_id: string | null
  type: TransactionType
  amount: number // paise (integer), e.g. ₹120.50 = 12050
  currency: string
  date: string // YYYY-MM-DD
  time: string | null // HH:MM
  merchant: string | null
  description: string
  upi_ref: string | null
  bank: string | null
  category: string | null
  source: 'receipt_ocr' | 'manual'
  raw_ai_response: string | null
  confidence: Confidence | null
  reviewed: boolean
  created_at: string
}

export type TransactionFilters = {
  reviewed?: boolean
  type?: TransactionType
  category?: string
  dateFrom?: string // YYYY-MM-DD
  dateTo?: string // YYYY-MM-DD
  search?: string // matches merchant or description
}
