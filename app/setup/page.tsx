import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { settingsDb } from '@/lib/db'
import { getRequiredUserId } from '@/lib/auth/require-user'
import SetupClient from './SetupClient'

async function SetupContent() {
  const userId = await getRequiredUserId()
  const { setupCompleted } = await settingsDb.get(userId)
  if (setupCompleted) redirect('/')
  return <SetupClient />
}

export default function SetupPage() {
  return (
    <Suspense>
      <SetupContent />
    </Suspense>
  )
}
