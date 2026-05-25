import { Suspense } from 'react'
import { getCachedPendingTransactions, getCachedAccounts } from '@/lib/db/cached-queries'
import { getAllCategories } from '@/lib/db/categories'
import { requireSetup } from '@/lib/auth/require-setup'
import ReviewClient from './ReviewClient'

async function ReviewContent() {
  await requireSetup()
  const [pending, categories, accounts] = await Promise.all([
    getCachedPendingTransactions(),
    getAllCategories(),
    getCachedAccounts(),
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
