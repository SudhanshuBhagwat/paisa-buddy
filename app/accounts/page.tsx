import { Suspense } from 'react'
import { getCachedAccounts } from '@/lib/db/cached-queries'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { requireSetup } from '@/lib/auth/require-setup'
import AccountsClient from './AccountsClient'
import PageSkeleton from '@/components/PageSkeleton'

async function AccountsContent() {
  const userId = await getRequiredUserId()
  const [, accounts] = await Promise.all([
    requireSetup(userId),
    getCachedAccounts(userId),
  ])
  return <AccountsClient accounts={accounts} />
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountsContent />
    </Suspense>
  )
}
