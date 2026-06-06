import { Suspense } from 'react'
import { cacheTag } from 'next/cache'
import PageSkeleton from '@/components/PageSkeleton'
import { getCachedTransactions, getCachedCategoriesWithColors, getCachedUserSettings } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import { PREDEFINED_CATEGORIES } from '@/lib/categories'
import { auth } from '@/auth'
import SettingsClient from './SettingsClient'

async function fetchSettingsData(userId: string) {
  'use cache'
  cacheTag('transactions')
  cacheTag('categories')
  cacheTag('user-settings')

  const [transactions, allCategories, { upiIds, displayName }] = await Promise.all([
    getCachedTransactions(userId),
    getCachedCategoriesWithColors(userId),
    getCachedUserSettings(userId),
  ])

  const countFor = (name: string) => transactions.filter((t) => t.category === name).length
  const predefinedSet = new Set<string>(PREDEFINED_CATEGORIES)

  return {
    transactionCount: transactions.length,
    customCategories: allCategories
      .filter((c) => !predefinedSet.has(c.name))
      .map(({ name, color }) => ({ name, color, transactionCount: countFor(name) })),
    predefinedCategories: allCategories
      .filter((c) => predefinedSet.has(c.name))
      .map(({ name, color }) => ({ name, color, transactionCount: countFor(name) })),
    upiIds,
    displayName,
  }
}

async function SettingsContent() {
  const [userId, session] = await Promise.all([getRequiredUserId(), auth()])
  await requireSetup(userId)
  const data = await fetchSettingsData(userId)
  return <SettingsClient email={session?.user?.email ?? null} {...data} />
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  )
}
