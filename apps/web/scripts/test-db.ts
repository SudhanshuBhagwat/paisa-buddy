// Run after filling .env.local:
//   npx tsx --env-file=.env.local scripts/test-db.ts

import { db } from '../lib/db/index'

// Use your actual login email when running locally.
const TEST_USER = process.env.TEST_USER_EMAIL ?? 'test@example.com'

async function main() {
  console.log(`Testing with user: ${TEST_USER}`)

  console.log('Inserting test transaction...')
  const tx = await db.insert(TEST_USER, {
    type: 'debit',
    amount: 12050, // ₹120.50 in paise
    currency: 'INR',
    date: '2026-05-23',
    time: '10:30',
    merchant: 'Test Merchant',
    description: 'Phase 2 test',
    upi_ref: 'UPI123456789',
    bank: 'HDFC',
    category: 'Food',
    account_id: null,
    to_account_id: null,
    source: 'manual',
    raw_ai_response: null,
    confidence: 'high',
    reviewed: false,
    is_recurring: false,
    recurrence_group: null,
  })
  console.log('Inserted:', tx)

  console.log('\nFetching pending...')
  const pending = await db.getPending(TEST_USER)
  console.log('Pending count:', pending.length)

  console.log('\nCleaning up...')
  await db.delete(TEST_USER, tx.id)
  console.log('Deleted test transaction.')
  console.log('Test passed ✓')
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
