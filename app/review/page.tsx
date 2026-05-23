import { Suspense } from 'react'
import { getCachedPendingTransactions } from '@/lib/db/cached-queries'
import { getAllCategories } from '@/lib/db/categories'
import { requireSetup } from '@/lib/auth/require-setup'
import ReviewClient from './ReviewClient'

async function ReviewContent() {
  await requireSetup()
  const [pending, categories] = await Promise.all([
    getCachedPendingTransactions(),
    getAllCategories(),
  ])

  return <ReviewClient transactions={pending} categories={categories} />
}

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewContent />
    </Suspense>
  )
}
