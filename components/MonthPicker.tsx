'use client'

import { addMonths, formatMonthLabel } from '@/lib/utils'

interface Props {
  value: string // YYYY-MM
  onChange: (ym: string) => void
  onLabelClick?: () => void // optional: open calendar on mobile
  txCount?: number
}

export default function MonthPicker({ value, onChange, onLabelClick, txCount }: Props) {
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

      <div className="flex flex-col items-center gap-0.5">
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
        {txCount !== undefined && (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {txCount} transaction{txCount !== 1 ? 's' : ''}
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
