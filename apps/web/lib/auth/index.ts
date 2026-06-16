import 'server-only'
import type { AuthProvider } from './types'
import { NextAuthProvider } from './nextauth.adapter'

// Swap adapter here only
const authProvider: AuthProvider = new NextAuthProvider()
export default authProvider
