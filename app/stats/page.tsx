import { Suspense } from 'react'
import { getCachedTransactions } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import StatsClient from './StatsClient'
import PageSkeleton from '@/components/PageSkeleton'

async function StatsContent() {
  const userId = await getRequiredUserId()
  const [, transactions] = await Promise.all([
    requireSetup(userId),
    getCachedTransactions(userId),
  ])
  return <StatsClient transactions={transactions} />
}

export default function StatsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StatsContent />
    </Suspense>
  )
}
