import { Suspense } from 'react'
import { getCachedTransactionsByMonth, getCachedCategoriesWithColors } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import { toYearMonth } from '@/lib/utils'
import StatsClient from './StatsClient'
import PageSkeleton from '@/components/PageSkeleton'

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function StatsContent({ searchParams }: Props) {
  const userId = await getRequiredUserId()
  const { month: raw } = await searchParams
  const month =
    typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw) ? raw : toYearMonth(new Date())

  const [, transactions, allCategories] = await Promise.all([
    requireSetup(userId),
    getCachedTransactionsByMonth(userId, month),
    getCachedCategoriesWithColors(userId),
  ])

  const categoryColorMap = Object.fromEntries(allCategories.map((c) => [c.name, c.color]))

  return <StatsClient transactions={transactions} month={month} categoryColorMap={categoryColorMap} />
}

export default function StatsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StatsContent searchParams={searchParams} />
    </Suspense>
  )
}
