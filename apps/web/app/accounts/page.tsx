import { Suspense } from 'react'
import { getCachedAccounts, getCachedInvestments } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import AccountsClient from './AccountsClient'
import PageSkeleton from '@/components/PageSkeleton'

async function AccountsContent() {
  const userId = await getRequiredUserId()
  const [, accounts, investments] = await Promise.all([
    requireSetup(userId),
    getCachedAccounts(userId),
    getCachedInvestments(userId),
  ])
  return <AccountsClient accounts={accounts} investments={investments} />
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountsContent />
    </Suspense>
  )
}
