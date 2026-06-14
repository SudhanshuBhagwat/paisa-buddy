'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { parseYearMonth, today } from '@/lib/utils'

interface Props {
  month: string // YYYY-MM
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
  transactionCounts: Map<string, number>
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function dotCount(n: number): number {
  if (n === 0) return 0
  if (n === 1) return 1
  if (n <= 4) return 2
  return 3
}

const variants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
}

export default function CalendarView({ month, selectedDate, onSelectDate, transactionCounts }: Props) {
  const prevMonthRef = useRef(month)
  const dirRef = useRef<number>(1)
  const isFirstMount = useRef(true)
  useEffect(() => { isFirstMount.current = false }, [])

  if (prevMonthRef.current !== month) {
    dirRef.current = month > prevMonthRef.current ? 1 : -1
    prevMonthRef.current = month
  }

  const base = parseYearMonth(month)
  const year = base.getFullYear()
  const monthNum = base.getMonth() + 1
  const firstDow = new Date(year, monthNum - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const todayStr = today()

  const hasAnyTxThisMonth = transactionCounts.size > 0

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function toDateStr(day: number): string {
    return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div className="px-3 py-3 select-none overflow-hidden">
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="text-center text-xs py-1 font-medium" style={{ color: 'var(--muted)' }}>
            {h}
          </div>
        ))}
      </div>

      <AnimatePresence initial={false} mode="wait" custom={dirRef.current}>
        <motion.div
          key={month}
          className="grid grid-cols-7"
          custom={dirRef.current}
          variants={variants}
          initial={isFirstMount.current ? false : 'enter'}
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} className="h-11" />

            const ds = toDateStr(day)
            const isToday = ds === todayStr
            const isSelected = ds === selectedDate
            const dots = dotCount(transactionCounts.get(ds) ?? 0)
            const showStar = hasAnyTxThisMonth && ds <= todayStr && !transactionCounts.has(ds)

            const anotherDaySelected = selectedDate !== null && !isSelected
            let circleBg = 'transparent'
            let circleColor = 'var(--pb-ink)'
            if (isSelected) { circleBg = 'var(--pb-brand)'; circleColor = '#fff' }
            else if (isToday && anotherDaySelected) { circleBg = 'var(--pb-ink)'; circleColor = 'var(--pb-surface)' }
            else if (isToday) { circleBg = 'var(--pb-brand)'; circleColor = '#fff' }
            else if (showStar) { circleColor = 'var(--pb-gold)' }

            return (
              <button
                key={ds}
                onClick={() => isToday ? onSelectDate(null) : onSelectDate(isSelected ? null : ds)}
                className="flex flex-col items-center justify-center h-11"
              >
                <span
                  className="w-7 h-7 flex items-center justify-center rounded-full text-sm transition-colors"
                  style={{ background: circleBg, color: circleColor, fontWeight: isToday || isSelected ? 600 : 400 }}
                >
                  {day}
                </span>
                {/* Dot/star row — always occupies space for consistent height */}
                <div className="flex gap-0.5 items-center justify-center" style={{ height: '10px', marginTop: '2px' }}>
                  {showStar ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ color: isSelected ? '#fff' : 'var(--pb-gold)', flexShrink: 0 }}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ) : (
                    Array.from({ length: dots }, (_, i) => (
                      <span
                        key={i}
                        className="rounded-full"
                        style={{
                          width: '3px',
                          height: '3px',
                          background: isSelected ? '#fff' : 'var(--pb-brand)',
                        }}
                      />
                    ))
                  )}
                </div>
              </button>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
