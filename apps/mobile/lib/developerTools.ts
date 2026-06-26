import { getDb } from '../db/database'
import { generateId } from './id'
import { generateBackupJson } from '../repositories/backupRepository'
import { getSettingsData, getHomeData, getStatsData } from './data'
import { toYearMonth } from '@paisa-buddy/shared/logic/date'
import type { TransactionType } from '@paisa-buddy/shared/types/transaction'

const DEMO_PREFIX = '[DEMO]'
const DEMO_ACCOUNTS = [
  { name: 'Demo Savings', type: 'savings', bank: 'Paisa Demo Bank', opening: 12500000 },
  { name: 'Demo Wallet', type: 'savings', bank: 'Paisa Demo Wallet', opening: 250000 },
]
const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Utilities', 'Family', 'Rent', 'Investment', 'Subscriptions']
const MERCHANTS = ['Zomato Demo', 'Metro Demo', 'Groceries Demo', 'Pharmacy Demo', 'Utilities Demo', 'Streaming Demo', 'Fuel Demo', 'Cafe Demo']

type DemoAccount = { id: string; name: string }

export type DeveloperPerformanceData = {
  homeLoadMs: number
  monthLoadMs: number
  settingsLoadMs: number
  transactionCount: number
  databaseSizeEstimate: number
  backupSizeEstimate: number
  latestImportCount: number
  reviewSessionCount: number
}

async function timeMs<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now()
  const value = await fn()
  return { value, ms: Date.now() - start }
}

async function ensureDemoAccounts(): Promise<DemoAccount[]> {
  const db = getDb()
  const existing = await db.getAllAsync<DemoAccount>(
    `SELECT id, name FROM accounts
     WHERE name IN (?, ?)
     ORDER BY created_at ASC`,
    DEMO_ACCOUNTS.map((account) => account.name),
  )
  const found = new Map(existing.map((account) => [account.name, account.id]))
  const now = new Date().toISOString()

  for (const account of DEMO_ACCOUNTS) {
    if (found.has(account.name)) continue
    const id = generateId()
    await db.runAsync(
      'INSERT INTO accounts (id, name, type, bank, opening_balance, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, account.name, account.type, account.bank, account.opening, now],
    )
    found.set(account.name, id)
  }

  return DEMO_ACCOUNTS.map((account) => ({ id: found.get(account.name)!, name: account.name }))
}

function demoDate(index: number): string {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() - (index % 18))
  date.setDate((index % 27) + 1)
  return date.toISOString().slice(0, 10)
}

function demoTime(index: number): string {
  return `${String(8 + (index % 12)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`
}

function demoType(index: number): TransactionType {
  if (index % 17 === 0) return 'transfer'
  if (index % 9 === 0) return 'credit'
  return 'debit'
}

export async function generateDemoTransactions(count: number): Promise<number> {
  const db = getDb()
  const accounts = await ensureDemoAccounts()
  const now = new Date().toISOString()

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < count; i++) {
      const type = demoType(i)
      const from = accounts[i % accounts.length]
      const to = accounts[(i + 1) % accounts.length]
      const category = type === 'credit' ? 'Income' : type === 'transfer' ? 'Transfer' : CATEGORIES[i % CATEGORIES.length]
      const merchant = type === 'credit' ? 'Demo Salary' : type === 'transfer' ? 'Demo Transfer' : MERCHANTS[i % MERCHANTS.length]
      const amount = type === 'credit'
        ? 4500000 + (i % 5) * 250000
        : type === 'transfer'
          ? 50000 + (i % 20) * 10000
          : 7500 + (i % 40) * 1250

      await db.runAsync(
        `INSERT INTO transactions
          (id, type, amount, date, time, merchant, description, category,
           account_id, to_account_id, is_recurring, reviewed, source, raw_description,
           parsed_display_name, normalized_lookup_key, parser_version, category_source,
           dedupe_key, duplicate_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 'manual', ?, ?, ?, 'demo-generator-v1', 'manual', ?, 'none', ?)`,
        [
          generateId(),
          type,
          amount,
          demoDate(i),
          demoTime(i),
          merchant,
          `${DEMO_PREFIX} ${merchant} ${i + 1}`,
          category,
          from.id,
          type === 'transfer' ? to.id : null,
          `${DEMO_PREFIX} ${merchant} ${i + 1}`,
          merchant,
          `demo-${merchant.toLowerCase().replace(/\s+/g, '-')}`,
          `demo-${count}-${i}`,
          now,
        ],
      )
    }
  })

  return count
}

export async function clearDemoTransactions(): Promise<number> {
  const db = getDb()
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM transactions WHERE description LIKE '[DEMO]%'",
  )
  await db.runAsync("DELETE FROM transactions WHERE description LIKE '[DEMO]%'")
  return row?.count ?? 0
}

async function estimateDatabaseSize(): Promise<number> {
  const db = getDb()
  const [pageCount, pageSize] = await Promise.all([
    db.getFirstAsync<{ page_count: number }>('PRAGMA page_count'),
    db.getFirstAsync<{ page_size: number }>('PRAGMA page_size'),
  ])
  return (pageCount?.page_count ?? 0) * (pageSize?.page_size ?? 0)
}

export async function getDeveloperPerformanceData(): Promise<DeveloperPerformanceData> {
  const month = toYearMonth(new Date())
  const home = await timeMs(getHomeData)
  const stats = await timeMs(() => getStatsData(month))
  const settings = await timeMs(getSettingsData)
  const [databaseSizeEstimate, backupJson] = await Promise.all([
    estimateDatabaseSize(),
    generateBackupJson(),
  ])
  const settingsData = settings.value.settings

  return {
    homeLoadMs: home.ms,
    monthLoadMs: stats.ms,
    settingsLoadMs: settings.ms,
    transactionCount: settingsData.txCount,
    databaseSizeEstimate,
    backupSizeEstimate: backupJson.length,
    latestImportCount: settingsData.latestImportTxCount,
    reviewSessionCount: settingsData.reviewSessionCount,
  }
}
