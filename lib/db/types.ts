import type { Transaction, TransactionFilters } from '../types/transaction'
import type { Account } from '../types/account'
import type { Investment, InvestmentWithTotal } from '../types/investment'
import type { Budget, BudgetWithSpent } from '../types/budget'
export type { Investment, InvestmentWithTotal }
export type { BudgetWithSpent }

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface UserSettings {
  upiIds: string[]
  displayName: string | null
  setupCompleted: boolean
  uploadToken: string | null
  expectedMonthlyIncome: number
  shortcutBannerDismissed: boolean
}

// ---------------------------------------------------------------------------
// Repository interfaces
// All Supabase (or any other DB) details live behind these contracts.
// To swap providers: implement the interfaces in a new adapter file and
// update lib/db/index.ts — nothing else changes.
// ---------------------------------------------------------------------------

export interface TransactionRepository {
  /** Insert a new transaction scoped to userId. */
  insert(
    userId: string,
    tx: Omit<Transaction, 'id' | 'created_at' | 'user_id'>,
  ): Promise<Transaction>

  /** All unreviewed transactions for the user, newest first. */
  getPending(userId: string): Promise<Transaction[]>

  /** All transactions for the user, with optional filters. */
  getAll(userId: string, filters?: TransactionFilters): Promise<Transaction[]>

  /** Partial update — only mutates the user's own transaction. */
  update(
    userId: string,
    id: string,
    data: Partial<Omit<Transaction, 'id' | 'created_at' | 'user_id'>>,
  ): Promise<Transaction>

  /** Delete a single transaction owned by the user. */
  delete(userId: string, id: string): Promise<void>

  /** Delete ALL transactions for the user (e.g. dev reset). */
  deleteAll(userId: string): Promise<void>

  /** Re-run recurring detection over the user's reviewed transactions. */
  detectRecurring(userId: string): Promise<void>
}

export interface AccountRepository {
  getAll(userId: string): Promise<Account[]>
  insert(
    userId: string,
    account: Omit<Account, 'id' | 'created_at' | 'user_id' | 'current_balance'>,
  ): Promise<Account>
  update(
    userId: string,
    id: string,
    data: Partial<Omit<Account, 'id' | 'created_at' | 'user_id' | 'current_balance'>>,
  ): Promise<Account>
  delete(userId: string, id: string): Promise<void>
}

export interface CategoryWithColor {
  name: string
  color: string
}

/** Custom categories are user-scoped. Predefined categories live in code (lib/categories.ts). */
export interface CategoryRepository {
  getCustomWithColors(userId: string): Promise<CategoryWithColor[]>
  upsertCustom(userId: string, name: string, color: string): Promise<void>
  deleteCustom(userId: string, name: string): Promise<void>
  deleteCustomAndUnlinkTransactions(userId: string, name: string): Promise<void>
}

export interface InvestmentRepository {
  getAll(userId: string): Promise<InvestmentWithTotal[]>
  insert(userId: string, name: string): Promise<Investment>
  update(userId: string, id: string, name: string): Promise<Investment>
  delete(userId: string, id: string): Promise<void>
}

export interface BudgetRepository {
  getAll(userId: string, yearMonth: string): Promise<BudgetWithSpent[]>
  upsert(userId: string, category: string, amount: number): Promise<Budget>
  delete(userId: string, id: string): Promise<void>
}

export interface UserSettingsRepository {
  /** Returns settings for userId; returns safe defaults if no row exists yet. */
  get(userId: string): Promise<UserSettings>

  /**
   * Partial upsert — creates row on first call, updates individual fields thereafter.
   * Fields not included in `data` are left untouched on UPDATE.
   */
  upsert(
    userId: string,
    data: Partial<Pick<UserSettings, 'upiIds' | 'displayName' | 'setupCompleted' | 'uploadToken' | 'expectedMonthlyIncome' | 'shortcutBannerDismissed'>>,
  ): Promise<void>

  /** Look up owner by upload token for token-authenticated API routes. */
  getByUploadToken(
    token: string,
  ): Promise<{ userId: string; displayName: string | null; upiIds: string[] } | null>
}
