import 'server-only'
import { auth } from '@/auth'
import type { AuthProvider, AuthUser } from './types'

export class NextAuthProvider implements AuthProvider {
  async getSession(): Promise<AuthUser | null> {
    const session = await auth()
    if (!session?.user?.email) return null
    return {
      id: session.user.id ?? session.user.email,
      email: session.user.email,
    }
  }
}
