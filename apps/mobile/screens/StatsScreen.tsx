import React, { useEffect, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Svg, { Circle, Path, Polyline, Text as SvgText } from 'react-native-svg'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  upsertBudget,
  deleteBudget,
  type StatsData,
} from '../lib/api'
import { getStatsData } from '../lib/data'
import { queryKeys } from '../lib/query'
import type { BudgetWithSpent } from '@paisa-buddy/shared/types/budget'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'
import { calcSummary } from '@paisa-buddy/shared/logic/transaction'
import { toYearMonth } from '@paisa-buddy/shared/logic/date'
import { formatAmount } from '@paisa-buddy/shared/logic/amount'
import { budgetProgress } from '@paisa-buddy/shared/logic/budget'
import { categoryColor, CATEGORY_COLORS } from '@paisa-buddy/shared/categories'
import { C, F, RADIUS } from '../lib/tokens'
import { Sheet } from '../components/Sheet'
import { MonthSelectionSheet } from '../components/MonthSelectionSheet'
import { MonthCalendarSheet } from '../components/MonthCalendarSheet'

// ─── Donut math ────────────────────────────────────────────────────────────────

const CX = 100, CY = 100, R = 82, INNER = 54

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function slicePath(startDeg: number, endDeg: number): string {
  const end = Math.min(endDeg, startDeg + 359.9999)
  const s = polar(CX, CY, R, startDeg)
  const e = polar(CX, CY, R, end)
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

type SliceData = { category: string; total: number; pct: number; startDeg: number; endDeg: number; color: string }

function buildSlices(cats: { category: string; total: number }[], total: number, colorMap?: Record<string, string>): SliceData[] {
  let angle = 0
  return cats.map((cat) => {
    const sweep = (cat.total / total) * 360
    const s: SliceData = {
      ...cat,
      pct: (cat.total / total) * 100,
      startDeg: angle,
      endDeg: angle + sweep,
      color: categoryColor(cat.category, colorMap),
    }
    angle += sweep
    return s
  })
}

function groupByCategory(txs: Transaction[], type: 'debit' | 'credit'): { category: string; total: number }[] {
  const map = new Map<string, number>()
  for (const tx of txs) {
    if (tx.type === type) {
      const cat = tx.category ?? 'Uncategorized'
      map.set(cat, (map.get(cat) ?? 0) + tx.amount)
    }
  }
  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

function topSpendingCategories(cats: { category: string; total: number }[]): { category: string; total: number }[] {
  const top = cats.slice(0, 5)
  const otherTotal = cats.slice(5).reduce((sum, cat) => sum + cat.total, 0)
  return otherTotal > 0 ? [...top, { category: 'Other', total: otherTotal }] : top
}

function DonutChart({ categories, total, colorMap }: {
  categories: { category: string; total: number }[]
  total: number
  colorMap?: Record<string, string>
}) {
  const [active, setActive] = useState<number | null>(null)
  if (categories.length === 0) return null
  const slices = buildSlices(categories, total, colorMap)
  const activeSlice = active !== null ? slices[active] : null

  return (
    <View style={dc.wrap}>
      <View style={dc.content}>
        <Svg width={144} height={144} viewBox="18 18 164 164" style={dc.chart}>
          {slices.length === 1 ? (
            <>
              <Circle cx={CX} cy={CY} r={R} fill={slices[0].color} onPress={() => setActive(active === 0 ? null : 0)} />
              <Circle cx={CX} cy={CY} r={INNER} fill={C.surface} />
            </>
          ) : slices.map((s, i) => (
            <Path
              key={i}
              d={slicePath(s.startDeg, s.endDeg)}
              fill={s.color}
              opacity={active === null || active === i ? 1 : 0.35}
              strokeWidth={1.5}
              stroke={C.surface}
              onPress={() => setActive(active === i ? null : i)}
            />
          ))}
          {activeSlice ? (
            <>
              <SvgText x={CX} y={CY - 10} textAnchor="middle" fontSize={9} fill={C.ink3} fontFamily={F.regular}>
                {activeSlice.category.length > 14 ? activeSlice.category.slice(0, 13) + '…' : activeSlice.category}
              </SvgText>
              <SvgText x={CX} y={CY + 5} textAnchor="middle" fontSize={13} fontWeight="600" fill={C.ink} fontFamily={F.mono}>
                {formatAmount(activeSlice.total)}
              </SvgText>
              <SvgText x={CX} y={CY + 18} textAnchor="middle" fontSize={9} fill={C.ink3} fontFamily={F.regular}>
                {activeSlice.pct.toFixed(1)}%
              </SvgText>
            </>
          ) : (
            <>
              <SvgText x={CX} y={CY - 4} textAnchor="middle" fontSize={9} fill={C.ink3} fontFamily={F.regular}>TOTAL</SvgText>
              <SvgText x={CX} y={CY + 12} textAnchor="middle" fontSize={13} fontWeight="600" fill={C.ink} fontFamily={F.mono}>
                {formatAmount(total)}
              </SvgText>
            </>
          )}
        </Svg>
        <View style={dc.legend}>
          {slices.map((s, i) => (
            <Pressable
              key={s.category}
              onPress={() => setActive(active === i ? null : i)}
              style={[dc.legendRow, active === i && { backgroundColor: C.bg }]}
            >
              <View style={dc.legendText}>
                <View style={dc.legendTop}>
                  <Text style={[dc.categoryName, { color: s.color }]} numberOfLines={1}>{s.category}</Text>
                  <Text style={dc.pctText}>{s.pct.toFixed(1)}%</Text>
                  <Text style={dc.amountText} numberOfLines={1}>{formatAmount(s.total)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}

const dc = StyleSheet.create({
  wrap: { gap: 14 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 0 },
  chart: { flexShrink: 0, marginLeft: 16, marginRight: 8 },
  legend: { flex: 1, gap: 2 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderRadius: 8,
  },
  legendText: { flex: 1, minWidth: 0, gap: 2 },
  legendTop: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  categoryName: { flex: 1, fontSize: 12, fontFamily: F.semibold },
  pctText: { width: 36, fontSize: 11, fontFamily: F.monoBold, color: C.ink, textAlign: 'right' },
  amountText: { width: 66, fontSize: 11, fontFamily: F.mono, color: C.ink3, textAlign: 'right', flexShrink: 0 },
})

// ─── Budget bar ────────────────────────────────────────────────────────────────

function BudgetBar({
  budget,
  onEdit,
  isLast,
}: {
  budget: BudgetWithSpent
  onEdit: () => void
  isLast: boolean
}) {
  const pct = budgetProgress(budget.spent, budget.amount)
  const pctLabel = `${Math.round((budget.spent / Math.max(1, budget.amount)) * 100)}%`
  const overBudget = budget.spent > budget.amount
  const barColor = overBudget ? C.neg : C.brand
  const statusLabel = overBudget ? 'Over Budget' : 'On Track'

  return (
    <Pressable style={[bb.row, !isLast && bb.rowBorder]} onPress={onEdit}>
      <View style={bb.header}>
        <View style={bb.headerMain}>
          <View style={bb.headerRow}>
            <View style={bb.titleButton}>
              <Text style={bb.catName} numberOfLines={1}>{budget.category}</Text>
            </View>
            <Text style={bb.amounts} numberOfLines={1}>{formatAmount(budget.spent)} of {formatAmount(budget.amount)}</Text>
          </View>
          <View style={bb.progressRow}>
            <View style={bb.track}>
              <View style={[bb.fill, { width: `${pct}%` as `${number}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[bb.pctText, { color: barColor }]}>{pctLabel}</Text>
          </View>
        </View>
        <View style={bb.statusCol}>
          <View style={[bb.statusPill, { backgroundColor: overBudget ? '#FEE2E2' : C.brandPale }]}>
            <Text style={[bb.statusText, { color: barColor }]} numberOfLines={1}>{statusLabel}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

function PlanSummary({ budgets }: { budgets: BudgetWithSpent[] }) {
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0)
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0)
  const pctUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
  const fillPct = Math.min(100, pctUsed)
  const remaining = totalBudget - totalSpent
  const overBudget = remaining < 0
  const accent = overBudget ? C.neg : C.brand
  const remainingText = overBudget
    ? `${formatAmount(Math.abs(remaining))} over`
    : `${formatAmount(remaining)} remaining`

  return (
    <View style={ps.card}>
      <View style={ps.topRow}>
        <Text style={ps.title}>Overall Plan</Text>
        <View style={ps.metricRow}>
          <View style={ps.left}>
          <Text style={ps.amount}>{formatAmount(totalBudget)}</Text>
          <Text style={ps.label}>monthly budget</Text>
          </View>
          <View style={ps.right}>
          <Text style={[ps.percent, { color: accent }]}>{pctUsed}%</Text>
          <Text style={ps.label}>of budget used</Text>
          </View>
        </View>
      </View>
      <View style={ps.track}>
        <View style={[ps.fill, { width: `${fillPct}%` as `${number}%`, backgroundColor: accent }]} />
      </View>
      <Text style={[ps.remaining, { color: accent }]}>{remainingText}</Text>
    </View>
  )
}

const ps = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    gap: 12,
    shadowColor: '#14281E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 6,
  },
  topRow: { gap: 12 },
  metricRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  left: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  title: { fontSize: 13, fontFamily: F.semibold, color: C.ink },
  amount: { fontSize: 20, fontFamily: F.monoBold, color: C.ink },
  percent: { fontSize: 20, fontFamily: F.monoBold },
  label: { fontSize: 11, fontFamily: F.bold, color: C.ink3, letterSpacing: 0.2, marginTop: 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  remaining: { alignSelf: 'flex-end', fontSize: 12, fontFamily: F.monoBold },
})

const bb = StyleSheet.create({
  row: { backgroundColor: C.surface },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  headerMain: { flex: 1, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleButton: { flex: 1, minWidth: 0 },
  catName: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  amounts: { fontSize: 12, fontFamily: F.semibold, color: C.ink, textAlign: 'right', flexShrink: 0 },
  statusCol: { minWidth: 86, alignItems: 'flex-end', justifyContent: 'center', alignSelf: 'stretch', flexShrink: 0 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
  },
  statusText: { fontSize: 10.5, fontFamily: F.bold },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  pctText: { width: 38, fontSize: 12, fontFamily: F.monoBold, textAlign: 'right' },
})

// ─── Tab switcher ──────────────────────────────────────────────────────────────

type Tab = 'story' | 'plan' | 'spending'

function TabSwitcher({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'story', label: 'Story' },
    { id: 'plan', label: 'Plan' },
    { id: 'spending', label: 'Spending' },
  ]
  const [tabWidth, setTabWidth] = useState(0)
  const pillX = useSharedValue(0)
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }))

  useEffect(() => {
    if (tabWidth === 0) return
    const idx = tabs.findIndex((t) => t.id === active)
    pillX.value = withTiming(idx * tabWidth, { duration: 200 })
  }, [active, tabWidth])

  return (
    <View
      style={ts.wrap}
      onLayout={(e) => setTabWidth((e.nativeEvent.layout.width - 6) / 3)}
    >
      <Animated.View style={[ts.pill, { width: tabWidth }, pillStyle]} />
      {tabs.map((t) => (
        <Pressable key={t.id} onPress={() => onChange(t.id)} style={ts.btn}>
          <Text style={[ts.label, active === t.id && ts.labelActive]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const ts = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: C.bg,
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 8, alignItems: 'center', zIndex: 1 },
  pill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 8,
    backgroundColor: C.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  label: { fontSize: 13, fontFamily: F.medium, color: C.ink3 },
  labelActive: { fontFamily: F.bold, color: C.ink },
})

// ─── Spending trend ────────────────────────────────────────────────────────────

const TREND_BAR_H = 96

function compactRupees(paise: number): string {
  const r = paise / 100
  if (r >= 100000) return `₹${(r / 100000).toFixed(1).replace(/\.0$/, '')}L`
  if (r >= 1000) return `₹${Math.round(r / 1000)}k`
  return `₹${Math.round(r)}`
}

function SpendingTrend({ month, monthlySpends }: {
  month: string
  monthlySpends: Record<string, number>
}) {
  const [year, monthNum] = month.split('-').map(Number)
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, monthNum - 1 - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const values = months.map((m) => monthlySpends[m] ?? 0)
  const maxVal = Math.max(...values, 1)

  return (
    <View style={stt.card}>
      <Text style={stt.title}>SPENDING TREND</Text>
      <View style={stt.chartArea}>
        {/* Y-axis labels */}
        <View style={stt.yAxis}>
          <Text style={stt.yLabel}>{compactRupees(maxVal)}</Text>
          <Text style={stt.yLabel}>{compactRupees(maxVal / 2)}</Text>
          <Text style={stt.yLabel}>₹0</Text>
        </View>
        {/* Bars + month labels */}
        <View style={stt.barsSection}>
          <View style={stt.barsRow}>
            <View style={[stt.gridLine, { top: 0 }]} pointerEvents="none" />
            <View style={[stt.gridLine, { top: TREND_BAR_H / 2 }]} pointerEvents="none" />
            <View style={[stt.gridLine, { top: TREND_BAR_H - 1 }]} pointerEvents="none" />
            {months.map((m, i) => {
              const isCurrent = m === month
              const val = values[i]
              const barH = val > 0 ? Math.max((val / maxVal) * TREND_BAR_H, 4) : 0
              return (
                <View key={m} style={stt.barCol}>
                  <View style={[stt.bar, { height: barH, backgroundColor: isCurrent ? C.brandDeep : C.brand }]} />
                </View>
              )
            })}
          </View>
          <View style={stt.labelsRow}>
            {months.map((m) => {
              const isCurrent = m === month
              const [y, mo] = m.split('-').map(Number)
              const shortLabel = new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'short' })
              return (
                <View key={m} style={stt.labelCol}>
                  <Text style={[stt.barLabel, isCurrent && stt.barLabelCurrent]}>{shortLabel}</Text>
                </View>
              )
            })}
          </View>
        </View>
      </View>
    </View>
  )
}

const stt = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    gap: 14,
    shadowColor: '#14281E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: { fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.6 },
  chartArea: { flexDirection: 'row', gap: 8 },
  yAxis: { width: 34, height: TREND_BAR_H, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 2 },
  yLabel: { fontSize: 10, fontFamily: F.mono, color: C.ink3 },
  barsSection: { flex: 1, gap: 6 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', height: TREND_BAR_H, gap: 5, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: C.line },
  barCol: { flex: 1, height: TREND_BAR_H, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 5 },
  labelsRow: { flexDirection: 'row', gap: 5 },
  labelCol: { flex: 1, alignItems: 'center' },
  barLabel: { fontSize: 11, fontFamily: F.medium, color: C.ink3 },
  barLabelCurrent: { fontFamily: F.bold, color: C.ink },
})

// ─── Budget sheet ──────────────────────────────────────────────────────────────

function BudgetSheet({
  visible, onClose, editing, allCategories, onSaved,
}: {
  visible: boolean
  onClose: () => void
  editing: BudgetWithSpent | null
  allCategories: string[]
  onSaved: (b: BudgetWithSpent) => void
}) {
  const [category, setCategory] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [catPickerOpen, setCatPickerOpen] = useState(false)

  React.useEffect(() => {
    if (visible) {
      setCategory(editing?.category ?? '')
      setAmountStr(editing ? String(editing.amount / 100) : '')
      setCatPickerOpen(false)
    }
  }, [visible, editing])

  async function handleSave() {
    const amount = Math.round(parseFloat(amountStr) * 100)
    if (!category || isNaN(amount) || amount <= 0) return
    setSaving(true)
    try {
      const saved = await upsertBudget(category, amount)
      onSaved({ ...saved, spent: editing?.spent ?? 0 })
      onClose()
    } catch (e) {
      Alert.alert('Error', 'Could not save budget.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        heightFraction={0.5}
        header={(
          <View style={bs.header}>
            <Text style={bs.title}>{editing ? 'Edit Budget' : 'Add Budget'}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={bs.cancel}>Cancel</Text>
            </Pressable>
          </View>
        )}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={bs.content} keyboardShouldPersistTaps="handled">
          <View style={bs.field}>
            <Text style={bs.label}>CATEGORY</Text>
            <Pressable style={bs.selectField} onPress={() => setCatPickerOpen(true)}>
              <View style={bs.selectInner}>
                {!!category && (
                  <View style={[bs.catDot, { backgroundColor: categoryColor(category) }]} />
                )}
                <Text style={[bs.selectText, !category && bs.selectPlaceholder]} numberOfLines={1}>
                  {category || 'Select category'}
                </Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <Polyline points="6 9 12 15 18 9" />
              </Svg>
            </Pressable>
          </View>

          <View style={bs.field}>
            <Text style={bs.label}>MONTHLY LIMIT</Text>
            <View style={bs.amountRow}>
              <Text style={bs.rupee}>₹</Text>
              <TextInput
                style={bs.amountInput}
                value={amountStr}
                onChangeText={(t) => setAmountStr(t.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={C.ink3}
              />
            </View>
          </View>

          <Pressable
            style={[bs.save, (!category || !amountStr) && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={!category || !amountStr || saving}
          >
            <Text style={bs.saveText}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Budget'}</Text>
          </Pressable>
        </ScrollView>

        <Sheet
          visible={catPickerOpen}
          onClose={() => setCatPickerOpen(false)}
          heightFraction={0.6}
          header={(
            <View style={bs.pickerHeader}>
              <Text style={bs.pickerTitle}>Category</Text>
              <Pressable onPress={() => setCatPickerOpen(false)} hitSlop={8}>
                <Text style={bs.pickerDone}>Done</Text>
              </Pressable>
            </View>
          )}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={bs.pickerScroll}>
            <Text style={bs.pickerSectionLabel}>CATEGORIES</Text>
            {allCategories.map((cat) => {
              const selected = category === cat
              const color = categoryColor(cat)
              return (
                <Pressable
                  key={cat}
                  style={bs.pickerRow}
                  onPress={() => { setCategory(cat); setCatPickerOpen(false) }}
                >
                  <View style={[bs.catDot, { backgroundColor: color }]} />
                  <Text style={[bs.pickerRowText, selected && { color: C.brand, fontFamily: F.semibold }]}>
                    {cat}
                  </Text>
                  {selected && (
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M20 6 9 17l-5-5" />
                    </Svg>
                  )}
                </Pressable>
              )
            })}
          </ScrollView>
        </Sheet>
      </Sheet>
    </>
  )
}

const bs = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  title: { flex: 1, marginRight: 12, fontSize: 20, fontFamily: F.semibold, color: C.ink },
  cancel: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: F.medium, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10 },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  selectInner: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  selectText: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.ink },
  selectPlaceholder: { color: C.ink3 },
  catDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  pickerTitle: { fontSize: 16, fontFamily: F.semibold, color: C.ink },
  pickerDone: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  pickerSectionLabel: {
    fontSize: 11,
    fontFamily: F.medium,
    color: C.ink3,
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  pickerRowText: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.ink },
  pickerScroll: { paddingBottom: 32 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10 },
  rupee: { fontSize: 14, fontFamily: F.medium, color: C.ink3 },
  amountInput: { flex: 1, fontSize: 14, fontFamily: F.mono, color: C.ink, padding: 0 },
  save: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
})

function SkeletonBlock({ style }: { style?: object }) {
  return <View style={[sk.block, style]} />
}

function StatsSkeleton({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <View style={s.body}>
      <TabSwitcher active={activeTab} onChange={onTabChange} />

      {activeTab === 'story' ? (
        <View style={s.summaryCard}>
          {[0, 1, 2].map((idx) => (
            <View key={idx} style={[s.summaryCol, idx > 0 && s.summaryColBorder]}>
              <SkeletonBlock style={sk.summaryLabel} />
              <SkeletonBlock style={sk.summaryValue} />
            </View>
          ))}
        </View>
      ) : activeTab === 'plan' ? (
        <View>
          <View style={s.budgetHeader}>
            <SkeletonBlock style={sk.sectionTitle} />
            <SkeletonBlock style={sk.addButton} />
          </View>
          <View style={s.budgetList}>
            {[0, 1, 2].map((idx) => (
              <View key={idx} style={[bb.row, idx < 2 && bb.rowBorder]}>
                <View style={bb.header}>
                  <View style={bb.headerRow}>
                    <SkeletonBlock style={sk.budgetName} />
                    <SkeletonBlock style={sk.budgetAmount} />
                  </View>
                  <SkeletonBlock style={sk.budgetTrack} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={s.chartCard}>
          <SkeletonBlock style={sk.chartLabel} />
          <View style={sk.chartWrap}>
            <View style={sk.donutOuter}>
              <View style={sk.donutInner} />
            </View>
            <View style={sk.legendStack}>
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <View key={idx} style={sk.legendLine}>
                  <View style={sk.legendLineText}>
                    <SkeletonBlock style={[sk.legendName, { width: idx % 2 === 0 ? 70 : 54 }]} />
                    <SkeletonBlock style={sk.legendAmount} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

const sk = StyleSheet.create({
  block: { backgroundColor: C.line, opacity: 0.75, borderRadius: 6 },
  summaryLabel: { width: 48, height: 9 },
  summaryValue: { width: 72, height: 14 },
  sectionTitle: { width: 76, height: 18 },
  addButton: { width: 62, height: 34, borderRadius: 12 },
  budgetName: { flex: 1, height: 15 },
  budgetAmount: { width: 96, height: 12 },
  budgetTrack: { height: 6, borderRadius: 3 },
  chartLabel: { width: 138, height: 11 },
  chartWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  donutOuter: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: C.line,
    opacity: 0.75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutInner: { width: 78, height: 78, borderRadius: 39, backgroundColor: C.surface },
  legendStack: { flex: 1, gap: 10 },
  legendLine: { flexDirection: 'row', alignItems: 'center' },
  legendLineText: { flex: 1, gap: 4 },
  legendName: { height: 10 },
  legendAmount: { width: 48, height: 9 },
})

// ─── StatsScreen ───────────────────────────────────────────────────────────────

export function StatsScreen() {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const addBudgetScale = useSharedValue(1)
  const addBudgetAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: addBudgetScale.value }] }))

  const contentOpacity = useSharedValue(1)
  const contentTranslateX = useSharedValue(0)
  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentTranslateX.value }],
  }))

  const TABS: Tab[] = ['story', 'plan', 'spending']
  function handleTabChange(next: Tab) {
    if (next === activeTab) return
    const dir = TABS.indexOf(next) > TABS.indexOf(activeTab) ? 1 : -1
    contentOpacity.value = withTiming(0, { duration: 110 }, (finished) => {
      if (!finished) return
      runOnJS(setActiveTab)(next)
      contentTranslateX.value = dir * 28
      contentOpacity.value = withTiming(1, { duration: 160 })
      contentTranslateX.value = withTiming(0, { duration: 160 })
    })
  }
  const [month, setMonth] = useState(() => toYearMonth(new Date()))
  const statsQuery = useQuery({
    queryKey: queryKeys.stats(month),
    queryFn: () => getStatsData(month),
  })
  const [activeTab, setActiveTab] = useState<Tab>('story')
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false)
  const [monthSheetOpen, setMonthSheetOpen] = useState(false)
  const [calendarSheetOpen, setCalendarSheetOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetWithSpent | null>(null)

  const data = statsQuery.data ?? null

  function monthHeaderLabel(): string {
    const [year, monthNumber] = month.split('-').map(Number)
    const label = new Date(year, monthNumber - 1, 1).toLocaleString('en-US', { month: 'long' })
    return `${label} ${year}`
  }

  const txs = data?.transactions ?? []
  const budgets = data?.budgets ?? []
  const colorMap = data?.categoryColors ?? {}
  const { income, expense } = calcSummary(txs)
  const expectedIncome = data?.settings.expected_monthly_income ?? 0
  const remaining = expectedIncome - expense
  const monthlySpends = Object.fromEntries((data?.monthlySpends ?? []).map((item) => [item.month, item.spent]))
  monthlySpends[month] = monthlySpends[month] ?? expense
  const transactionCounts = txs.reduce<Record<string, number>>((counts, tx) => {
    counts[tx.date] = (counts[tx.date] ?? 0) + 1
    return counts
  }, {})
  const expenseCats = topSpendingCategories(groupByCategory(txs, 'debit'))
  const allCategories = [...new Set([...Object.keys(CATEGORY_COLORS), ...Object.keys(colorMap)])]

  function openAdd() { setEditingBudget(null); setBudgetSheetOpen(true) }
  function openEdit(b: BudgetWithSpent) { setEditingBudget(b); setBudgetSheetOpen(true) }

  function handleBudgetSaved(b: BudgetWithSpent) {
    queryClient.setQueryData<StatsData>(queryKeys.stats(month), (prev) => {
      if (!prev) return prev
      const existing = prev.budgets.findIndex((x) => x.id === b.id || x.category === b.category)
      const next = [...prev.budgets]
      if (existing === -1) next.push(b)
      else next[existing] = b
      return { ...prev, budgets: next }
    })
    queryClient.invalidateQueries({ queryKey: queryKeys.stats() })
  }

  async function handleDeleteBudget(id: string) {
    Alert.alert('Delete budget?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteBudget(id)
            queryClient.setQueryData<StatsData>(queryKeys.stats(month), (prev) => (
              prev ? { ...prev, budgets: prev.budgets.filter((b) => b.id !== id) } : prev
            ))
            queryClient.invalidateQueries({ queryKey: queryKeys.stats() })
          } catch {
            Alert.alert('Error', 'Could not delete budget.')
          }
        },
      },
    ])
  }

  const summaryStrip = [
    { label: 'INCOME', value: income, color: C.pos },
    { label: 'SPENT', value: expense, color: C.neg },
    { label: 'REMAINING', value: remaining, color: remaining >= 0 ? C.pos : C.neg },
  ]

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Pressable
            onPress={() => setMonthSheetOpen(true)}
            style={s.monthTitleButton}
            accessibilityLabel="Select month"
          >
            <Text style={s.title}>{monthHeaderLabel()}</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="6 9 12 15 18 9" />
            </Svg>
          </Pressable>
          <Pressable
            onPress={() => setCalendarSheetOpen(true)}
            style={s.calendarButton}
            accessibilityLabel="Open month calendar"
          >
            <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M8 2v4" />
              <Path d="M16 2v4" />
              <Path d="M3 10h18" />
              <Path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            </Svg>
          </Pressable>
        </View>

        {statsQuery.isLoading ? (
          <StatsSkeleton activeTab={activeTab} onTabChange={handleTabChange} />
        ) : (
          <View style={s.body}>
            {/* Tab switcher */}
            <TabSwitcher active={activeTab} onChange={handleTabChange} />

            {/* Content */}
            <Animated.View style={contentAnimStyle}>
            {activeTab === 'story' ? (
              <View style={s.summaryCard}>
                {summaryStrip.map(({ label, value, color }, idx) => (
                  <View key={label} style={[s.summaryCol, idx > 0 && s.summaryColBorder]}>
                    <Text style={s.summaryLabel}>{label}</Text>
                    <Text style={[s.summaryValue, { color }]} numberOfLines={1}>{formatAmount(value)}</Text>
                  </View>
                ))}
              </View>
            ) : activeTab === 'plan' ? (
              <>
                <PlanSummary budgets={budgets} />
                <View style={s.budgetHeader}>
                  <Text style={s.sectionTitle}>Plan vs Actual</Text>
                  <Pressable
                    onPress={openAdd}
                    onPressIn={() => { addBudgetScale.value = withSpring(0.9, { damping: 15, stiffness: 300 }) }}
                    onPressOut={() => { addBudgetScale.value = withSpring(1, { damping: 15, stiffness: 300 }) }}
                  >
                    <Animated.View style={[s.addBtn, addBudgetAnimStyle]}>
                      <Text style={s.addBtnText}>Edit Plan</Text>
                    </Animated.View>
                  </Pressable>
                </View>
                {budgets.length === 0 ? (
                  <View style={s.emptyState}>
                    <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <Circle cx="12" cy="12" r="10" /><Path d="M12 6v6l4 2" />
                    </Svg>
                    <Text style={s.emptyText}>No budgets set yet.</Text>
                    <Pressable onPress={openAdd}>
                      <Text style={s.emptyLink}>+ Add your first budget</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={s.budgetList}>
                    {budgets.map((b, idx) => (
                      <BudgetBar
                        key={b.id}
                        budget={b}
                        onEdit={() => openEdit(b)}
                        isLast={idx === budgets.length - 1}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                {txs.length > 0 ? (
                  <View style={s.chartCard}>
                    <Text style={s.chartLabel}>SPENDING BY CATEGORY</Text>
                    {expenseCats.length > 0
                      ? <DonutChart categories={expenseCats} total={expense} colorMap={colorMap} />
                      : <Text style={s.emptyText}>No spending this month</Text>}
                  </View>
                ) : (
                  <View style={s.emptyState}>
                    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M18 20V10M12 20V4M6 20v-6" />
                    </Svg>
                    <Text style={s.emptyText}>No data this month</Text>
                  </View>
                )}
                <View style={{ marginTop: 8 }}>
                  <SpendingTrend month={month} monthlySpends={monthlySpends} />
                </View>
              </>
            )}
            </Animated.View>
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <BudgetSheet
        visible={budgetSheetOpen}
        onClose={() => setBudgetSheetOpen(false)}
        editing={editingBudget}
        allCategories={allCategories}
        onSaved={handleBudgetSaved}
      />
      <MonthSelectionSheet
        visible={monthSheetOpen}
        onClose={() => setMonthSheetOpen(false)}
        selectedMonth={month}
        monthlySpends={monthlySpends}
        onSelectMonth={setMonth}
      />
      <MonthCalendarSheet
        visible={calendarSheetOpen}
        onClose={() => setCalendarSheetOpen(false)}
        month={month}
        transactionCounts={transactionCounts}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  title: { fontSize: 23, fontFamily: F.extrabold, color: C.ink },
  monthTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  calendarButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 18, paddingTop: 10, gap: 12 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#14281E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  summaryCol: { flex: 1, minHeight: 64, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', gap: 4 },
  summaryColBorder: { borderLeftWidth: 1, borderLeftColor: C.line },
  summaryLabel: { fontSize: 10.5, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 13.5, fontFamily: F.monoBold },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontFamily: F.extrabold, color: C.ink },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  addBtnText: { fontSize: 13, fontFamily: F.bold, color: C.brand },
  budgetList: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    shadowColor: '#14281E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chartCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 18,
    paddingLeft: 0,
    paddingRight: 18,
    gap: 14,
    shadowColor: '#14281E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  chartLabel: { marginLeft: 18, fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.6 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  emptyLink: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
})
