import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
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
import { toYearMonth, addMonths, formatMonthLabel } from '@paisa-buddy/shared/logic/date'
import { formatAmount } from '@paisa-buddy/shared/logic/amount'
import { budgetStatus, budgetProgress } from '@paisa-buddy/shared/logic/budget'
import { categoryColor, CATEGORY_COLORS } from '@paisa-buddy/shared/categories'
import { C, F, RADIUS, ROW_PAD } from '../lib/tokens'
import { Sheet } from '../components/Sheet'

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
      <View style={{ alignItems: 'center' }}>
        <Svg width={200} height={200} viewBox="0 0 200 200">
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
      </View>
      <View style={dc.legend}>
        {slices.map((s, i) => (
          <Pressable
            key={i}
            onPress={() => setActive(active === i ? null : i)}
            style={[dc.chip, active === i && { backgroundColor: s.color, borderColor: s.color }]}
          >
            <View style={[dc.dot, { backgroundColor: active === i ? '#fff' : s.color }]} />
            <Text style={[dc.chipText, active === i && { color: '#fff' }]}>
              {s.category}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const dc = StyleSheet.create({
  wrap: { gap: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.surface,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  chipText: { fontSize: 12, fontFamily: F.medium, color: C.ink },
})

// ─── Budget bar ────────────────────────────────────────────────────────────────

const TYPE_PREFIX: Record<string, string> = { credit: '+', debit: '−', transfer: '⇄' }
const TYPE_COLOR: Record<string, string> = { credit: C.pos, debit: C.neg, transfer: C.transfer }

function BudgetTransactionItem({
  tx,
  accountMap,
}: {
  tx: Transaction
  accountMap: Record<string, string>
}) {
  const typeColor = TYPE_COLOR[tx.type] ?? C.ink
  const accountName = tx.account_id ? accountMap[tx.account_id] : null
  const title = tx.merchant || tx.description || '—'

  return (
    <View style={btx.row}>
      <View style={btx.info}>
        <Text style={btx.summary} numberOfLines={1}>
          <Text style={btx.title}>{title}</Text>
          {accountName ? <Text style={btx.account}> · {accountName}</Text> : null}
        </Text>
      </View>
      {tx.is_recurring && <Text style={btx.recurring}>↻</Text>}
      <View style={btx.right}>
        {!tx.reviewed && <View style={btx.unreviewedDot} />}
        <Text style={[btx.amount, { color: typeColor }]}>
          {TYPE_PREFIX[tx.type]}{formatAmount(tx.amount)}
        </Text>
      </View>
    </View>
  )
}

function BudgetBar({
  budget,
  transactions,
  accountMap,
  onEdit,
}: {
  budget: BudgetWithSpent
  transactions: Transaction[]
  accountMap: Record<string, string>
  onEdit: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const status = budgetStatus(budget.spent, budget.amount)
  const pct = budgetProgress(budget.spent, budget.amount)
  const barColor = status === 'red' ? C.neg : status === 'amber' ? C.gold : C.brand

  return (
    <View style={bb.card}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={bb.header}>
        <View style={bb.headerRow}>
          <Text style={bb.catName} numberOfLines={1}>{budget.category}</Text>
          <Text style={bb.amounts}>{formatAmount(budget.spent)} of {formatAmount(budget.amount)}</Text>
          <Pressable onPress={onEdit} hitSlop={8} style={bb.editBtn}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </Svg>
          </Pressable>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
            <Polyline points="6 9 12 15 18 9" />
          </Svg>
        </View>
        <View style={bb.track}>
          <View style={[bb.fill, { width: `${pct}%` as `${number}%`, backgroundColor: barColor }]} />
        </View>
      </Pressable>
      {expanded && (
        <View style={bb.expanded}>
          {transactions.length === 0 ? (
            <Text style={bb.noTxText}>No transactions this month.</Text>
          ) : (
            transactions.map((tx) => (
              <BudgetTransactionItem
                key={tx.id}
                tx={tx}
                accountMap={accountMap}
              />
            ))
          )}
        </View>
      )}
    </View>
  )
}

const btx = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Math.max(8, ROW_PAD - 2),
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 10,
  },
  info: { flex: 1, minWidth: 0 },
  summary: { fontSize: 13, fontFamily: F.regular, color: C.ink2 },
  title: { fontFamily: F.semibold, color: C.ink2 },
  account: { color: C.ink3 },
  recurring: { fontSize: 11, fontFamily: F.semibold, color: C.ink3, flexShrink: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  unreviewedDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.neg },
  amount: { fontSize: 13, fontFamily: F.monoBold },
})

const bb = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    shadowColor: '#14281E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  header: { padding: 14, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catName: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: C.ink },
  amounts: { fontSize: 12, fontFamily: F.regular, color: C.ink3, flexShrink: 0 },
  editBtn: { padding: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  expanded: { borderTopWidth: 1, borderTopColor: C.line },
  noTxText: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, fontFamily: F.regular, color: C.ink3 },
})

// ─── Tab switcher ──────────────────────────────────────────────────────────────

type Tab = 'expenses' | 'income' | 'budgets'

