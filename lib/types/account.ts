export type AccountType = 'savings' | 'current' | 'credit' | 'wallet' | 'other'

export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  bank: string | null
  currency: string
  opening_balance: number // paise
  created_at: string
}

export type AccountWithBalance = Account & { current_balance: number }

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  savings: 'Savings',
  current: 'Current',
  credit: 'Credit Card',
  wallet: 'Wallet',
  other: 'Other',
}
