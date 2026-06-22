export type TransactionType = 'debit' | 'credit' | 'transfer'
export type Confidence = 'high' | 'medium' | 'low'
export type CategorySource = 'manual' | 'learned' | 'keyword' | 'unknown'
export type DuplicateStatus = 'none' | 'possible_duplicate' | 'confirmed_duplicate' | 'not_duplicate'

export type Transaction = {
  id: string
  user_id: string
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
  raw_description: string | null
  parsed_display_name: string | null
  user_display_name: string | null
  normalized_lookup_key: string | null
  parser_version: string | null
  category_source: CategorySource | null
  dedupe_key: string | null
  import_session_id: string | null
  duplicate_status: DuplicateStatus | null
  duplicate_of_transaction_id: string | null
  category: string | null
  source: 'receipt_ocr' | 'manual' | 'bank_import'
  raw_ai_response: string | null
  confidence: Confidence | null
  reviewed: boolean
  is_recurring: boolean
  recurrence_group: string | null
  investment_id?: string | null
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
