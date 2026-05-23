import 'server-only'
import type { TransactionRepository } from './types'
import { SupabaseTransactionRepository } from './supabase.adapter'

// Swap adapter here only
const db: TransactionRepository = new SupabaseTransactionRepository()
export default db
