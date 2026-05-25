import type { Transaction, TransactionFilters } from '../types/transaction'
import type { Account } from '../types/account'

export interface TransactionRepository {
  insert(tx: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction>
  getPending(): Promise<Transaction[]>
  getAll(filters?: TransactionFilters): Promise<Transaction[]>
  update(id: string, data: Partial<Transaction>): Promise<Transaction>
  delete(id: string): Promise<void>
}

export interface AccountRepository {
  getAll(): Promise<Account[]>
  insert(account: Omit<Account, 'id' | 'created_at'>): Promise<Account>
  update(id: string, data: Partial<Omit<Account, 'id' | 'created_at'>>): Promise<Account>
  delete(id: string): Promise<void>
}
