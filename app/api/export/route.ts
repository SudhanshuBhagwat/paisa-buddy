import ExcelJS from 'exceljs'
import { getRequiredUserId } from '@/lib/auth/require-user'
import {
  getCachedTransactions,
  getCachedAccounts,
  getCachedCategoriesWithColors,
} from '@/lib/db/cached-queries'
import { ACCOUNT_TYPE_LABELS } from '@/lib/types/account'
import type { Transaction } from '@/lib/types/transaction'
import type { Account } from '@/lib/types/account'
import type { CategoryWithColor } from '@/lib/db/types'

// ── palette (ARGB) ────────────────────────────────────────────────────────────
const C = {
  brand:       'FF1A936F',
  brandDeep:   'FF0D5C41',
  brandPale:   'FFD8F3DC',
  pending:     'FFFFF9C4',
  debit:       'FFC0392B',
  credit:      'FF157F4C',
  transfer:    'FF2D7DD2',
  white:       'FFFFFFFF',
  ink:         'FF1A1A1A',
  ink3:        'FF888888',
  line:        'FFE0E0E0',
  totalRow:    'FFF0FAF4',
}

const RUPEE_FMT = '"₹"#,##0.00'

function paise(n: number) { return n / 100 }

function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

function sheetName(yearMonth: string): string {
  const [y, m] = yearMonth.split('-')
  const d = new Date(Number(y), Number(m) - 1)
  return d.toLocaleString('en-IN', { month: 'short' }) + ' ' + y
}

