'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Account } from '@/lib/types/account'
import {
  detectHeaderRow,
  autoMapColumns,
  applyMapping,
  type ColumnMapping,
} from '@/lib/import/parseRows'
import {
  batchImportTransactions,
  batchImportFromText,
  type ImportRow,
} from '@/app/actions/import'
import { decryptAesExcel, WrongExcelPasswordError } from '@/lib/import/decryptExcel'

// ── Client-side encryption detection ────────────────────────────────────────

// OLE2 compound document magic — Microsoft wraps encrypted XLSX in this format
const OLE2_MAGIC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])

async function detectEncryption(file: File): Promise<'none' | 'excel' | 'pdf'> {
  const first4 = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (OLE2_MAGIC.every((b, i) => first4[i] === b)) return 'excel'

  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const tail = new TextDecoder('latin1').decode(
      await file.slice(Math.max(0, file.size - 10 * 1024)).arrayBuffer(),
    )
    if (tail.includes('/Encrypt')) return 'pdf'
  }
  return 'none'
}

// ── Client-side Excel parsing (SheetJS) ─────────────────────────────────────

async function parseExcelInBrowser(file: File, password?: string): Promise<string[][]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  let wb: ReturnType<typeof XLSX.read>
  try {
    wb = XLSX.read(new Uint8Array(buf), { type: 'array', password, raw: false, cellText: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // SheetJS throws "File is password-protected" for AES-encrypted files (agile
    // encryption) because decrypt_agile is not in the open-source build. If we
    // already provided a password and still get that message, it's unsupported
    // encryption — not a wrong password.
    if (
      /unsupported|encrypt/i.test(msg) ||
      (password && /password-protected/i.test(msg))
    ) {
      throw new EncryptionUnsupportedError()
    }
    if (/password|incorrect/i.test(msg)) {
      throw new WrongPasswordError()
    }
    throw err
  }
  const sheet = wb.Sheets[wb.SheetNames[0]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
  return raw.map((row) => row.map((cell) => String(cell ?? '')))
}

// ── Client-side PDF text extraction (PDF.js) ────────────────────────────────

async function extractPdfText(file: File, password: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist')

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href
  }

  const buf = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf), password })

  // PDF.js v6: wrong password calls onPassword instead of rejecting the promise.
  // Without this handler the loading task hangs forever.
  let pdf: Awaited<typeof loadingTask.promise>
  try {
    pdf = await new Promise<Awaited<typeof loadingTask.promise>>((resolve, reject) => {
      loadingTask.onPassword = () => reject(new WrongPasswordError())
      loadingTask.promise.then(resolve).catch((err) => {
        const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : ''
        reject(name === 'PasswordException' ? new WrongPasswordError() : err)
      })
    })
  } catch (err) {
    throw err
  }

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  return pages.join('\n\n')
}

// ── Custom errors ────────────────────────────────────────────────────────────

class WrongPasswordError extends Error { name = 'WrongPasswordError' }
class EncryptionUnsupportedError extends Error { name = 'EncryptionUnsupportedError' }

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  accounts: Account[]
  onClose: () => void
}

type Step = 'account' | 'upload' | 'password' | 'processing' | 'mapping' | 'importing' | 'done' | 'error'

const NONE = '(none)'

