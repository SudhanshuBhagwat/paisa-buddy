import { Suspense } from 'react'
import { getCachedAccounts, getCachedTransactions } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import { toAccountsWithBalance } from '@/lib/utils'
import AccountsClient from './AccountsClient'
import PageSkeleton from '@/components/PageSkeleton'

async function AccountsContent() {
  const userId = await getRequiredUserId()
  await requireSetup(userId)
  const [accounts, transactions] = await Promise.all([
    getCachedAccounts(userId),
    getCachedTransactions(userId),
  ])
  return <AccountsClient accounts={toAccountsWithBalance(accounts, transactions)} />
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountsContent />
    </Suspense>
  )
}
