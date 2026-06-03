import { Suspense } from 'react'
import { getCachedTransactions, getCachedAccounts, getCachedCategories } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import { toAccountsWithBalance } from '@/lib/utils'
import HomeClient from './HomeClient'
import PageSkeleton from '@/components/PageSkeleton'

async function HomeContent() {
  const userId = await getRequiredUserId()
  await requireSetup(userId)
  const [transactions, categories, accounts] = await Promise.all([
    getCachedTransactions(userId),
    getCachedCategories(),
    getCachedAccounts(userId),
  ])
  return (
    <HomeClient
      transactions={transactions}
      categories={categories}
      accounts={toAccountsWithBalance(accounts, transactions)}
    />
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeContent />
    </Suspense>
  )
}
