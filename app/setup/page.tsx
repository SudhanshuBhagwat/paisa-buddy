import { redirect } from 'next/navigation'
import { getUserSettings } from '@/lib/db/user-settings'
import SetupClient from './SetupClient'

export default async function SetupPage() {
  const { setupCompleted } = await getUserSettings()
  if (setupCompleted) redirect('/')
  return <SetupClient />
}
