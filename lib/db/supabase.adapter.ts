import 'server-only'
import type { TransactionRepository } from './types'
import type { Transaction, TransactionFilters } from '../types/transaction'
import { getSupabaseClient } from './supabase-client'
import { detectRecurringGroups } from '../recurring'

type DbRow = Omit<Transaction, 'description'> & { description: string | null }

function rowToTransaction(row: DbRow): Transaction {
  return { ...row, description: row.description ?? '' }
}

export class SupabaseTransactionRepository implements TransactionRepository {
  async insert(tx: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
    const { data, error } = await getSupabaseClient()
      .from('transactions')
      .insert(tx)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return rowToTransaction(data as DbRow)
  }

  async getPending(): Promise<Transaction[]> {
    const { data, error } = await getSupabaseClient()
      .from('transactions')
      .select()
      .eq('reviewed', false)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => rowToTransaction(r as DbRow))
  }

  async getAll(filters?: TransactionFilters): Promise<Transaction[]> {
    let query = getSupabaseClient().from('transactions').select()

    if (filters?.reviewed !== undefined) query = query.eq('reviewed', filters.reviewed)
    if (filters?.type) query = query.eq('type', filters.type)
    if (filters?.category) query = query.eq('category', filters.category)
    if (filters?.dateFrom) query = query.gte('date', filters.dateFrom)
    if (filters?.dateTo) query = query.lte('date', filters.dateTo)
    if (filters?.search) {
      query = query.or(
        `merchant.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
      )
    }

    const { data, error } = await query.order('date', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => rowToTransaction(r as DbRow))
  }

  async update(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const { data, error } = await getSupabaseClient()
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return rowToTransaction(data as DbRow)
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient().from('transactions').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async detectRecurring(): Promise<void> {
    const { data, error } = await getSupabaseClient()
      .from('transactions')
      .select()
      .eq('reviewed', true)
      .not('merchant', 'is', null)
    if (error) throw new Error(error.message)

    const txs = (data ?? []).map((r) => rowToTransaction(r as DbRow))
    const updates = detectRecurringGroups(txs)
    if (updates.length === 0) return

    const byGroup = new Map<string, string[]>()
    for (const u of updates) {
      if (!byGroup.has(u.recurrence_group)) byGroup.set(u.recurrence_group, [])
      byGroup.get(u.recurrence_group)!.push(u.id)
    }

    await Promise.all(
      Array.from(byGroup.entries()).map(([groupId, ids]) =>
        getSupabaseClient()
          .from('transactions')
          .update({ is_recurring: true, recurrence_group: groupId })
          .in('id', ids),
      ),
    )
  }
}
