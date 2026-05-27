import 'server-only'
import { redirect } from 'next/navigation'

export async function requireSetup(userId: string): Promise<void> {
  // Import lazily to avoid circular: require-setup → db/index → supabase/...
  const { settingsDb } = await import('@/lib/db')
  const { setupCompleted } = await settingsDb.get(userId)
  if (!setupCompleted) redirect('/setup')
}
