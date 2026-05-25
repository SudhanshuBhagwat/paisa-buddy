import { Suspense } from 'react'
import { getCachedTransactions, getCachedAccounts } from '@/lib/db/cached-queries'
import { getAllCategories } from '@/lib/db/categories'
import { requireSetup } from '@/lib/auth/require-setup'
import { toAccountsWithBalance } from '@/lib/utils'
import HomeClient from './HomeClient'

async function HomeContent() {
  await requireSetup()
  const [transactions, categories, accounts] = await Promise.all([
    getCachedTransactions(),
    getAllCategories(),
    getCachedAccounts(),
  ])
  return (
    <HomeClient
      transactions={transactions}
      categories={categories}
      accounts={toAccountsWithBalance(accounts, transactions)}
    />
  )
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}
