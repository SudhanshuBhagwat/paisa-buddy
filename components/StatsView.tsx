'use client'

import { useState } from 'react'
import { groupByCategory, formatAmount } from '@/lib/utils'
import type { Transaction } from '@/lib/types/transaction'

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#84cc16', '#06b6d4',
  '#a855f7', '#f43f5e', '#10b981', '#f59e0b', '#6366f1',
]

const CX = 100, CY = 100, R = 82, INNER = 54

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function slicePath(startDeg: number, endDeg: number): string {
  // Clamp to avoid degenerate arcs when a single slice is ~360°
  const end = Math.min(endDeg, startDeg + 359.9999)
  const s  = polar(CX, CY, R, startDeg)
  const e  = polar(CX, CY, R, end)
  const si = polar(CX, CY, INNER, startDeg)
  const ei = polar(CX, CY, INNER, end)
  const large = end - startDeg > 180 ? 1 : 0
  return [
    `M ${s.x.toFixed(3)} ${s.y.toFixed(3)}`,
    `A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`,
    `L ${ei.x.toFixed(3)} ${ei.y.toFixed(3)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${si.x.toFixed(3)} ${si.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}

interface SliceData {
  category: string
  total: number
  pct: number
  startDeg: number
  endDeg: number
  color: string
}

function DonutChart({
  categories,
  total,
  label,
}: {
  categories: { category: string; total: number }[]
  total: number
  label: string
}) {
  const [active, setActive] = useState<number | null>(null)

  if (categories.length === 0) return null

  let angle = 0
  const slices: SliceData[] = categories.map((cat, i) => {
    const sweep = (cat.total / total) * 360
    const s: SliceData = {
      ...cat,
      pct: (cat.total / total) * 100,
      startDeg: angle,
      endDeg: angle + sweep,
      color: PALETTE[i % PALETTE.length],
    }
    angle += sweep
    return s
  })

  const activeSlice = active !== null ? slices[active] : null

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{label}</h3>

      {/* Donut — full width, capped so it doesn't get huge on tablet/desktop */}
      <div className="flex justify-center">
        <svg
          viewBox="0 0 200 200"
          className="w-full max-w-[280px]"
          style={{ display: 'block' }}
        >
          {slices.length === 1 ? (
            // Single slice: path arc degenerates for 360° — use circles instead
            <g
              opacity={1}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setActive(0)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(active === 0 ? null : 0)}
            >
              <circle cx={CX} cy={CY} r={R} fill={slices[0].color} />
              <circle cx={CX} cy={CY} r={INNER} fill="var(--bg)" />
            </g>
          ) : (
            slices.map((s, i) => (
              <path
                key={i}
                d={slicePath(s.startDeg, s.endDeg)}
                fill={s.color}
                stroke="var(--bg)"
                strokeWidth="1.5"
                opacity={active === null || active === i ? 1 : 0.35}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive(active === i ? null : i)}
              />
            ))
          )}
          {/* Center label */}
          {activeSlice ? (
            <>
              <text x={CX} y={CY - 10} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="inherit">
                {activeSlice.category.length > 14
                  ? activeSlice.category.slice(0, 13) + '…'
                  : activeSlice.category}
              </text>
              <text x={CX} y={CY + 5} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text)" fontFamily="inherit">
                {formatAmount(activeSlice.total)}
              </text>
              <text x={CX} y={CY + 18} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="inherit">
                {activeSlice.pct.toFixed(1)}%
              </text>
            </>
          ) : (
            <>
              <text x={CX} y={CY - 4} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="inherit">
                TOTAL
              </text>
              <text x={CX} y={CY + 12} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text)" fontFamily="inherit">
                {formatAmount(total)}
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Legend — wrapping pills */}
      <div className="flex flex-wrap gap-2">
        {slices.map((s, i) => (
          <button
            key={i}
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium truncate"
            style={{
              background: active === i ? s.color : 'var(--surface)',
              color: active === i ? '#fff' : 'var(--text)',
              border: `1px solid ${active === i ? s.color : 'var(--border)'}`,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive(active === i ? null : i)}
          >
            <span
              className="shrink-0 w-2 h-2 rounded-full"
              style={{ background: active === i ? '#fff' : s.color }}
            />
            <span className="truncate">{s.category}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface Props {
  transactions: Transaction[]
}

export default function StatsView({ transactions: txs }: Props) {
  const totalSpent    = txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
  const totalIncome   = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const totalTransfer = txs.filter((t) => t.type === 'transfer').reduce((s, t) => s + t.amount, 0)
  const expenseCategories  = groupByCategory(txs, 'debit')
  const incomeCategories   = groupByCategory(txs, 'credit')
  const transferCategories = groupByCategory(txs, 'transfer')

  if (txs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--muted)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span className="text-sm">No data this month</span>
      </div>
    )
  }

  return (
    <div className="px-4 pb-6 flex flex-col gap-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 pt-4">
        <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Income</span>
          <span className="text-base font-semibold tabular-nums" style={{ color: '#16a34a' }}>{formatAmount(totalIncome)}</span>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Spent</span>
          <span className="text-base font-semibold tabular-nums" style={{ color: '#dc2626' }}>{formatAmount(totalSpent)}</span>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Balance</span>
          <span
            className="text-base font-semibold tabular-nums"
            style={{ color: totalIncome - totalSpent >= 0 ? '#16a34a' : '#dc2626' }}
          >
            {formatAmount(totalIncome - totalSpent)}
          </span>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Transfers</span>
          <span className="text-base font-semibold tabular-nums" style={{ color: '#2563eb' }}>{formatAmount(totalTransfer)}</span>
        </div>
      </div>

      <DonutChart categories={expenseCategories}  total={totalSpent}    label="EXPENSES BY CATEGORY" />
      <DonutChart categories={incomeCategories}   total={totalIncome}   label="INCOME BY CATEGORY" />
      <DonutChart categories={transferCategories} total={totalTransfer} label="TRANSFERS BY CATEGORY" />
    </div>
  )
}
