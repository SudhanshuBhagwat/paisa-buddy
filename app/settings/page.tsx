import { Suspense } from 'react'
import { cacheTag } from 'next/cache'
import { auth } from '@/auth'
import { getCachedTransactions } from '@/lib/db/cached-queries'
import { getCustomCategories } from '@/lib/db/categories'
import { getUserSettings } from '@/lib/db/user-settings'
import { requireSetup } from '@/lib/auth/require-setup'
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

  const customCategories = customCategoryNames.map((name) => ({
    name,
    transactionCount: transactions.filter((t) => t.category === name).length,
  }))

  return (
    <SettingsClient
      email={email}
      transactionCount={transactions.length}
      customCategories={customCategories}
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
