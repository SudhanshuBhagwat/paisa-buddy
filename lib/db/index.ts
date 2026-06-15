import 'server-only'
import type {
  TransactionRepository,
  AccountRepository,
  CategoryRepository,
  UserSettingsRepository,
  InvestmentRepository,
} from './types'
import { PostgresTransactionRepository } from './postgres/transactions'
import { PostgresAccountRepository } from './postgres/accounts'
import { PostgresCategoryRepository } from './postgres/categories'
import { PostgresUserSettingsRepository } from './postgres/user-settings'
import { PostgresInvestmentRepository } from './postgres/investments'

// Swap any adapter here — nothing outside this file knows which DB client is used.
export const db: TransactionRepository = new PostgresTransactionRepository()
export const accountsDb: AccountRepository = new PostgresAccountRepository()
export const categoriesDb: CategoryRepository = new PostgresCategoryRepository()
export const settingsDb: UserSettingsRepository = new PostgresUserSettingsRepository()
export const investmentsDb: InvestmentRepository = new PostgresInvestmentRepository()

export default db
