'use client'

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react'
import { addMonths, formatMonthLabel } from '@/lib/utils'

interface Props {
  value: string // YYYY-MM
  onChange: (ym: string) => void
  onLabelClick?: () => void
  txCount?: number
}

const LABEL_VARIANTS = {
  enter: (dir: number) => ({ x: dir * 32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -32, opacity: 0 }),
}

function AnimatedCount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(0)
  useEffect(() => {
    mv.set(0)
    const controls = animate(mv, value, { duration: 0.5, ease: 'easeOut' })
    const unsub = mv.on('change', (v) => {
      if (ref.current) ref.current.textContent = String(Math.round(v))
    })
    return () => { controls.stop(); unsub() }
  }, [value])
  return <span ref={ref}>{value}</span>
}

export default function MonthPicker({ value, onChange, onLabelClick, txCount }: Props) {
  const prevValueRef = useRef(value)
  const dirRef = useRef<number>(1)
  const isFirstMount = useRef(true)
  useEffect(() => { isFirstMount.current = false }, [])

  if (prevValueRef.current !== value) {
    dirRef.current = value > prevValueRef.current ? 1 : -1
    prevValueRef.current = value
  }

  return (
    <div className="flex items-center justify-between px-4 py-1">
      <button
        onClick={() => onChange(addMonths(value, -1))}
        className="p-1 rounded-full transition-opacity hover:opacity-60 flex items-center justify-center"
        aria-label="Previous month"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="flex flex-col items-center gap-0.5 overflow-hidden">
        <AnimatePresence mode="wait" custom={dirRef.current}>
          <motion.div
            key={value}
            custom={dirRef.current}
            variants={LABEL_VARIANTS}
            initial={isFirstMount.current ? false : 'enter'}
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {onLabelClick ? (
              <button
                onClick={onLabelClick}
                className="flex items-center gap-1.5 font-medium text-sm"
                aria-label="Open calendar"
              >
                <span>{formatMonthLabel(value)}</span>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="md:hidden"
                  style={{ color: 'var(--muted)' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            ) : (
              <span className="font-medium text-sm">{formatMonthLabel(value)}</span>
            )}
          </motion.div>
        </AnimatePresence>
        {txCount !== undefined && (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            <AnimatedCount value={txCount} /> transaction{txCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <button
        onClick={() => onChange(addMonths(value, 1))}
        className="p-1 rounded-full transition-opacity hover:opacity-60 flex items-center justify-center"
        aria-label="Next month"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  )
}
