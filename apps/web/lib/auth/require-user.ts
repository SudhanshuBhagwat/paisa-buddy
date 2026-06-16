import 'server-only'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

/**
 * Returns the current user's id (email) from the NextAuth session.
 * Redirects to /login if no session exists.
 * Use in server components, server actions, and API routes that need userId.
 */
export async function getRequiredUserId(): Promise<string> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) redirect('/login')
  return id
}
