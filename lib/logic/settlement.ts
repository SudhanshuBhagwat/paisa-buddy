import type { Account } from '@/lib/types/account'
import type { TransactionType } from '@/lib/types/transaction'

export function getSettlementFromAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.type !== 'credit')
}

export function getSettlementToAccounts(accounts: Account[], fromId: string): Account[] {
  return accounts.filter((a) => a.type === 'credit' && a.id !== fromId)
}

export function applySettlementDefaults(
  current: { accountId: string; toAccountId: string },
  accounts: Account[],
): { type: TransactionType; description: string; accountId: string; toAccountId: string } {
  const fromAcc = accounts.find((a) => a.id === current.accountId)
  const toAcc = accounts.find((a) => a.id === current.toAccountId)
  return {
    type: 'transfer',
    description: 'Credit Card Settlement',
    accountId: fromAcc?.type === 'credit' ? '' : current.accountId,
    toAccountId: toAcc?.type !== 'credit' ? '' : current.toAccountId,
  }
}
