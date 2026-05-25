import { Suspense } from 'react'
import { getCachedAccounts, getCachedTransactions } from '@/lib/db/cached-queries'
import { requireSetup } from '@/lib/auth/require-setup'
import { toAccountsWithBalance } from '@/lib/utils'
import AccountsClient from './AccountsClient'

async function AccountsContent() {
  await requireSetup()
  const [accounts, transactions] = await Promise.all([
    getCachedAccounts(),
    getCachedTransactions(),
  ])
  return <AccountsClient accounts={toAccountsWithBalance(accounts, transactions)} />
}

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsContent />
    </Suspense>
  )
}
