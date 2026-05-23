import { Suspense } from 'react'
import { auth } from '@/auth'
import { getCachedTransactions } from '@/lib/db/cached-queries'
import { getCustomCategories } from '@/lib/db/categories'
import { getUserSettings } from '@/lib/db/user-settings'
import { requireSetup } from '@/lib/auth/require-setup'
import SettingsClient from './SettingsClient'

async function SettingsContent() {
  await requireSetup()
  const [session, transactions, customCategoryNames, { upiIds, displayName }] = await Promise.all([
    auth(),
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
      email={session?.user?.email ?? null}
      transactionCount={transactions.length}
      customCategories={customCategories}
      upiIds={upiIds}
      displayName={displayName}
    />
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}
