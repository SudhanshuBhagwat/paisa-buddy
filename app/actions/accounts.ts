'use server'

import { updateTag, refresh } from 'next/cache'
import { accountsDb } from '@/lib/db'
import { getRequiredUserId } from '@/lib/auth/require-user'
import type { Account } from '@/lib/types/account'

export async function createAccount(
  data: Omit<Account, 'id' | 'created_at' | 'user_id' | 'current_balance'>,
): Promise<Account> {
  const userId = await getRequiredUserId()
  const account = await accountsDb.insert(userId, data)
  updateTag('accounts')
  refresh()
  return account
}

export async function updateAccount(
  id: string,
  data: Partial<Omit<Account, 'id' | 'created_at' | 'user_id'>>,
): Promise<void> {
  const userId = await getRequiredUserId()
  await accountsDb.update(userId, id, data)
  updateTag('accounts')
  refresh()
}

export async function deleteAccount(id: string): Promise<void> {
  const userId = await getRequiredUserId()
  await accountsDb.delete(userId, id)
  updateTag('accounts')
  refresh()
}
