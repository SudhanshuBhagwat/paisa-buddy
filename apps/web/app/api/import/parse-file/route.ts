import { type NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { requireApiSession } from '@/lib/auth/require-api-session'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      result.push(field.trim())
      field = ''
    } else {
      field += ch
    }
  }
  result.push(field.trim())
  return result
}

function parseCSV(buf: Buffer): string[][] {
  const text = buf.toString('utf-8').replace(/^﻿/, '')
  return text.split(/\r?\n/).map(parseCSVLine)
}

function cellToString(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'object') {
    if ('result' in val) return String((val as ExcelJS.CellFormulaValue).result ?? '')
    if ('richText' in val) return (val as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('')
    if ('text' in val) return String((val as ExcelJS.CellHyperlinkValue).text ?? '')
  }
  return String(val)
}

// XLSX files are ZIP archives. Encrypted ones have a specific OOXML encryption marker.
const XLSX_ENCRYPTED_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]) // OLE2 compound doc (Excel encryption wrapper)

function isExcelPasswordProtected(buf: Buffer): boolean {
  // Microsoft Office encrypts XLSX by wrapping it in an OLE2 compound document.
  // OLE2 files start with the magic bytes D0 CF 11 E0.
  return buf.length >= 4 && buf.slice(0, 4).equals(XLSX_ENCRYPTED_MAGIC)
}

async function parseExcel(buf: Buffer): Promise<string[][]> {
  if (isExcelPasswordProtected(buf)) {
    throw new Error('This Excel file is password-protected. Please remove the password before importing.')
  }

  const workbook = new ExcelJS.Workbook()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buf as any)
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : ''
    if (msg.includes('password') || msg.includes('encrypt') || msg.includes('protected')) {
      throw new Error('This Excel file is password-protected. Please remove the password before importing.')
    }
    throw err
  }

  const sheet = workbook.worksheets[0]
  const rows: string[][] = []
  sheet.eachRow((row) => {
    const cells: string[] = []
    for (let i = 1; i <= row.cellCount; i++) {
      cells.push(cellToString(row.getCell(i).value))
    }
    rows.push(cells)
  })
  return rows
}

export async function POST(req: NextRequest) {
  try {
    const authed = await requireApiSession(req)
    if (authed instanceof Response) return authed

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const name = file.name.toLowerCase()

    let raw: string[][]
    if (name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' && name.endsWith('.csv')) {
      raw = parseCSV(buf)
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      raw = await parseExcel(buf)
    } else {
      return Response.json({ error: 'Unsupported file type. Use .csv, .xlsx, or .xls' }, { status: 400 })
    }

    // Pad rows to consistent width, filter fully-empty rows
    const nonEmpty = raw.filter((row) => row.some((c) => c.trim()))
    const maxCols = nonEmpty.reduce((m, r) => Math.max(m, r.length), 0)
    const rows = nonEmpty.map((row) => [
      ...row,
      ...Array<string>(maxCols - row.length).fill(''),
    ])

    return Response.json({ rows })
  } catch (err) {
    console.error('[import/parse-file]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to parse file' },
      { status: 500 },
    )
  }
}
