'use server'

import { randomBytes } from 'crypto'
import { updateTag, refresh } from 'next/cache'
import { settingsDb } from '@/lib/db'
import { getRequiredUserId } from '@/lib/auth/require-user'

export async function addUpiId(upiId: string): Promise<void> {
  const userId = await getRequiredUserId()
  const { upiIds } = await settingsDb.get(userId)
  if (upiIds.includes(upiId)) return
  await settingsDb.upsert(userId, { upiIds: [...upiIds, upiId] })
  updateTag('user-settings')
  refresh()
}

export async function removeUpiId(upiId: string): Promise<void> {
  const userId = await getRequiredUserId()
  const { upiIds } = await settingsDb.get(userId)
  await settingsDb.upsert(userId, { upiIds: upiIds.filter((id) => id !== upiId) })
  updateTag('user-settings')
  refresh()
}

export async function setDisplayName(name: string): Promise<void> {
  const userId = await getRequiredUserId()
  await settingsDb.upsert(userId, { displayName: name || null })
  updateTag('user-settings')
  refresh()
}

export async function ensureUploadToken(): Promise<string> {
  const userId = await getRequiredUserId()
  // Direct (uncached) read so we always see the current token value.
  const { uploadToken } = await settingsDb.get(userId)
  if (uploadToken) return uploadToken
  const token = randomBytes(32).toString('hex')
  await settingsDb.upsert(userId, { uploadToken: token })
  updateTag('user-settings')
  return token
}

export async function regenerateUploadToken(): Promise<string> {
  const userId = await getRequiredUserId()
  const token = randomBytes(32).toString('hex')
  await settingsDb.upsert(userId, { uploadToken: token })
  updateTag('user-settings')
  refresh()
  return token
}

export async function setExpectedMonthlyIncome(paise: number): Promise<void> {
  const userId = await getRequiredUserId()
  await settingsDb.upsert(userId, { expectedMonthlyIncome: paise })
  updateTag('user-settings')
  refresh()
}

export async function completeSetup(displayName: string, upiIds: string[]): Promise<void> {
  const userId = await getRequiredUserId()
  await settingsDb.upsert(userId, {
    displayName: displayName || null,
    upiIds,
    setupCompleted: true,
  })
  updateTag('user-settings')
  refresh()
}
