export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function parseYearMonth(ym: string): Date {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function addMonths(ym: string, delta: number): string {
  const d = parseYearMonth(ym)
  d.setMonth(d.getMonth() + delta)
  return toYearMonth(d)
}

export function formatMonthLabel(ym: string): string {
  const d = parseYearMonth(ym)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const t = new Date()
  const todayStr = t.toISOString().slice(0, 10)
  const yest = new Date(t)
  yest.setDate(yest.getDate() - 1)
  const yestStr = yest.toISOString().slice(0, 10)

  if (dateStr === todayStr) return 'Today'
  if (dateStr === yestStr) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
