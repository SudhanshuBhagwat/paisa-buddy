import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Transaction, TransactionType } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'
import { filterTransactions, getMonthTransactions, groupByDate } from '@paisa-buddy/shared/logic/transaction'
import { formatAmount } from '@paisa-buddy/shared/logic/amount'
import { addMonths, formatDateLabel, formatMonthLabel, toYearMonth } from '@paisa-buddy/shared/logic/date'
import { categoryColor } from '@paisa-buddy/shared/categories'
import { C, F, RADIUS, ROW_PAD } from '../lib/tokens'
import { deleteTransaction } from '../lib/api'
import { getHomeData } from '../lib/data'
import { invalidateTransactionData, queryKeys } from '../lib/query'
import { Sheet } from '../components/Sheet'
import { TransactionDetailSheet } from '../components/TransactionDetailSheet'

type HomeData = {
  transactions: Transaction[]
  accounts: Account[]
  settings: { display_name: string | null; expected_monthly_income: number | null }
  categoryColors: Record<string, string>
}

type TypeFilter = 'all' | 'credit' | 'debit' | 'transfer'

const TYPE_PREFIX: Record<string, string> = { credit: '+', debit: '−', transfer: '⇄' }
const TYPE_COLOR: Record<string, string> = { credit: C.pos, debit: C.neg, transfer: C.transfer }

function transactionTypeForFilter(filter: TypeFilter): TransactionType | null {
  return filter === 'all' ? null : filter
}

function dayNet(txs: Transaction[]): number {
  return txs.reduce((total, tx) => {
    if (tx.type === 'credit') return total + tx.amount
    if (tx.type === 'debit') return total - tx.amount
    return total
  }, 0)
}

function formatTransactionDateHeader(date: string): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const todayStr = today.toISOString().slice(0, 10)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (date === todayStr) return 'Today'
  if (date === yesterdayStr) return 'Yesterday'
  return formatDateLabel(date)
}

function TxItem({
  tx,
  accountMap,
  catColors,
  onPress,
  onDelete,
}: {
  tx: Transaction
  accountMap: Record<string, string>
  catColors: Record<string, string>
  onPress: () => void
  onDelete: () => void
}) {
  const catC = categoryColor(tx.category, catColors)
  const typeColor = TYPE_COLOR[tx.type] ?? C.ink
  const accountName = tx.account_id ? accountMap[tx.account_id] : null
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 20, stiffness: 300 }) }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 300 }) }}
      onPress={onPress}
      android_ripple={{ color: C.line }}
    >
      <Animated.View style={[ti.row, animStyle]}>
        <View style={[ti.dot, { backgroundColor: catC }]} />
        <View style={ti.info}>
          <Text style={ti.name} numberOfLines={1}>
            {tx.merchant || tx.description || '—'}
          </Text>
          {(tx.category || accountName) && (
            <Text style={ti.sub} numberOfLines={1}>
              {tx.category ? (
                <Text style={{ color: catC, fontFamily: F.bold }}>{tx.category}</Text>
              ) : null}
              {tx.category && accountName ? ' · ' : ''}
              {accountName ?? ''}
            </Text>
          )}
        </View>
        {tx.is_recurring && <Text style={ti.recurring}>↻</Text>}
        <View style={ti.right}>
          {!tx.reviewed && <View style={ti.unreviewedDot} />}
          <Text style={[ti.amount, { color: typeColor }]}>
            {TYPE_PREFIX[tx.type]}{formatAmount(tx.amount)}
          </Text>
          <Pressable onPress={onDelete} hitSlop={8} style={ti.deleteBtn}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="3 6 5 6 21 6" />
              <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <Path d="M10 11v6M14 11v6" />
              <Path d="M9 6V4h6v2" />
            </Svg>
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
  )
}

