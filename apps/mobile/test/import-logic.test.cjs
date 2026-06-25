require('./register-ts.cjs')

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  parseTransactionDescription,
  buildTransactionDedupeKey,
} = require('../lib/descriptionParser.ts')
const { detectDuplicate } = require('../lib/importDedup.ts')
const { groupTransactions } = require('../lib/grouping.ts')

function tx(overrides) {
  return {
    id: overrides.id ?? 'tx-existing',
    user_id: 'local',
    account_id: overrides.account_id ?? 'acc-1',
    to_account_id: overrides.to_account_id ?? null,
    type: overrides.type ?? 'debit',
    amount: overrides.amount ?? 50000,
    currency: 'INR',
    date: overrides.date ?? '2026-06-12',
    time: null,
    merchant: overrides.merchant ?? 'Zerodha',
    description: overrides.description ?? 'UPI/DR/123456789012/Zerodha/HDFC/zerodha@hdfcbank',
    upi_ref: overrides.upi_ref ?? '123456789012',
    bank: null,
    raw_description: overrides.raw_description ?? null,
    parsed_display_name: overrides.parsed_display_name ?? overrides.merchant ?? 'Zerodha',
    user_display_name: overrides.user_display_name ?? null,
    normalized_lookup_key: overrides.normalized_lookup_key ?? 'upi|debit|zerodha|hdfc|zerodha@hdfcbank',
    parser_version: 'description-parser-v1',
    category_source: overrides.category_source ?? null,
    dedupe_key: overrides.dedupe_key ?? null,
    import_session_id: overrides.import_session_id ?? null,
    duplicate_status: overrides.duplicate_status ?? 'none',
    duplicate_of_transaction_id: overrides.duplicate_of_transaction_id ?? null,
    category: overrides.category ?? 'Investment',
    source: overrides.source ?? 'manual',
    raw_ai_response: null,
    confidence: null,
    reviewed: overrides.reviewed ?? true,
    is_recurring: false,
    recurrence_group: null,
    investment_id: null,
    created_at: '2026-06-12T00:00:00.000Z',
  }
}

test('description parser preserves raw text and extracts UPI debit fields', () => {
  const raw = 'UPI/DR/123456789012/Rahul Patil/HDFC/rahul@ybl'
  const parsed = parseTransactionDescription(raw)

  assert.equal(parsed.rawDescription, raw)
  assert.equal(parsed.paymentRail, 'UPI')
  assert.equal(parsed.direction, 'DEBIT')
  assert.equal(parsed.referenceNumber, '123456789012')
  assert.equal(parsed.parsedDisplayName, 'Rahul Patil')
  assert.equal(parsed.normalizedLookupKey.includes('123456789012'), false)
  assert.equal(parsed.dedupeKey.includes('123456789012'), true)
  assert.equal(parsed.parserVersion, 'description-parser-v1')
})

test('description parser handles UPI credit and line breaks', () => {
  const parsed = parseTransactionDescription('Paid\nUPI/CR/999988887777/Salary ACME/HDFC/acme@bank')

  assert.equal(parsed.direction, 'CREDIT')
  assert.equal(parsed.parsedDisplayName, 'Salary ACME')
  assert.equal(parsed.cleanedDescription.includes('\n'), false)
})

test('dedupe key includes reference number when available', () => {
  const key = buildTransactionDedupeKey({
    accountId: 'acc-1',
    date: '2026-06-12',
    amount: 50000,
    direction: 'DEBIT',
    normalizedLookupKey: 'upi|debit|zerodha',
    referenceNumber: '123456789012',
  })

  assert.equal(key, 'acc-1|2026-06-12|50000|debit|123456789012')
})

test('confirmed duplicate matches same account amount date direction and UPI ref', () => {
  const existing = tx({})
  const row = {
    type: 'debit',
    amount: 50000,
    date: '2026-06-12',
    account_id: 'acc-1',
    upi_ref: '123456789012',
    normalized_lookup_key: 'upi|debit|zerodha|hdfc|zerodha@hdfcbank',
  }

  assert.deepEqual(detectDuplicate(row, [existing]), {
    status: 'confirmed_duplicate',
    duplicateOfTransactionId: 'tx-existing',
  })
})

test('possible duplicate matches nearby date and lookup key without reference', () => {
  const existing = tx({ upi_ref: null, date: '2026-06-11' })
  const row = {
    type: 'debit',
    amount: 50000,
    date: '2026-06-12',
    account_id: 'acc-1',
    upi_ref: null,
    normalized_lookup_key: 'upi|debit|zerodha|hdfc|zerodha@hdfcbank',
  }

  assert.deepEqual(detectDuplicate(row, [existing]), {
    status: 'possible_duplicate',
    duplicateOfTransactionId: 'tx-existing',
  })
})

test('same amount and date with different merchant is not duplicate', () => {
  const existing = tx({ normalized_lookup_key: 'upi|debit|apple' })
  const row = {
    type: 'debit',
    amount: 50000,
    date: '2026-06-12',
    account_id: 'acc-1',
    upi_ref: null,
    normalized_lookup_key: 'upi|debit|zerodha',
  }

  assert.equal(detectDuplicate(row, [existing]).status, 'none')
})

test('grouping combines repeated merchants and leaves singles separate', () => {
  const result = groupTransactions([
    tx({ id: 'a', merchant: 'Apple Services', normalized_lookup_key: 'apple services' }),
    tx({ id: 'b', merchant: 'APPLE SERVICES', normalized_lookup_key: 'apple services' }),
    tx({ id: 'c', merchant: 'Zomato', normalized_lookup_key: 'zomato' }),
  ])

  assert.equal(result.groups.length, 1)
  assert.equal(result.groups[0].transactions.length, 2)
  assert.equal(result.singles.length, 1)
})
