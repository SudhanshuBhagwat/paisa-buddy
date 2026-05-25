import 'server-only'
import type { AccountRepository } from './types'
import type { Account } from '../types/account'
import { getSupabaseClient } from './supabase-client'

class SupabaseAccountRepository implements AccountRepository {
  async getAll(): Promise<Account[]> {
    const { data, error } = await getSupabaseClient()
      .from('accounts')
      .select()
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as Account[]
  }

  async insert(account: Omit<Account, 'id' | 'created_at'>): Promise<Account> {
    const { data, error } = await getSupabaseClient()
      .from('accounts')
      .insert(account)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Account
  }

  async update(id: string, data: Partial<Omit<Account, 'id' | 'created_at'>>): Promise<Account> {
    const { data: updated, error } = await getSupabaseClient()
      .from('accounts')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return updated as Account
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient().from('accounts').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
}

const accountsDb: AccountRepository = new SupabaseAccountRepository()
export default accountsDb
