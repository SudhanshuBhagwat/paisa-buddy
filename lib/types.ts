export type TransactionType = 'credit' | 'debit' | 'transfer'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number // stored in paise (integer), e.g. ₹120.50 = 12050
  category: string
  notes?: string
  date: string // YYYY-MM-DD
  createdAt: string // ISO timestamp
}

export interface AppState {
  transactions: Transaction[]
  customCategories: string[]
  darkMode: boolean
}

export type Action =
  | { type: 'ADD_TX'; payload: Transaction }
  | { type: 'DELETE_TX'; payload: string }
  | { type: 'ADD_CATEGORY'; payload: string }
  | { type: 'REMOVE_CATEGORY'; payload: string }
  | { type: 'SET_DARK_MODE'; payload: boolean }
  | { type: 'CLEAR_ALL' }
  | { type: 'HYDRATE'; payload: AppState }
