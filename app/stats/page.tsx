import { Suspense } from 'react'
import { getCachedTransactions } from '@/lib/db/cached-queries'
import { requireSetup } from '@/lib/auth/require-setup'
import StatsClient from './StatsClient'

export default async function StatsPage() {
  await requireSetup()
  const transactions = await getCachedTransactions()
  return (
    <Suspense>
      <StatsClient transactions={transactions} />
    </Suspense>
  )
}
