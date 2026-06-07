'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Transaction } from '@/lib/types/transaction'
import { addMonths, formatMonthLabel, calcSummary, groupByCategory, formatAmount } from '@/lib/utils'
import BuddySVG from '@/components/BuddySVG'
import { categoryColor } from '@/lib/categories'

const CX = 100, CY = 100, R = 82, INNER = 54

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function slicePath(startDeg: number, endDeg: number): string {
  const end = Math.min(endDeg, startDeg + 359.9999)
  const s = polar(CX, CY, R, startDeg), e = polar(CX, CY, R, end)
  const si = polar(CX, CY, INNER, startDeg), ei = polar(CX, CY, INNER, end)
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
  category: string; total: number; pct: number
  startDeg: number; endDeg: number; color: string
}

function buildSlices(cats: { category: string; total: number }[], total: number, colorMap?: Record<string, string>): SliceData[] {
  let angle = 0
  return cats.map((cat) => {
    const sweep = (cat.total / total) * 360
    const s: SliceData = { ...cat, pct: (cat.total / total) * 100, startDeg: angle, endDeg: angle + sweep, color: categoryColor(cat.category, colorMap) }
    angle += sweep
    return s
  })
}

function DonutSVG({ slices, active, onEnter, onLeave, onClick, size = 200 }: {
  slices: SliceData[]; active: number | null
  onEnter: (i: number) => void; onLeave: () => void; onClick: (i: number) => void; size?: number
}) {
  const activeSlice = active !== null ? slices[active] : null
  return (
    <svg viewBox="0 0 200 200" style={{ width: size, height: size, display: 'block' }}>
      {slices.length === 1 ? (
        <g style={{ cursor: 'pointer' }} onMouseEnter={() => onEnter(0)} onMouseLeave={onLeave} onClick={() => onClick(0)}>
          <circle cx={CX} cy={CY} r={R} fill={slices[0].color} />
          <circle cx={CX} cy={CY} r={INNER} fill="var(--pb-surface)" />
        </g>
      ) : slices.map((s, i) => (
        <path key={i} d={slicePath(s.startDeg, s.endDeg)} fill={s.color}
          stroke="var(--pb-surface)" strokeWidth="1.5"
          opacity={active === null || active === i ? 1 : 0.35}
          style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
          onMouseEnter={() => onEnter(i)} onMouseLeave={onLeave} onClick={() => onClick(i)} />
      ))}
      {activeSlice ? (
        <>
          <text x={CX} y={CY - 10} textAnchor="middle" fontSize="9" fill="var(--pb-ink-3)" fontFamily="inherit">
            {activeSlice.category.length > 14 ? activeSlice.category.slice(0, 13) + '…' : activeSlice.category}
          </text>
          <text x={CX} y={CY + 5} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--pb-ink)" fontFamily="inherit">
            {formatAmount(activeSlice.total)}
          </text>
          <text x={CX} y={CY + 18} textAnchor="middle" fontSize="9" fill="var(--pb-ink-3)" fontFamily="inherit">
            {activeSlice.pct.toFixed(1)}%
          </text>
        </>
      ) : (
        <>
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize="9" fill="var(--pb-ink-3)" fontFamily="inherit">TOTAL</text>
          <text x={CX} y={CY + 12} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--pb-ink)" fontFamily="inherit">
            {formatAmount(slices.reduce((s, x) => s + x.total, 0))}
          </text>
        </>
      )}
    </svg>
  )
}

function DonutChart({ categories, total, label, colorMap }: {
  categories: { category: string; total: number }[]; total: number; label: string; colorMap?: Record<string, string>
}) {
  const [active, setActive] = useState<number | null>(null)
  if (categories.length === 0) return null
  const slices = buildSlices(categories, total, colorMap)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--pb-ink-3)', textTransform: 'uppercase', margin: 0 }}>{label}</h3>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <DonutSVG slices={slices} active={active}
          onEnter={setActive} onLeave={() => setActive(null)}
          onClick={(i) => setActive(active === i ? null : i)} size={200} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {slices.map((s, i) => (
          <button key={i} type="button" style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99,
            fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s',
            background: active === i ? s.color : 'var(--pb-surface)',
            color: active === i ? '#fff' : 'var(--pb-ink)',
            border: `1px solid ${active === i ? s.color : 'var(--pb-line)'}`,
          }} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
             onClick={() => setActive(active === i ? null : i)}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: active === i ? '#fff' : s.color, flexShrink: 0 }} />
            {s.category}
          </button>
        ))}
      </div>
    </div>
  )
}

