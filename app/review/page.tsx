import { Suspense } from 'react'
import { getCachedPendingTransactions, getCachedAccounts, getCachedCategoriesWithColors } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import ReviewClient from './ReviewClient'
import PageSkeleton from '@/components/PageSkeleton'

async function ReviewContent() {
  const userId = await getRequiredUserId()
  const [, pending, allCategories, accounts] = await Promise.all([
    requireSetup(userId),
    getCachedPendingTransactions(userId),
    getCachedCategoriesWithColors(userId),
    getCachedAccounts(userId),
  ])
  const categoryColors = Object.fromEntries(allCategories.map((c) => [c.name, c.color]))
  return <ReviewClient transactions={pending} categories={allCategories.map((c) => c.name)} accounts={accounts} categoryColors={categoryColors} />
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReviewContent />
    </Suspense>
  )
}
