export type AccountType = 'savings' | 'current' | 'credit' | 'wallet' | 'other'

export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  bank: string | null
  currency: string
  opening_balance: number  // paise, set at creation
  current_balance: number  // paise, maintained by app on each confirmed transaction
  created_at: string
}

// Alias kept for backwards compatibility — Account already carries current_balance.
export type AccountWithBalance = Account

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  savings: 'Savings',
  current: 'Current',
  credit: 'Credit Card',
  wallet: 'Wallet',
  other: 'Other',
}
