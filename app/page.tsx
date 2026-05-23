import { Suspense } from 'react'
import { getCachedTransactions } from '@/lib/db/cached-queries'
import { getAllCategories } from '@/lib/db/categories'
import { requireSetup } from '@/lib/auth/require-setup'
import HomeClient from './HomeClient'

export default async function HomePage() {
  await requireSetup()
  const [transactions, categories] = await Promise.all([
    getCachedTransactions(),
    getAllCategories(),
  ])

  return (
    <Suspense>
      <HomeClient transactions={transactions} categories={categories} />
    </Suspense>
  )
}
