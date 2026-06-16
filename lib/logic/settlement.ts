import type { Account } from '@/lib/types/account'

export function getSettlementFromAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.type !== 'credit')
}

export function getSettlementToAccounts(accounts: Account[], fromId: string): Account[] {
  return accounts.filter((a) => a.type === 'credit' && a.id !== fromId)
}