function HorizontalDonut({ categories, total, label, colorMap }: {
  categories: { category: string; total: number }[]; total: number; label: string; colorMap?: Record<string, string>
}) {
  const [active, setActive] = useState<number | null>(null)
  if (categories.length === 0) return null
  const slices = buildSlices(categories, total, colorMap)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--pb-ink-3)', textTransform: 'uppercase', margin: 0 }}>{label}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <DonutSVG slices={slices} active={active}
          onEnter={setActive} onLeave={() => setActive(null)}
          onClick={(i) => setActive(active === i ? null : i)} size={220} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
          {slices.slice(0, 8).map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', opacity: active === null || active === i ? 1 : 0.4, transition: 'opacity 0.15s' }}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === i ? null : i)}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--pb-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.category}</span>
              <span style={{ fontSize: 12, fontFamily: '"Space Mono", monospace', fontWeight: 700, color: 'var(--pb-ink)', flexShrink: 0 }}>{s.pct.toFixed(0)}%</span>
            </div>
          ))}
          {slices.length > 8 && (
            <div style={{ fontSize: 11, color: 'var(--pb-ink-3)', paddingLeft: 16 }}>+{slices.length - 8} more</div>
          )}
        </div>
      </div>
    </div>
  )
}

const CARD: React.CSSProperties = {
  background: 'var(--pb-surface)', border: '1px solid var(--pb-line)',
  borderRadius: 'var(--pb-radius)', boxShadow: 'var(--pb-card-shadow)',
}

