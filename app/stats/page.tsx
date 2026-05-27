import { Suspense } from 'react'
import { getCachedTransactions } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import StatsClient from './StatsClient'

async function StatsContent() {
  const userId = await getRequiredUserId()
  await requireSetup(userId)
  const transactions = await getCachedTransactions(userId)
  return <StatsClient transactions={transactions} />
}

export default function StatsPage() {
  return (
    <Suspense>
      <StatsContent />
    </Suspense>
  )
}
