import 'server-only'
import { redirect } from 'next/navigation'

export async function requireSetup(userId: string): Promise<void> {
  const { getCachedUserSettings } = await import('@/lib/db/cached-queries')
  const { setupCompleted } = await getCachedUserSettings(userId)
  if (!setupCompleted) redirect('/setup')
}