function TabSwitcher({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'expenses', label: 'Expenses' },
    { id: 'income', label: 'Income' },
    { id: 'budgets', label: 'Budgets' },
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
  btn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', zIndex: 1 },
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

  React.useEffect(() => {
    if (visible) {
      setCategory(editing?.category ?? '')
      setAmountStr(editing ? String(editing.amount / 100) : '')
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
    <Sheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.65}
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
          {editing ? (
            <View style={[bs.input, { justifyContent: 'center' }]}>
              <Text style={{ fontSize: 14, fontFamily: F.medium, color: C.ink }}>{editing.category}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {allCategories.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[bs.catChip, category === cat && { backgroundColor: categoryColor(cat), borderColor: categoryColor(cat) }]}
                  >
                    <Text style={[bs.catChipText, category === cat && { color: '#fff' }]}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
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
    </Sheet>
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
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg },
  catChipText: { fontSize: 14, fontFamily: F.medium, color: C.ink },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10 },
  rupee: { fontSize: 14, fontFamily: F.medium, color: C.ink3 },
  amountInput: { flex: 1, fontSize: 14, fontFamily: F.mono, color: C.ink, padding: 0 },
  save: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
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

  const TABS: Tab[] = ['expenses', 'income', 'budgets']
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
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetWithSpent | null>(null)

  const data = statsQuery.data ?? null

  function changeMonth(delta: number) {
    setMonth((current) => addMonths(current, delta))
  }

  const txs = data?.transactions ?? []
  const budgets = data?.budgets ?? []
  const colorMap = data?.categoryColors ?? {}
  const accounts = data?.accounts ?? []
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))
  const { income, expense, balance } = calcSummary(txs)
  const expenseCats = groupByCategory(txs, 'debit')
  const incomeCats = groupByCategory(txs, 'credit')
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
    { label: 'BALANCE', value: balance, color: balance >= 0 ? C.pos : C.neg },
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
          <Text style={s.title}>Stats</Text>
          <View style={s.monthRow}>
            <Pressable onPress={() => changeMonth(-1)} hitSlop={8} style={s.navBtn}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <Polyline points="15 18 9 12 15 6" />
              </Svg>
            </Pressable>
            <Text style={s.monthLabel}>{formatMonthLabel(month)}</Text>
            <Pressable onPress={() => changeMonth(1)} hitSlop={8} style={s.navBtn}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <Polyline points="9 18 15 12 9 6" />
              </Svg>
            </Pressable>
          </View>
        </View>

        {statsQuery.isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={C.brand} />
          </View>
        ) : (
          <View style={s.body}>
            {/* Summary strip */}
            <View style={s.summaryCard}>
              {summaryStrip.map(({ label, value, color }, idx) => (
                <View key={label} style={[s.summaryCol, idx > 0 && s.summaryColBorder]}>
                  <Text style={s.summaryLabel}>{label}</Text>
                  <Text style={[s.summaryValue, { color }]} numberOfLines={1}>{formatAmount(value)}</Text>
                </View>
              ))}
            </View>

            {/* Tab switcher */}
            <TabSwitcher active={activeTab} onChange={handleTabChange} />

            {/* Content */}
            <Animated.View style={contentAnimStyle}>
            {activeTab === 'budgets' ? (
              <>
                <View style={s.budgetHeader}>
                  <Text style={s.sectionTitle}>Budgets</Text>
                  <Pressable
                    onPress={openAdd}
                    onPressIn={() => { addBudgetScale.value = withSpring(0.9, { damping: 15, stiffness: 300 }) }}
                    onPressOut={() => { addBudgetScale.value = withSpring(1, { damping: 15, stiffness: 300 }) }}
                  >
                    <Animated.View style={[s.addBtn, addBudgetAnimStyle]}>
                      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                        <Path d="M12 5v14M5 12h14" />
                      </Svg>
                      <Text style={s.addBtnText}>Add</Text>
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
                    {budgets.map((b) => {
                      const categoryTransactions = txs
                        .filter((tx) => tx.category === b.category)
                        .sort((left, right) => right.date.localeCompare(left.date))

                      return (
                        <BudgetBar
                          key={b.id}
                          budget={b}
                          transactions={categoryTransactions}
                          accountMap={accountMap}
                          onEdit={() => openEdit(b)}
                        />
                      )
                    })}
                  </View>
                )}
              </>
            ) : txs.length === 0 ? (
              <View style={s.emptyState}>
                <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M18 20V10M12 20V4M6 20v-6" />
                </Svg>
                <Text style={s.emptyText}>No data this month</Text>
              </View>
            ) : (
              <>
                {activeTab === 'expenses' && (
                  <View style={s.chartCard}>
                    <Text style={s.chartLabel}>EXPENSES BY CATEGORY</Text>
                    {expenseCats.length > 0
                      ? <DonutChart categories={expenseCats} total={expense} colorMap={colorMap} />
                      : <Text style={s.emptyText}>No expenses this month</Text>}
                  </View>
                )}
                {activeTab === 'income' && (
                  <View style={s.chartCard}>
                    <Text style={s.chartLabel}>INCOME BY CATEGORY</Text>
                    {incomeCats.length > 0
                      ? <DonutChart categories={incomeCats} total={income} colorMap={colorMap} />
                      : <Text style={s.emptyText}>No income this month</Text>}
                  </View>
                )}
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
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn: {
    width: 28, height: 28, borderRadius: 8,
    borderWidth: 1, borderColor: C.line,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  monthLabel: { fontSize: 12.5, fontFamily: F.semibold, color: C.ink2, minWidth: 90, textAlign: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', paddingTop: 80 },
  body: { paddingHorizontal: 18, paddingTop: 10, gap: 12 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#14281E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  summaryCol: { flex: 1, paddingVertical: 13, alignItems: 'center', gap: 4 },
  summaryColBorder: { borderLeftWidth: 1, borderLeftColor: C.line },
  summaryLabel: { fontSize: 10.5, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 13.5, fontFamily: F.monoBold },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontFamily: F.extrabold, color: C.ink },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.brand, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: C.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  addBtnText: { fontSize: 13, fontFamily: F.bold, color: '#fff' },
  budgetList: { gap: 10 },
  chartCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    gap: 14,
    shadowColor: '#14281E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  chartLabel: { fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.6 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  emptyLink: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
})