function NavBtn({ onClick, dir }: { onClick: () => void; dir: 'prev' | 'next' }) {
  return (
    <button type="button" onClick={onClick} style={{
      width: 28, height: 28, borderRadius: 8, border: '1px solid var(--pb-line)',
      background: 'var(--pb-surface)', cursor: 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: 'var(--pb-ink-2)', flexShrink: 0,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'prev' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  )
}

interface Props {
  transactions: Transaction[]
  month: string
  categoryColorMap: Record<string, string>
}

export default function StatsClient({ transactions: txs, month, categoryColorMap }: Props) {
  const router = useRouter()
  const { income, expense, balance, transfer } = calcSummary(txs)
  const expenseCats = groupByCategory(txs, 'debit')
  const incomeCats = groupByCategory(txs, 'credit')
  const monthLabel = formatMonthLabel(month)
  const empty = txs.length === 0

  function nav(delta: number) {
    router.push(`/stats?month=${addMonths(month, delta)}`)
  }

  const summaryStrip = [
    { label: 'Income', value: income, color: 'var(--pb-pos)' },
    { label: 'Spent', value: expense, color: 'var(--pb-neg)' },
    { label: 'Balance', value: balance, color: balance >= 0 ? 'var(--pb-pos)' : 'var(--pb-neg)' },
  ]

  const buddyMsg = balance > 0
    ? <>You saved <span style={{ color: 'var(--pb-pos)', fontWeight: 700 }}>{formatAmount(balance)}</span> this month. Keep it up!</>
    : balance < 0
    ? <>Spending exceeds income by <span style={{ color: 'var(--pb-neg)', fontWeight: 700 }}>{formatAmount(Math.abs(balance))}</span> this month.</>
    : <>Income and spending are balanced this month.</>


  return (
    <main className="w-full min-h-dvh pb-24 md:pb-6 md:pt-14 lg:pt-[66px]">

      {/* ── Desktop ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:flex-col" style={{ height: 'calc(100dvh - 66px)', overflowY: 'auto', padding: '26px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--pb-ink)', margin: 0 }}>Stats</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NavBtn dir="prev" onClick={() => nav(-1)} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pb-ink)', minWidth: 130, textAlign: 'center' }}>{monthLabel}</span>
            <NavBtn dir="next" onClick={() => nav(1)} />
          </div>
        </div>

        {/* 4 stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
          {[
            { label: 'Income', value: income, color: 'var(--pb-pos)' },
            { label: 'Spent', value: expense, color: 'var(--pb-neg)' },
            { label: 'Balance', value: balance, color: balance >= 0 ? 'var(--pb-pos)' : 'var(--pb-neg)' },
            { label: 'Transfers', value: transfer, color: 'var(--pb-ink-2)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...CARD, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--pb-ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color, fontFamily: '"Space Mono", monospace', letterSpacing: '-0.02em' }}>{formatAmount(value)}</div>
            </div>
          ))}
        </div>

        {empty ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--pb-ink-3)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span style={{ fontSize: 14 }}>No data this month</span>
          </div>
        ) : (
          <>
            <div style={{ ...CARD, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <BuddySVG size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pb-brand)', marginBottom: 4, letterSpacing: '0.04em' }}>BUDDY SAYS</div>
                <div style={{ fontSize: 13, color: 'var(--pb-ink-2)', lineHeight: 1.5 }}>{buddyMsg}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
              <div style={{ ...CARD, padding: '20px 22px' }}>
                {expenseCats.length > 0
                  ? <HorizontalDonut categories={expenseCats} total={expense} label="Expenses by Category" colorMap={categoryColorMap} />
                  : <div style={{ color: 'var(--pb-ink-3)', fontSize: 13 }}>No expenses this month</div>}
              </div>
              <div style={{ ...CARD, padding: '20px 22px' }}>
                {incomeCats.length > 0
                  ? <HorizontalDonut categories={incomeCats} total={income} label="Income by Category" colorMap={categoryColorMap} />
                  : <div style={{ color: 'var(--pb-ink-3)', fontSize: 13 }}>No income this month</div>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Mobile + Tablet ──────────────────────────────────── */}
      <div className="lg:hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between" style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 10px' }}>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: 'var(--pb-ink)', margin: 0 }}>Stats</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NavBtn dir="prev" onClick={() => nav(-1)} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--pb-ink-2)', minWidth: 92, textAlign: 'center' }}>{monthLabel}</span>
            <NavBtn dir="next" onClick={() => nav(1)} />
          </div>
        </div>

        {/* Tablet header */}
        <div className="hidden md:flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--pb-line)' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--pb-ink)', margin: 0 }}>Stats</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NavBtn dir="prev" onClick={() => nav(-1)} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pb-ink)', minWidth: 130, textAlign: 'center' }}>{monthLabel}</span>
            <NavBtn dir="next" onClick={() => nav(1)} />
          </div>
        </div>

        {empty ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 10, color: 'var(--pb-ink-3)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span style={{ fontSize: 14 }}>No data this month</span>
          </div>
        ) : (
          <div style={{ padding: '10px 18px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Summary strip */}
            <div style={{ ...CARD, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {summaryStrip.map(({ label, value, color }, idx) => (
                <div key={label} style={{ padding: '13px 0', textAlign: 'center', borderRight: idx < 2 ? '1px solid var(--pb-line)' : undefined }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--pb-ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color, fontFamily: '"Space Mono", monospace' }}>{formatAmount(value)}</div>
                </div>
              ))}
            </div>

            <div style={{ ...CARD, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <BuddySVG size={34} />
              <div style={{ fontSize: 13, color: 'var(--pb-ink-2)', lineHeight: 1.5 }}>{buddyMsg}</div>
            </div>

            {expenseCats.length > 0 && (
              <div style={{ ...CARD, padding: '18px 18px 16px' }}>
                <DonutChart categories={expenseCats} total={expense} label="Expenses by Category" colorMap={categoryColorMap} />
              </div>
            )}

            {incomeCats.length > 0 && (
              <div style={{ ...CARD, padding: '18px 18px 16px' }}>
                <DonutChart categories={incomeCats} total={income} label="Income by Category" colorMap={categoryColorMap} />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
