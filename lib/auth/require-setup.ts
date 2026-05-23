import 'server-only'
import { redirect } from 'next/navigation'
import { getUserSettings } from '@/lib/db/user-settings'

export async function requireSetup(): Promise<void> {
  const { setupCompleted } = await getUserSettings()
  if (!setupCompleted) redirect('/setup')
}
