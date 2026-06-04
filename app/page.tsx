import { Suspense } from 'react'
import {
  getCachedTransactionsByMonth,
  getCachedAccounts,
  getCachedCategories,
  getCachedPendingTransactions,
} from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import { toYearMonth } from '@/lib/utils'
import HomeClient from './HomeClient'
import PageSkeleton from '@/components/PageSkeleton'

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function HomeContent({ searchParams }: Props) {
  const userId = await getRequiredUserId()
  const { month: raw } = await searchParams
  const month =
    typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw) ? raw : toYearMonth(new Date())

  const [, transactions, categories, accounts, pending] = await Promise.all([
    requireSetup(userId),
    getCachedTransactionsByMonth(userId, month),
    getCachedCategories(),
    getCachedAccounts(userId),
    getCachedPendingTransactions(userId),
  ])

  return (
    <HomeClient
      transactions={transactions}
      categories={categories}
      accounts={accounts}
      month={month}
      pendingCount={pending.length}
    />
  )
}

export default function HomePage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  )
}
