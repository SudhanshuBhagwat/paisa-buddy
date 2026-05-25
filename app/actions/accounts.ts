'use server'

import { updateTag, refresh } from 'next/cache'
import accountsDb from '@/lib/db/accounts'
import type { Account } from '@/lib/types/account'

export async function createAccount(
  data: Omit<Account, 'id' | 'created_at'>,
): Promise<Account> {
  const account = await accountsDb.insert(data)
  updateTag('accounts')
  refresh()
  return account
}

export async function updateAccount(
  id: string,
  data: Partial<Omit<Account, 'id' | 'created_at'>>,
): Promise<void> {
  await accountsDb.update(id, data)
  updateTag('accounts')
  refresh()
}

export async function deleteAccount(id: string): Promise<void> {
  await accountsDb.delete(id)
  updateTag('accounts')
  refresh()
}
