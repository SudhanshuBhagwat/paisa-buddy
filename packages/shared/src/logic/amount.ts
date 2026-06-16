import type { AccountType } from '../types/account'

export function parseAmountToPaise(str: string): number {
  return Math.round(parseFloat(str || '0') * 100)
}

export function formatDisplayAmount(raw: string): string {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const formatted = Number(intPart || 0).toLocaleString('en-IN')
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted
}

export function sanitizeAmountInput(value: string): string {
  const clean = value.replace(/[^0-9.]/g, '')
  const parts = clean.split('.')
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean
}

export function openingBalanceForType(paise: number, type: AccountType): number {
  return type === 'credit' ? -Math.abs(paise) : paise
}

const _fmtAmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatAmount(paise: number): string {
  return _fmtAmt.format(paise / 100)
}
