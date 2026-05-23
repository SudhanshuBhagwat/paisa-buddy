import { Suspense } from 'react'
import { getCachedTransactions } from '@/lib/db/cached-queries'
import { requireSetup } from '@/lib/auth/require-setup'
import StatsClient from './StatsClient'

async function StatsContent() {
  await requireSetup()
  const transactions = await getCachedTransactions()
  return <StatsClient transactions={transactions} />
}

export default function StatsPage() {
  return (
    <Suspense>
      <StatsContent />
    </Suspense>
  )
}
