import { Suspense } from 'react'
import { getCachedTransactions } from '@/lib/db/cached-queries'
import { getAllCategories } from '@/lib/db/categories'
import { requireSetup } from '@/lib/auth/require-setup'
import HomeClient from './HomeClient'

async function HomeContent() {
  await requireSetup()
  const [transactions, categories] = await Promise.all([
    getCachedTransactions(),
    getAllCategories(),
  ])
  return <HomeClient transactions={transactions} categories={categories} />
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}
