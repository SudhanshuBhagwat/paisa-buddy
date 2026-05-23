import { Suspense } from 'react'
import { cacheTag } from 'next/cache'
import { auth } from '@/auth'
import { getCachedTransactions } from '@/lib/db/cached-queries'
import { getCustomCategories } from '@/lib/db/categories'
import { getUserSettings } from '@/lib/db/user-settings'
import { requireSetup } from '@/lib/auth/require-setup'
import { PREDEFINED_CATEGORIES } from '@/lib/categories'
import SettingsClient from './SettingsClient'

async function SettingsData({ email }: { email: string | null }) {
  'use cache'
  cacheTag('transactions')
  cacheTag('categories')
  cacheTag('user-settings')

  await requireSetup()
  const [transactions, customCategoryNames, { upiIds, displayName }] = await Promise.all([
    getCachedTransactions(),
    getCustomCategories(),
    getUserSettings(),
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
      email={email}
      transactionCount={transactions.length}
      customCategories={customCategories}
      predefinedCategories={predefinedCategories}
      upiIds={upiIds}
      displayName={displayName}
    />
  )
}

async function SettingsContent() {
  const session = await auth()
  return <SettingsData email={session?.user?.email ?? null} />
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}
