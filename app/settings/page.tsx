import { Suspense } from 'react'
import { cacheTag } from 'next/cache'
import PageSkeleton from '@/components/PageSkeleton'
import { getCachedTransactions, getCachedCustomCategories, getCachedUserSettings } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import { PREDEFINED_CATEGORIES } from '@/lib/categories'
import SettingsClient from './SettingsClient'

async function SettingsData({ userId }: { userId: string }) {
  'use cache'
  cacheTag('transactions')
  cacheTag('categories')
  cacheTag('user-settings')

  const [transactions, customCategoryNames, { upiIds, displayName }] = await Promise.all([
    getCachedTransactions(userId),
    getCachedCustomCategories(),
    getCachedUserSettings(userId),
  ])

  const countFor = (name: string) => transactions.filter((t) => t.category === name).length

  const customCategories = customCategoryNames.map((name) => ({
    name,
    transactionCount: countFor(name),
  }))

  const predefinedCategories = PREDEFINED_CATEGORIES.map((name) => ({
    name,
    transactionCount: countFor(name),
  }))

  return (
    <SettingsClient
      email={userId}
      transactionCount={transactions.length}
      customCategories={customCategories}
      predefinedCategories={predefinedCategories}
      upiIds={upiIds}
      displayName={displayName}
    />
  )
}

async function SettingsContent() {
  const userId = await getRequiredUserId()
  await requireSetup(userId)
  return <SettingsData userId={userId} />
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  )
}