export default function ImportTab({ accounts, onClose }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('account')
  const [accountId, setAccountId] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)

  // Password flow
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [encType, setEncType] = useState<'excel' | 'pdf'>('pdf')
  const [passwordInput, setPasswordInput] = useState('')
  const [wrongPassword, setWrongPassword] = useState(false)
  const [decrypting, setDecrypting] = useState(false)

  // CSV/Excel mapping
  const [allRows, setAllRows] = useState<string[][]>([])
  const [headerRowIdx, setHeaderRowIdx] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping>({
    dateCol: '', descCol: '', refCol: '',
    amountMode: 'split',
    debitCol: '', creditCol: '', amountCol: '',
    positiveIsCredit: false,
  })

  const headers = allRows[headerRowIdx] ?? []

  const parsedRows: ImportRow[] = (() => {
    if (!mapping.dateCol) return []
    try { return applyMapping(allRows, headers, headerRowIdx, mapping) }
    catch { return [] }
  })()

  // ── File routing ─────────────────────────────────────────────────────────

  const routeFile = useCallback(
    async (file: File, password?: string) => {
      const name = file.name.toLowerCase()
      const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
      const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls')
      const isCsv = name.endsWith('.csv')

      if (!isPdf && !isExcel && !isCsv) {
        setErrorMsg('Unsupported file. Use PDF, CSV, XLSX, or XLS.')
        setStep('error')
        return
      }

      // ── Excel: always parse client-side with SheetJS ──
      if (isExcel) {
        setStep('processing')
        try {
          const rows = await parseExcelInBrowser(file, password)
          applyParsedRows(rows)
        } catch (err) {
          if (err instanceof EncryptionUnsupportedError && password) {
            // SheetJS can't handle AES-encrypted .xlsx — try our own Web Crypto decryption
            try {
              const buf = await file.arrayBuffer()
              const decrypted = await decryptAesExcel(buf, password)
              const rows = await parseExcelInBrowser(
                new File([decrypted.buffer as ArrayBuffer], file.name, { type: file.type }),
              )
              applyParsedRows(rows)
            } catch (err2) {
              if (err2 instanceof WrongExcelPasswordError || err2 instanceof WrongPasswordError) {
                setWrongPassword(true)
                setDecrypting(false)
                setStep('password')
              } else {
                setErrorMsg(err2 instanceof Error ? err2.message : 'Failed to decrypt Excel file')
                setStep('error')
              }
            }
          } else if (err instanceof EncryptionUnsupportedError) {
            setErrorMsg(
              'This Excel file is encrypted. Please enter the password to open it.',
            )
            setStep('error')
          } else if (err instanceof WrongPasswordError) {
            setWrongPassword(true)
            setDecrypting(false)
            setStep('password')
          } else {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to parse Excel file')
            setStep('error')
          }
        }
        return
      }

      // ── Encrypted PDF: extract text client-side, send text to server ──
      if (isPdf && password) {
        setStep('processing')
        try {
          const text = await extractPdfText(file, password)
          const { count, skipped } = await batchImportFromText(text, accountId)
          setImportedCount(count)
          setSkippedCount(skipped)
          setStep('done')
        } catch (err) {
          if (err instanceof WrongPasswordError) {
            setWrongPassword(true)
            setDecrypting(false)
            setStep('password')
          } else {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to process PDF')
            setStep('error')
          }
        }
        return
      }

      // ── Plain PDF: send binary to server (OpenAI handles it natively) ──
      if (isPdf) {
        setStep('processing')
        try {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('accountId', accountId)
          const res = await fetch('/api/import/pdf', { method: 'POST', body: fd })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Upload failed')
          setImportedCount(data.count)
          setSkippedCount(data.skipped ?? 0)
          setStep('done')
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to process PDF')
          setStep('error')
        }
        return
      }

      // ── CSV: parse server-side (simple, never encrypted) ──
      setStep('processing')
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/import/parse-file', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Parse failed')
        applyParsedRows(data.rows)
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to parse file')
        setStep('error')
      }
    },
    [accountId],
  )

  function applyParsedRows(rows: string[][]) {
    const nonEmpty = rows.filter((r) => r.some((c) => c.trim()))
    const maxCols = nonEmpty.reduce((m, r) => Math.max(m, r.length), 0)
    const padded = nonEmpty.map((r) => [...r, ...Array<string>(maxCols - r.length).fill('')])
    const hIdx = detectHeaderRow(padded)
    setAllRows(padded)
    setHeaderRowIdx(hIdx)
    setMapping(autoMapColumns(padded[hIdx] ?? []))
    setStep('mapping')
  }

  const handleFile = useCallback(
    async (file: File) => {
      const enc = await detectEncryption(file)
      if (enc !== 'none') {
        setPendingFile(file)
        setEncType(enc)
        setPasswordInput('')
        setWrongPassword(false)
        setStep('password')
      } else {
        await routeFile(file)
      }
    },
    [routeFile],
  )

  async function handlePasswordSubmit() {
    if (!pendingFile || !passwordInput) return
    setWrongPassword(false)
    setDecrypting(true)
    await routeFile(pendingFile, passwordInput)
    setDecrypting(false)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile],
  )

  async function handleImport() {
    if (parsedRows.length === 0) return
    setStep('importing')
    try {
      const { count, skipped } = await batchImportTransactions(parsedRows, accountId)
      setImportedCount(count)
      setSkippedCount(skipped)
      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed')
      setStep('error')
    }
  }

  function ColSelect({ label, value, onChange, optional }: {
    label: string; value: string; onChange: (v: string) => void; optional?: boolean
  }) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm shrink-0" style={{ color: 'var(--text)', minWidth: '6rem' }}>
          {label}
          {optional && <span className="ml-1 text-xs" style={{ color: 'var(--muted)' }}>opt.</span>}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none min-w-0"
          style={{
            background: 'var(--bg)',
            color: value === NONE ? 'var(--muted)' : 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          {optional && <option value={NONE}>{NONE}</option>}
          {headers.map((h, i) => (
            <option key={i} value={h || `Column ${i + 1}`}>
              {h || `Column ${i + 1}`}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === 'account') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>ACCOUNT</label>
          <div className="flex flex-wrap gap-2">
            {accounts.map((acc) => (
              <button
                key={acc.id} type="button"
                onClick={() => setAccountId(acc.id === accountId ? '' : acc.id)}
                className="px-3 py-1.5 rounded-full text-sm transition-all"
                style={accountId === acc.id
                  ? { background: 'var(--pb-brand)', color: '#fff' }
                  : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                {acc.name}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button" disabled={!accountId}
          onClick={() => setStep('upload')}
          className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: 'var(--pb-brand)', color: '#fff' }}
        >
          Continue →
        </button>
      </div>
    )
  }

  if (step === 'upload') {
    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => setStep('account')} className="self-start text-xs" style={{ color: 'var(--muted)' }}>
          ← Change account
        </button>
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center cursor-pointer"
          style={{ border: '2px dashed var(--border)', background: 'var(--bg)' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <span style={{ fontSize: '2.5rem' }}>📂</span>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Drop your bank statement here</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>PDF · CSV · XLSX · XLS</p>
          </div>
          <span className="px-4 py-2 rounded-lg text-xs font-medium" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            Browse file
          </span>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
        <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
          Files are processed securely and never stored permanently
        </p>
      </div>
    )
  }

  if (step === 'password') {
    const isPdf = encType === 'pdf'
    return (
      <div className="flex flex-col gap-5">
        <button type="button" onClick={() => { setStep('upload'); setPendingFile(null) }} className="self-start text-xs" style={{ color: 'var(--muted)' }}>
          ← Back
        </button>

        <div className="flex flex-col items-center gap-3 py-2">
          <span style={{ fontSize: '2rem' }}>{isPdf ? '🔒' : '🔒'}</span>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              This {isPdf ? 'PDF' : 'Excel file'} is password-protected
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {isPdf
                ? 'Enter the password to decrypt it in your browser — it never leaves your device.'
                : 'Enter the password to decrypt it. Note: only legacy XOR encryption is supported.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <input
            autoFocus
            type="password"
            placeholder="File password"
            value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setWrongPassword(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit() }}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: `1px solid ${wrongPassword ? 'var(--pb-neg)' : 'var(--border)'}`,
            }}
          />
          {wrongPassword && (
            <p className="text-xs" style={{ color: 'var(--pb-neg)' }}>Incorrect password — try again.</p>
          )}
        </div>

        <button
          type="button"
          disabled={!passwordInput || decrypting}
          onClick={handlePasswordSubmit}
          className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: 'var(--pb-brand)', color: '#fff' }}
        >
          {decrypting ? 'Decrypting…' : 'Unlock & Import'}
        </button>
      </div>
    )
  }

  if (step === 'processing' || step === 'importing') {
    const msg = step === 'processing' ? 'Reading your bank statement…' : 'Importing transactions…'
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--pb-brand)', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{msg}</p>
      </div>
    )
  }

  if (step === 'mapping') {
    const setMap = (partial: Partial<ColumnMapping>) => setMapping((prev) => ({ ...prev, ...partial }))

    const totalDebit  = parsedRows.filter(r => r.type === 'debit').reduce((s, r) => s + r.amount_paise, 0)
    const totalCredit = parsedRows.filter(r => r.type === 'credit').reduce((s, r) => s + r.amount_paise, 0)
    const fmt = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setStep('upload')} className="text-xs" style={{ color: 'var(--muted)' }}>← Back</button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{parsedRows.length} transactions</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>HEADER ROW</span>
          <select
            value={headerRowIdx}
            onChange={(e) => { const idx = Number(e.target.value); setHeaderRowIdx(idx); setMapping(autoMapColumns(allRows[idx] ?? [])) }}
            className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            {allRows.slice(0, 20).map((row, i) => (
              <option key={i} value={i}>Row {i + 1}: {row.filter(Boolean).slice(0, 4).join(' · ')}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>MAP COLUMNS</p>
          <ColSelect label="Date" value={mapping.dateCol} onChange={(v) => setMap({ dateCol: v })} />
          <ColSelect label="Description" value={mapping.descCol || NONE} onChange={(v) => setMap({ descCol: v === NONE ? '' : v })} optional />
          <ColSelect label="Reference" value={mapping.refCol || NONE} onChange={(v) => setMap({ refCol: v === NONE ? '' : v })} optional />

          <div className="flex gap-2 mt-1">
            {(['split', 'single'] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setMap({ amountMode: mode })}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={mapping.amountMode === mode
                  ? { background: 'var(--pb-brand)', color: '#fff' }
                  : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                {mode === 'split' ? 'Separate Debit/Credit' : 'Single Amount col'}
              </button>
            ))}
          </div>

          {mapping.amountMode === 'split' ? (
            <>
              <ColSelect label="Debit col" value={mapping.debitCol} onChange={(v) => setMap({ debitCol: v })} />
              <ColSelect label="Credit col" value={mapping.creditCol} onChange={(v) => setMap({ creditCol: v })} />
            </>
          ) : (
            <>
              <ColSelect label="Amount col" value={mapping.amountCol} onChange={(v) => setMap({ amountCol: v })} />
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Positive =</span>
                <button type="button" onClick={() => setMap({ positiveIsCredit: !mapping.positiveIsCredit })}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                  {mapping.positiveIsCredit ? 'Credit (money in)' : 'Debit (money out)'}
                </button>
              </div>
            </>
          )}
        </div>

        {parsedRows.length > 0 && (
          <>
            {/* Debit / Credit summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'color-mix(in srgb, var(--pb-neg) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--pb-neg) 20%, transparent)' }}>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Total debits</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5" style={{ color: 'var(--pb-neg)' }}>{fmt(totalDebit)}</p>
              </div>
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'color-mix(in srgb, var(--pb-pos) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--pb-pos) 20%, transparent)' }}>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Total credits</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5" style={{ color: 'var(--pb-pos)' }}>{fmt(totalCredit)}</p>
              </div>
            </div>

            {/* Scrollable full transaction list */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {/* Fixed header — outside scroll container so it never scrolls away */}
              <div className="text-xs font-medium" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
                <div className="px-3 py-2">ALL TRANSACTIONS</div>
                <div className="grid px-3 py-1.5" style={{ gridTemplateColumns: '5.5rem 1fr auto', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                  <span>Date</span>
                  <span>Description</span>
                  <span>Amount</span>
                </div>
              </div>
              {/* Scrollable rows */}
              <div className="overflow-y-auto" style={{ maxHeight: '12rem' }}>
                {parsedRows.map((row, i) => (
                  <div key={i} className="grid items-center px-3 py-1.5 text-xs" style={{ gridTemplateColumns: '5.5rem 1fr auto', borderTop: '1px solid var(--border)' }}>
                    <span className="whitespace-nowrap" style={{ color: 'var(--muted)' }}>{row.date.split('-').reverse().join('-')}</span>
                    <span className="truncate pr-3" style={{ color: 'var(--text)' }} title={row.description}>{row.description || '—'}</span>
                    <span className="tabular-nums whitespace-nowrap font-medium" style={{ color: row.type === 'debit' ? 'var(--pb-neg)' : 'var(--pb-pos)' }}>
                      {row.type === 'debit' ? '−' : '+'}{fmt(row.amount_paise)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <button type="button" disabled={parsedRows.length === 0 || !mapping.dateCol} onClick={handleImport}
          className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: 'var(--pb-brand)', color: '#fff' }}>
          Import {parsedRows.length} transaction{parsedRows.length !== 1 ? 's' : ''}
        </button>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-5 py-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
          style={{ background: 'color-mix(in srgb, var(--pb-pos) 15%, transparent)' }}>✓</div>
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {importedCount} transaction{importedCount !== 1 ? 's' : ''} imported
          </p>
          {skippedCount > 0 && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              {skippedCount} already existed and were skipped
            </p>
          )}
          {importedCount > 0 && (
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Review and categorize them before they count</p>
          )}
        </div>
        <div className="flex gap-3 w-full">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            Close
          </button>
          <button type="button" onClick={() => { onClose(); router.push('/review') }}
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--pb-brand)', color: '#fff' }}>
            Review →
          </button>
        </div>
      </div>
    )
  }

  // error
  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
        style={{ background: 'color-mix(in srgb, var(--pb-neg) 15%, transparent)' }}>✗</div>
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>Import failed</p>
        <p className="text-sm mt-1 whitespace-pre-line break-words" style={{ color: 'var(--muted)' }}>{errorMsg}</p>
      </div>
      <button type="button" onClick={() => { setStep('upload'); setErrorMsg('') }}
        className="px-6 py-2.5 rounded-xl text-sm font-medium"
        style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
        Try again
      </button>
    </div>
  )
}
