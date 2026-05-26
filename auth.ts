import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'

// Imported dynamically inside authorize to avoid server-only import at build time
async function verifyToken(email: string, token: string): Promise<boolean> {
  const { verifyOTP } = await import('@/lib/auth/otp')
  return verifyOTP(email, token)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), token: z.string().length(6) })
          .safeParse(credentials)
        if (!parsed.success) return null

        const valid = await verifyToken(parsed.data.email, parsed.data.token)
        if (!valid) return null

        return { id: parsed.data.email, email: parsed.data.email, name: null }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session
      const path = request.nextUrl.pathname

      if (path.startsWith('/login')) {
        if (isLoggedIn) return Response.redirect(new URL('/', request.nextUrl))
        return true
      }

      // Token-authenticated API routes — skip session check
      if (path.startsWith('/api/receipts/upload')) return true
      if (path.startsWith('/api/transactions/quick')) return true

      if (!isLoggedIn) return Response.redirect(new URL('/login', request.nextUrl))
      return true
    },
    jwt({ token, user }) {
      if (user?.email) {
        token.id = user.id ?? user.email
        token.email = user.email
      }
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      if (token.email) session.user.email = token.email as string
      return session
    },
  },
})