function TypePills({ value, onChange }: { value: TypeFilter; onChange: (value: TypeFilter) => void }) {
  const filters: Array<{ value: TypeFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'credit', label: 'Income' },
    { value: 'debit', label: 'Expense' },
    { value: 'transfer', label: 'Transfer' },
  ]

  return (
    <View style={tp.wrap}>
      {filters.map((filter) => {
        const active = filter.value === value
        const color = filter.value === 'all' ? C.brand : TYPE_COLOR[filter.value]
        return (
          <Pressable
            key={filter.value}
            onPress={() => onChange(filter.value)}
            style={[tp.pill, active && { backgroundColor: color, borderColor: color }]}
          >
            <Text style={[tp.text, active && tp.textActive]}>{filter.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function TransactionsScreen() {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const homeQuery = useQuery({
    queryKey: queryKeys.home,
    queryFn: getHomeData,
  })

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [recurringOnly, setRecurringOnly] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [monthSheetOpen, setMonthSheetOpen] = useState(false)
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [month, setMonth] = useState(() => toYearMonth(new Date()))

  const allTxs = homeQuery.data?.transactions ?? []
  const accounts = homeQuery.data?.accounts ?? []
  const catColors = homeQuery.data?.categoryColors ?? {}
  const monthTxs = getMonthTransactions(allTxs, month)
  const totalSpent = monthTxs
    .filter((tx) => tx.type === 'debit')
    .reduce((total, tx) => total + tx.amount, 0)
  const selectedType = transactionTypeForFilter(typeFilter)
  const filteredTxs = filterTransactions(monthTxs, {
    search: searchQuery,
    type: selectedType,
    category: selectedCategory,
    account: selectedAccount,
    recurringOnly,
  })
  const grouped = groupByDate(filteredTxs)
  const sortedDates = [...grouped.keys()].sort((a, b) => b.localeCompare(a))
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))
  const monthCategories = [...new Set(monthTxs.map((t) => t.category).filter(Boolean) as string[])]
  const recentCategories = [...new Set(
    [...allTxs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => t.category)
      .filter((c): c is string => !!c)
  )].slice(0, 3)
  const hasExtraFilters = !!(selectedCategory || selectedAccount || recurringOnly)

  function upsertTx(tx: Transaction) {
    queryClient.setQueryData<HomeData>(queryKeys.home, (prev) => {
      if (!prev) return prev
      const idx = prev.transactions.findIndex((t) => t.id === tx.id)
      const transactions = idx === -1 ? [tx, ...prev.transactions] : [...prev.transactions]
      if (idx !== -1) transactions[idx] = tx
      return { ...prev, transactions }
    })
    invalidateTransactionData(queryClient)
  }

  function removeTx(id: string) {
    queryClient.setQueryData<HomeData>(queryKeys.home, (prev) => (
      prev ? { ...prev, transactions: prev.transactions.filter((t) => t.id !== id) } : prev
    ))
    invalidateTransactionData(queryClient)
  }

  function clearExtraFilters() {
    setSelectedCategory(null)
    setSelectedAccount(null)
    setRecurringOnly(false)
  }

  if (homeQuery.isLoading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    )
  }

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <View>
            <Text style={s.title}>Transactions</Text>
          </View>
          <View style={s.headerActions}>
            <Pressable
              onPress={() => setSearchOpen((value) => !value)}
              style={[s.iconBtn, searchOpen && s.iconBtnActive]}
              accessibilityLabel="Search transactions"
            >
              <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={searchOpen ? C.brand : C.ink3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="11" cy="11" r="8" />
                <Line x1="21" y1="21" x2="16.65" y2="16.65" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={() => setFilterSheetOpen(true)}
              style={[s.iconBtn, hasExtraFilters && s.iconBtnActive]}
              accessibilityLabel="Open filters"
            >
              <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={hasExtraFilters ? C.brand : C.ink3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <Line x1="4" y1="6" x2="20" y2="6" />
                <Line x1="8" y1="12" x2="16" y2="12" />
                <Line x1="11" y1="18" x2="13" y2="18" />
              </Svg>
            </Pressable>
          </View>
        </View>

        {searchOpen && (
          <View style={s.searchWrap}>
            <View style={s.searchBox}>
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="11" cy="11" r="8" />
                <Line x1="21" y1="21" x2="16.65" y2="16.65" />
              </Svg>
              <TextInput
                style={s.searchInput}
                placeholder="Search by name or notes..."
                placeholderTextColor={C.ink3}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2.5" strokeLinecap="round">
                    <Line x1="18" y1="6" x2="6" y2="18" />
                    <Line x1="6" y1="6" x2="18" y2="18" />
                  </Svg>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        <TypePills value={typeFilter} onChange={setTypeFilter} />

        <View style={s.monthSummaryRow}>
          <Pressable style={s.monthButton} onPress={() => setMonthSheetOpen(true)}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M8 2v4M16 2v4" />
              <Path d="M3 10h18" />
              <Path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            </Svg>
            <Text style={s.monthButtonText}>{formatMonthLabel(month)}</Text>
          </Pressable>
          <View style={s.totalSpentWrap}>
            <Text style={s.totalSpentValue}>{formatAmount(totalSpent)}</Text>
            <Text style={s.totalSpentLabel}>Total Spent</Text>
          </View>
        </View>

        {monthTxs.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No transactions this month</Text>
            <Text style={s.emptySub}>New transactions will appear here once added.</Text>
          </View>
        ) : filteredTxs.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No results</Text>
            <Text style={s.emptySub}>Try adjusting your search or filters.</Text>
          </View>
        ) : (
          sortedDates.map((date) => {
            const txs = grouped.get(date)!
            const net = dayNet(txs)
            const netColor = net >= 0 ? C.pos : C.neg
            return (
              <View key={date}>
                <View style={s.dateHeader}>
                  <Text style={s.dateLabel}>{formatTransactionDateHeader(date)}</Text>
                  <Text style={[s.dateNet, { color: netColor }]}>
                    {net < 0 ? '−' : '+'}{formatAmount(Math.abs(net))}
                  </Text>
                </View>
                {txs.map((tx) => (
                  <TxItem
                    key={tx.id}
                    tx={tx}
                    accountMap={accountMap}
                    catColors={catColors}
                    onPress={() => { setDetailTx(tx); setDetailOpen(true) }}
                    onDelete={() => {
                      Alert.alert('Delete transaction?', 'This cannot be undone.', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await deleteTransaction(tx.id)
                              removeTx(tx.id)
                            } catch {
                              Alert.alert('Error', 'Could not delete transaction.')
                            }
                          },
                        },
                      ])
                    }}
                  />
                ))}
              </View>
            )
          })
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Sheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        heightFraction={0.48}
        header={(
          <View style={s.filterHeaderWrap}>
            <View style={s.filterHeader}>
              <Text style={s.filterTitle}>Filters</Text>
              {hasExtraFilters && (
                <Pressable onPress={clearExtraFilters}>
                  <Text style={s.clearAll}>Clear all</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      >
        <View style={s.filterContent}>
          {monthCategories.length > 0 && (
            <View style={s.filterSection}>
              <Text style={s.filterSectionLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={[s.chips, { flexWrap: 'nowrap' }]}>
                  {monthCategories.map((cat) => {
                    const active = selectedCategory === cat
                    const cc = categoryColor(cat, catColors)
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setSelectedCategory(active ? null : cat)}
                        style={[s.chip, active && { backgroundColor: cc, borderColor: cc }]}
                      >
                        <Text style={[s.chipText, active && { color: '#fff' }]}>{cat}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {accounts.length > 0 && (
            <View style={s.filterSection}>
              <Text style={s.filterSectionLabel}>ACCOUNT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={[s.chips, { flexWrap: 'nowrap' }]}>
                  {accounts.map((acc) => {
                    const active = selectedAccount === acc.id
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={() => setSelectedAccount(active ? null : acc.id)}
                        style={[s.chip, active && { backgroundColor: C.brand, borderColor: C.brand }]}
                      >
                        <Text style={[s.chipText, active && { color: '#fff' }]}>{acc.name}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          <View style={s.filterRow}>
            <Text style={s.filterRowLabel}>Recurring only</Text>
            <Switch
              value={recurringOnly}
              onValueChange={setRecurringOnly}
              trackColor={{ false: C.line, true: C.brand }}
              thumbColor={C.surface}
            />
          </View>
        </View>
      </Sheet>

      <Sheet
        visible={monthSheetOpen}
        onClose={() => setMonthSheetOpen(false)}
        heightFraction={0.38}
        header={(
          <View style={s.filterHeaderWrap}>
            <View style={s.filterHeader}>
              <Text style={s.filterTitle}>Month</Text>
              <Pressable onPress={() => setMonthSheetOpen(false)}>
                <Text style={s.clearAll}>Done</Text>
              </Pressable>
            </View>
          </View>
        )}
      >
        <View style={s.monthSheetContent}>
          <Pressable style={s.monthSheetBtn} onPress={() => setMonth((current) => addMonths(current, -1))}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="15 18 9 12 15 6" />
            </Svg>
            <Text style={s.monthSheetBtnText}>Previous month</Text>
          </Pressable>
          <View style={s.monthSheetCurrent}>
            <Text style={s.monthSheetCurrentText}>{formatMonthLabel(month)}</Text>
          </View>
          <Pressable style={s.monthSheetBtn} onPress={() => setMonth((current) => addMonths(current, 1))}>
            <Text style={s.monthSheetBtnText}>Next month</Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="9 18 15 12 9 6" />
            </Svg>
          </Pressable>
        </View>
      </Sheet>

      <TransactionDetailSheet
        tx={detailTx}
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        onSaved={(tx) => { upsertTx(tx); setDetailOpen(false) }}
        accounts={accounts}
        catColors={catColors}
        recentCategories={recentCategories}
      />
    </View>
  )
}

const ti = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: ROW_PAD,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  sub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, marginTop: 1 },
  recurring: { fontSize: 12, fontFamily: F.semibold, color: C.ink3, flexShrink: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  unreviewedDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.neg },
  amount: { fontSize: 14, fontFamily: F.monoBold },
  deleteBtn: { padding: 2, marginLeft: 2 },
})

const tp = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.surface,
  },
  text: { fontSize: 12.5, fontFamily: F.medium, color: C.ink3 },
  textActive: { color: '#fff', fontFamily: F.bold },
})

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 6,
  },
  title: { fontSize: 23, fontFamily: F.extrabold, color: C.ink },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {},
  searchWrap: { paddingHorizontal: 16, paddingTop: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.ink, padding: 0 },
  monthSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  monthButtonText: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  totalSpentWrap: { alignItems: 'flex-end', flexShrink: 0 },
  totalSpentLabel: { fontSize: 10.5, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  totalSpentValue: { fontSize: 15, fontFamily: F.monoBold, color: C.neg },
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: F.extrabold, color: C.ink, textAlign: 'center' },
  emptySub: { fontSize: 13.5, fontFamily: F.regular, color: C.ink3, lineHeight: 20, textAlign: 'center' },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  dateLabel: { fontSize: 12, fontFamily: F.bold, color: C.ink3 },
  dateNet: { fontSize: 12, fontFamily: F.monoBold },
  filterContent: { paddingHorizontal: 16, paddingBottom: 16 },
  filterHeaderWrap: { paddingHorizontal: 16 },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterTitle: { flex: 1, marginRight: 12, fontSize: 16, fontFamily: F.semibold, color: C.ink },
  clearAll: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
  filterSection: { marginBottom: 16 },
  filterSectionLabel: {
    fontSize: 11,
    fontFamily: F.medium,
    color: C.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  chipText: { fontSize: 14, fontFamily: F.medium, color: C.ink },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  filterRowLabel: { fontSize: 14, fontFamily: F.regular, color: C.ink },
  monthSheetContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  monthSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  monthSheetBtnText: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  monthSheetCurrent: { alignItems: 'center', paddingVertical: 6 },
  monthSheetCurrentText: { fontSize: 18, fontFamily: F.extrabold, color: C.ink },
})
