import { Suspense } from 'react'
import { getCachedPendingTransactions, getCachedAccounts, getCachedCategories } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import ReviewClient from './ReviewClient'

async function ReviewContent() {
  const userId = await getRequiredUserId()
  await requireSetup(userId)
  const [pending, categories, accounts] = await Promise.all([
    getCachedPendingTransactions(userId),
    getCachedCategories(),
    getCachedAccounts(userId),
  ])
  return <ReviewClient transactions={pending} categories={categories} accounts={accounts} />
}

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewContent />
    </Suspense>
  )
}