type FillSolid = ExcelJS.FillPattern & { type: 'pattern'; pattern: 'solid' }
function solid(argb: string): FillSolid {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function styleCell(
  cell: ExcelJS.Cell,
  opts: {
    bg?: string
    bold?: boolean
    color?: string
    size?: number
    align?: ExcelJS.Alignment['horizontal']
    numFmt?: string
    italic?: boolean
  },
) {
  if (opts.bg) cell.fill = solid(opts.bg)
  cell.font = {
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    color: { argb: opts.color ?? C.ink },
    size: opts.size ?? 10,
  }
  cell.alignment = { vertical: 'middle', horizontal: opts.align ?? 'left', wrapText: false }
  if (opts.numFmt) cell.numFmt = opts.numFmt
}

function addColumnHeaderRow(ws: ExcelJS.Worksheet, values: string[], bgArgb: string) {
  const row = ws.addRow(values)
  row.height = 20
  for (let i = 1; i <= values.length; i++) {
    styleCell(row.getCell(i), {
      bg: bgArgb,
      bold: true,
      color: C.white,
      size: 10,
      align: i === 1 ? 'left' : 'right',
    })
    row.getCell(i).border = {
      bottom: { style: 'thin', color: { argb: C.line } },
    }
  }
  return row
}

function addSectionHeader(ws: ExcelJS.Worksheet, label: string, nCols: number) {
  const row = ws.addRow([label])
  row.height = 22
  ws.mergeCells(row.number, 1, row.number, nCols)
  styleCell(row.getCell(1), { bg: C.brand, bold: true, color: C.white, size: 11 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary sheet
// ─────────────────────────────────────────────────────────────────────────────

function buildSummarySheet(
  wb: ExcelJS.Workbook,
  transactions: Transaction[],
  accounts: Account[],
  categories: CategoryWithColor[],
) {
  const ws = wb.addWorksheet('Summary')
  ws.properties.defaultRowHeight = 18

  ws.columns = [
    { width: 28 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ]

  // Title
  const titleRow = ws.addRow(['Paisa Buddy — Export'])
  ws.mergeCells(titleRow.number, 1, titleRow.number, 5)
  titleRow.height = 30
  styleCell(titleRow.getCell(1), { bg: C.brandDeep, bold: true, color: C.white, size: 14 })

  // Export date
  const dateRow = ws.addRow([`Exported on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`])
  ws.mergeCells(dateRow.number, 1, dateRow.number, 5)
  styleCell(dateRow.getCell(1), { bg: C.brandDeep, color: 'FFAAD4C0', size: 9 })
  dateRow.height = 16

  ws.addRow([]) // spacer

  // ── Accounts ──────────────────────────────────────────────────────────────
  addSectionHeader(ws, 'Account Balances', 5)
  addColumnHeaderRow(ws, ['Account', 'Type', 'Balance', '', ''], C.brandDeep)
  // hide unused cols
  let netWorth = 0
  for (const acc of accounts) {
    netWorth += acc.current_balance
    const row = ws.addRow([
      acc.name,
      ACCOUNT_TYPE_LABELS[acc.type],
      paise(acc.current_balance),
      '',
      '',
    ])
    row.height = 17
    styleCell(row.getCell(1), { size: 10 })
    styleCell(row.getCell(2), { color: C.ink3, size: 10, align: 'right' })
    const balCell = row.getCell(3)
    styleCell(balCell, {
      bold: true,
      color: acc.current_balance < 0 ? C.debit : C.credit,
      size: 10,
      align: 'right',
      numFmt: RUPEE_FMT,
    })
    row.getCell(3).border = { bottom: { style: 'hair', color: { argb: C.line } } }
  }

  // Net worth row
  const nwRow = ws.addRow(['', 'Net Worth', paise(netWorth), '', ''])
  nwRow.height = 20
  styleCell(nwRow.getCell(2), { bold: true, size: 11, align: 'right' })
  const nwCell = nwRow.getCell(3)
  styleCell(nwCell, {
    bold: true,
    size: 12,
    color: netWorth < 0 ? C.debit : C.credit,
    align: 'right',
    numFmt: RUPEE_FMT,
    bg: C.totalRow,
  })
  nwRow.getCell(2).fill = solid(C.totalRow)

  ws.addRow([]) // spacer

  // ── Categories ────────────────────────────────────────────────────────────
  addSectionHeader(ws, 'Spending by Category', 5)
  addColumnHeaderRow(ws, ['Category', 'Transactions', 'Total Spent', 'Total Received', 'Net'], C.brandDeep)

  // only confirmed transactions for the categories summary
  const confirmed = transactions.filter((t) => t.reviewed)

  // build a map: category → { txCount, spent, received }
  const catMap = new Map<string, { txCount: number; spent: number; received: number }>()

  function getOrCreate(name: string) {
    if (!catMap.has(name)) catMap.set(name, { txCount: 0, spent: 0, received: 0 })
    return catMap.get(name)!
  }

  for (const tx of confirmed) {
    const key = tx.category ?? '(Uncategorized)'
    const entry = getOrCreate(key)
    entry.txCount++
    if (tx.type === 'debit') entry.spent += tx.amount
    else if (tx.type === 'credit') entry.received += tx.amount
  }

  // order: known categories first (in their original order), then uncategorized
  const categoryNames = categories.map((c) => c.name)
  const sortedKeys = [
    ...categoryNames.filter((n) => catMap.has(n)),
    ...[...(catMap.keys())].filter((k) => !categoryNames.includes(k)),
  ]

  for (const key of sortedKeys) {
    const { txCount, spent, received } = catMap.get(key)!
    const net = received - spent
    const row = ws.addRow([key, txCount, paise(spent), paise(received), paise(net)])
    row.height = 17
    styleCell(row.getCell(1), { size: 10 })
    styleCell(row.getCell(2), { size: 10, align: 'right' })
    styleCell(row.getCell(3), { size: 10, align: 'right', numFmt: RUPEE_FMT, color: spent > 0 ? C.debit : C.ink3 })
    styleCell(row.getCell(4), { size: 10, align: 'right', numFmt: RUPEE_FMT, color: received > 0 ? C.credit : C.ink3 })
    styleCell(row.getCell(5), { size: 10, align: 'right', numFmt: RUPEE_FMT, color: net >= 0 ? C.credit : C.debit, bold: true })
    row.getCell(5).border = { bottom: { style: 'hair', color: { argb: C.line } } }
  }

  // Totals row
  const totalSpent = confirmed.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
  const totalReceived = confirmed.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const totalNet = totalReceived - totalSpent
  const totRow = ws.addRow(['Total', confirmed.length, paise(totalSpent), paise(totalReceived), paise(totalNet)])
  totRow.height = 20
  for (let i = 1; i <= 5; i++) totRow.getCell(i).fill = solid(C.totalRow)
  styleCell(totRow.getCell(1), { bold: true, size: 10, bg: C.totalRow })
  styleCell(totRow.getCell(2), { bold: true, size: 10, align: 'right', bg: C.totalRow })
  styleCell(totRow.getCell(3), { bold: true, size: 10, align: 'right', numFmt: RUPEE_FMT, color: C.debit, bg: C.totalRow })
  styleCell(totRow.getCell(4), { bold: true, size: 10, align: 'right', numFmt: RUPEE_FMT, color: C.credit, bg: C.totalRow })
  styleCell(totRow.getCell(5), { bold: true, size: 11, align: 'right', numFmt: RUPEE_FMT, color: totalNet >= 0 ? C.credit : C.debit, bg: C.totalRow })
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly sheets
// ─────────────────────────────────────────────────────────────────────────────

function buildMonthlySheets(
  wb: ExcelJS.Workbook,
  transactions: Transaction[],
  accounts: Account[],
) {
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]))

  // group by year-month, newest first
  const byMonth = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(tx)
  }
  const months = [...byMonth.keys()].sort((a, b) => b.localeCompare(a))

  for (const ym of months) {
    const txs = byMonth.get(ym)!.sort((a, b) => {
      const d = b.date.localeCompare(a.date)
      if (d !== 0) return d
      return (b.time ?? '').localeCompare(a.time ?? '')
    })

    const name = sheetName(ym)
    const ws = wb.addWorksheet(name)
    ws.properties.defaultRowHeight = 17

    ws.columns = [
      { width: 12 },  // Date
      { width: 7  },  // Time
      { width: 20 },  // Merchant
      { width: 30 },  // Description
      { width: 16 },  // Category
      { width: 10 },  // Type
      { width: 14 },  // Amount
      { width: 18 },  // Account
      { width: 10 },  // Recurring
    ]

    // Sheet title
    const titleRow = ws.addRow([monthLabel(ym)])
    ws.mergeCells(titleRow.number, 1, titleRow.number, 9)
    titleRow.height = 26
    styleCell(titleRow.getCell(1), { bg: C.brandDeep, bold: true, color: C.white, size: 13 })

    // Column headers
    addColumnHeaderRow(ws, [
      'Date', 'Time', 'Merchant', 'Description', 'Category',
      'Type', 'Amount', 'Account', 'Recurring',
    ], C.brandDeep)

    for (const tx of txs) {
      const amtRupees = paise(tx.amount)
      const typeLabel = tx.type.charAt(0).toUpperCase() + tx.type.slice(1)
      const typeColor = tx.type === 'credit' ? C.credit : tx.type === 'debit' ? C.debit : C.transfer

      const row = ws.addRow([
        tx.date,
        tx.time ?? '',
        tx.merchant ?? '',
        tx.description,
        tx.category ?? '',
        typeLabel,
        amtRupees,
        tx.account_id ? (accountMap.get(tx.account_id) ?? '') : '',
        tx.is_recurring ? 'Yes' : '',
      ])
      row.height = 17

      for (let i = 1; i <= 9; i++) {
        row.getCell(i).border = { bottom: { style: 'hair', color: { argb: C.line } } }
      }

      styleCell(row.getCell(1), { size: 10 })
      styleCell(row.getCell(2), { size: 9, color: C.ink3 })
      styleCell(row.getCell(3), { bold: true, size: 10 })
      styleCell(row.getCell(4), { size: 10, color: C.ink3 })
      styleCell(row.getCell(5), { size: 10 })
      styleCell(row.getCell(6), { size: 9, color: typeColor, bold: true, align: 'center' })
      styleCell(row.getCell(7), { size: 10, bold: true, align: 'right', numFmt: RUPEE_FMT, color: typeColor })
      styleCell(row.getCell(8), { size: 10, color: C.ink3 })
      styleCell(row.getCell(9), { size: 9, color: C.ink3, align: 'center' })
    }

    // Summary totals row
    const income = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
    const net = income - expense

    ws.addRow([]) // spacer

    const totRow = ws.addRow([
      '', '', '', '',
      'Income', paise(income),
      'Expense', paise(expense),
      paise(net),
    ])
    totRow.height = 20
    for (let i = 1; i <= 9; i++) totRow.getCell(i).fill = solid(C.totalRow)
    styleCell(totRow.getCell(5), { bold: true, size: 10, color: C.credit, bg: C.totalRow })
    styleCell(totRow.getCell(6), { bold: true, size: 11, numFmt: RUPEE_FMT, color: C.credit, align: 'right', bg: C.totalRow })
    styleCell(totRow.getCell(7), { bold: true, size: 10, color: C.debit, bg: C.totalRow })
    styleCell(totRow.getCell(8), { bold: true, size: 11, numFmt: RUPEE_FMT, color: C.debit, align: 'right', bg: C.totalRow })
    styleCell(totRow.getCell(9), {
      bold: true, size: 12, numFmt: RUPEE_FMT,
      color: net >= 0 ? C.credit : C.debit,
      align: 'right', bg: C.totalRow,
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const userId = await getRequiredUserId()

  const [transactions, accounts, categories] = await Promise.all([
    getCachedTransactions(userId),
    getCachedAccounts(userId),
    getCachedCategoriesWithColors(userId),
  ])

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Paisa Buddy'
  wb.created = new Date()

  buildSummarySheet(wb, transactions, accounts, categories)
  buildMonthlySheets(wb, transactions, accounts)

  const buffer = await wb.xlsx.writeBuffer()

  const today = new Date().toISOString().slice(0, 10)
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="paisa-buddy-${today}.xlsx"`,
    },
  })
}
