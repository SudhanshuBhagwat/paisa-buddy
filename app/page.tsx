import { Suspense } from 'react'
import { getCachedTransactions, getCachedAccounts } from '@/lib/db/cached-queries'
import { categoriesDb } from '@/lib/db'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import { toAccountsWithBalance } from '@/lib/utils'
import HomeClient from './HomeClient'

async function HomeContent() {
  const userId = await getRequiredUserId()
  await requireSetup(userId)
  const [transactions, categories, accounts] = await Promise.all([
    getCachedTransactions(userId),
    categoriesDb.getAll(),
    getCachedAccounts(userId),
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
