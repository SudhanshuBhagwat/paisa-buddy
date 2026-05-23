import type { Transaction, TransactionFilters } from '../types/transaction'

export interface TransactionRepository {
  insert(tx: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction>
  getPending(): Promise<Transaction[]>
  getAll(filters?: TransactionFilters): Promise<Transaction[]>
  update(id: string, data: Partial<Transaction>): Promise<Transaction>
  delete(id: string): Promise<void>
}
