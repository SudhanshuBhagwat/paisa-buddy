// Run after filling .env.local:
//   npx tsx --env-file=.env.local scripts/test-db.ts

import db from '../lib/db/index'

async function main() {
  console.log('Inserting test transaction...')
  const tx = await db.insert({
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
    source: 'manual',
    raw_ai_response: null,
    confidence: 'high',
    reviewed: false,
  })
  console.log('Inserted:', tx)

  console.log('\nFetching pending...')
  const pending = await db.getPending()
  console.log('Pending count:', pending.length)

  console.log('\nCleaning up...')
  await db.delete(tx.id)
  console.log('Deleted test transaction.')
  console.log('Phase 2 test passed ✓')
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
