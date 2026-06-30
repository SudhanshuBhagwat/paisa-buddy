import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { haptics } from '../lib/haptics'
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Transaction, TransactionType } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'
import { filterTransactions, groupByDate } from '@paisa-buddy/shared/logic/transaction'
import { formatAmount } from '@paisa-buddy/shared/logic/amount'
import { addMonths, formatDateLabel, formatMonthLabel, toYearMonth } from '@paisa-buddy/shared/logic/date'
import { categoryColor } from '@paisa-buddy/shared/categories'
import { C, F, RADIUS, ROW_PAD } from '../lib/tokens'
import { CategoryIcon } from '../components/CategoryIcon'
import { deleteTransaction, getByMonth, getByMonths } from '../repositories/transactionRepository'
import { getTransactionSupportData } from '../lib/data'
import { invalidateTransactionData, queryKeys } from '../lib/query'
import { Sheet } from '../components/Sheet'
import { Dialog, MessageDialog, type MessageDialogState } from '../components/Dialog'
import { MonthSelectionSheet, type MonthPreset } from '../components/MonthSelectionSheet'
import { TransactionDetailSheet } from '../components/TransactionDetailSheet'
import { SwipeableRow } from '../components/SwipeableRow'
import { AnimatedAmount } from '../components/AnimatedAmount'

type TypeFilter = 'all' | 'credit' | 'debit' | 'transfer'
type MonthMode = 'single' | 'last-3-months'

const TYPE_PREFIX: Record<string, string> = { credit: '+', debit: '−', transfer: '⇄' }
const TYPE_COLOR: Record<string, string> = { credit: C.pos, debit: C.neg, transfer: C.transfer }
const TYPE_FILTERS: Array<{ value: TypeFilter; label: string; color: string }> = [
  { value: 'all', label: 'All', color: C.brand },
  { value: 'credit', label: 'Income', color: TYPE_COLOR.credit },
  { value: 'debit', label: 'Expense', color: TYPE_COLOR.debit },
  { value: 'transfer', label: 'Transfer', color: TYPE_COLOR.transfer },
]

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
    <SwipeableRow actionLabel="Delete" onAction={onDelete}>
    <Pressable
        onPressIn={() => { scale.value = withTiming(0.98, { duration: 90 }) }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 120 }) }}
      onPress={() => { haptics.lightImpact(); onPress() }}
      android_ripple={{ color: C.line }}
      accessibilityRole="button"
      accessibilityLabel={`${tx.merchant || tx.description || 'Transaction'}, ${tx.type === 'credit' ? 'Income' : tx.type === 'debit' ? 'Expense' : 'Transfer'} ${formatAmount(tx.amount)}${tx.category ? `, ${tx.category}` : ''}`}
    >
      <Animated.View style={[ti.row, animStyle]}>
        <CategoryIcon category={tx.category} colorMap={catColors} size={18} circleSize={34} />
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
        </View>
      </Animated.View>
    </Pressable>
    </SwipeableRow>
  )
}

const TypePills = memo(function TypePills({ value, onChange }: { value: TypeFilter; onChange: (value: TypeFilter) => void }) {
  const [wrapWidth, setWrapWidth] = useState(0)
  const pillX = useSharedValue(0)
  const pillColor = useSharedValue(TYPE_FILTERS[0].color)
  const gap = 2
  const horizontalPad = 3
  const pillWidth = wrapWidth > 0
    ? (wrapWidth - horizontalPad * 2 - gap * (TYPE_FILTERS.length - 1)) / TYPE_FILTERS.length
    : 0

  useEffect(() => {
    const idx = Math.max(0, TYPE_FILTERS.findIndex((filter) => filter.value === value))
    if (pillWidth > 0) {
      pillX.value = withTiming(idx * (pillWidth + gap), { duration: 240 })
    }
    pillColor.value = withTiming(TYPE_FILTERS[idx].color, { duration: 180 })
  }, [gap, pillColor, pillWidth, pillX, value])

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: pillColor.value,
    transform: [{ translateX: pillX.value }],
  }))

  return (
    <View style={tp.wrap} onLayout={(event) => setWrapWidth(event.nativeEvent.layout.width)}>
      {pillWidth > 0 && <Animated.View style={[tp.slider, { width: pillWidth }, pillStyle]} />}
      {TYPE_FILTERS.map((filter) => {
        const active = filter.value === value
        return (
          <Pressable
            key={filter.value}
            onPress={() => { haptics.selection(); onChange(filter.value) }}
            style={tp.pill}
            accessibilityRole="button"
            accessibilityLabel={filter.label}
            accessibilityState={{ selected: active }}
          >
            <Text style={[tp.text, active && tp.textActive]} numberOfLines={1}>{filter.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
})

type TransactionsTopControlsProps = {
  topInset: number
  searchOpen: boolean
  searchQuery: string
  typeFilter: TypeFilter
  hasExtraFilters: boolean
  onToggleSearch: () => void
  onOpenFilters: () => void
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  onTypeChange: (value: TypeFilter) => void
}

const TransactionsTopControls = memo(function TransactionsTopControls({
  topInset,
  searchOpen,
  searchQuery,
  typeFilter,
  hasExtraFilters,
  onToggleSearch,
  onOpenFilters,
  onSearchChange,
  onClearSearch,
  onTypeChange,
}: TransactionsTopControlsProps) {
  return (
    <>
      <View style={[s.header, { paddingTop: topInset + 16 }]}>
        <View>
          <Text style={s.title}>Transactions</Text>
        </View>
        <View style={s.headerActions}>
          <Pressable
            onPress={onToggleSearch}
            style={[s.iconBtn, searchOpen && s.iconBtnActive]}
            accessibilityLabel="Search transactions"
          >
            <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={searchOpen ? C.brand : C.ink3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="11" cy="11" r="8" />
              <Line x1="21" y1="21" x2="16.65" y2="16.65" />
            </Svg>
          </Pressable>
          <Pressable
            onPress={onOpenFilters}
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
              onChangeText={onSearchChange}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={onClearSearch} hitSlop={8}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2.5" strokeLinecap="round">
                  <Line x1="18" y1="6" x2="6" y2="18" />
                  <Line x1="6" y1="6" x2="18" y2="18" />
                </Svg>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      <TypePills value={typeFilter} onChange={onTypeChange} />
    </>
  )
})

const MonthPickerButton = memo(function MonthPickerButton({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  return (
    <Pressable style={s.monthButton} onPress={onPress}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M8 2v4M16 2v4" />
        <Path d="M3 10h18" />
        <Path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      </Svg>
      <Text style={s.monthButtonText}>{label}</Text>
    </Pressable>
  )
})

const TransactionsList = memo(function TransactionsList({
  isMonthChanging,
  monthTxCount,
  filteredTxCount,
  sortedDates,
  grouped,
  accountMap,
  catColors,
  fadeStyle,
  onSelectTransaction,
  onDeleteTransaction,
}: {
  isMonthChanging: boolean
  monthTxCount: number
  filteredTxCount: number
  sortedDates: string[]
  grouped: Map<string, Transaction[]>
  accountMap: Record<string, string>
  catColors: Record<string, string>
  fadeStyle: ReturnType<typeof useAnimatedStyle>
  onSelectTransaction: (tx: Transaction) => void
  onDeleteTransaction: (tx: Transaction) => void
}) {
  return (
    <Animated.View style={fadeStyle}>
      {isMonthChanging ? (
        <View style={s.monthLoading}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : monthTxCount === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyTitle}>No transactions this month</Text>
          <Text style={s.emptySub}>New transactions will appear here once added.</Text>
        </View>
      ) : filteredTxCount === 0 ? (
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
                  {net < 0 ? 'âˆ’' : '+'}{formatAmount(Math.abs(net))}
                </Text>
              </View>
              {txs.map((tx) => (
                <TxItem
                  key={tx.id}
                  tx={tx}
                  accountMap={accountMap}
                  catColors={catColors}
                  onPress={() => onSelectTransaction(tx)}
                  onDelete={() => onDeleteTransaction(tx)}
                />
              ))}
            </View>
          )
        })
      )}
    </Animated.View>
  )
})

type TransactionsFilterSheetProps = {
  visible: boolean
  hasExtraFilters: boolean
  monthCategories: string[]
  selectedCategory: string | null
  selectedAccount: string | null
  recurringOnly: boolean
  accounts: Account[]
  catColors: Record<string, string>
  onClose: () => void
  onClearExtraFilters: () => void
  onSelectCategory: (category: string | null) => void
  onSelectAccount: (accountId: string | null) => void
  onRecurringOnlyChange: (value: boolean) => void
}

const TransactionsFilterSheet = memo(function TransactionsFilterSheet({
  visible,
  hasExtraFilters,
  monthCategories,
  selectedCategory,
  selectedAccount,
  recurringOnly,
  accounts,
  catColors,
  onClose,
  onClearExtraFilters,
  onSelectCategory,
  onSelectAccount,
  onRecurringOnlyChange,
}: TransactionsFilterSheetProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.48}
      header={(
        <View style={s.filterHeaderWrap}>
          <View style={s.filterHeader}>
            <Text style={s.filterTitle}>Filters</Text>
            {hasExtraFilters && (
              <Pressable onPress={onClearExtraFilters}>
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
                      onPress={() => onSelectCategory(active ? null : cat)}
                      style={[s.chip, active && { backgroundColor: cc, borderColor: cc }]}
                    >
                      <Text style={[s.chipText, active && { color: '#fff' }]} numberOfLines={1}>{cat}</Text>
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
                      onPress={() => onSelectAccount(active ? null : acc.id)}
                      style={[s.chip, active && { backgroundColor: C.brand, borderColor: C.brand }]}
                    >
                      <Text style={[s.chipText, active && { color: '#fff' }]} numberOfLines={1}>{acc.name}</Text>
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
            onValueChange={onRecurringOnlyChange}
            trackColor={{ false: C.line, true: C.brand }}
            thumbColor={C.surface}
          />
        </View>
      </View>
    </Sheet>
  )
})

export function TransactionsScreen() {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(() => toYearMonth(new Date()))
  const [monthMode, setMonthMode] = useState<MonthMode>('single')
  const selectedMonths = useMemo(() => (
    monthMode === 'last-3-months'
      ? [month, addMonths(month, -1), addMonths(month, -2)]
      : [month]
  ), [month, monthMode])
  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(monthMode === 'last-3-months' ? `${month}:last-3-months` : month),
    queryFn: () => monthMode === 'last-3-months'
      ? getByMonths(selectedMonths)
      : getByMonth(month),
    placeholderData: (previousData) => previousData,
  })
  const supportQuery = useQuery({
    queryKey: queryKeys.transactionSupport,
    queryFn: getTransactionSupportData,
    staleTime: 5 * 60_000,
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
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<Transaction | null>(null)
  const [deletingSwipeTx, setDeletingSwipeTx] = useState(false)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)
  const listOpacity = useSharedValue(1)
  const listFadeStyle = useAnimatedStyle(() => ({ opacity: listOpacity.value }))

  const monthTxs = transactionsQuery.data ?? []
  const accounts = supportQuery.data?.accounts ?? []
  const catColors = supportQuery.data?.categoryColors ?? {}
  const totalSpent = useMemo(() => (
    monthTxs
      .filter((tx) => tx.type === 'debit')
      .reduce((total, tx) => total + tx.amount, 0)
  ), [monthTxs])
  const deferredSearch = useDeferredValue(searchQuery)
  const selectedType = useMemo(() => transactionTypeForFilter(typeFilter), [typeFilter])
  const filteredTxs = useMemo(() => filterTransactions(monthTxs, {
    search: deferredSearch,
    type: selectedType,
    category: selectedCategory,
    account: selectedAccount,
    recurringOnly,
  }), [monthTxs, recurringOnly, searchQuery, selectedAccount, selectedCategory, selectedType])
  const grouped = useMemo(() => groupByDate(filteredTxs), [filteredTxs])
  const sortedDates = useMemo(() => [...grouped.keys()].sort((a, b) => b.localeCompare(a)), [grouped])
  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts])
  const monthCategories = useMemo(
    () => [...new Set(monthTxs.map((t) => t.category).filter(Boolean) as string[])],
    [monthTxs],
  )
  const monthlySpends = useMemo(
    () => Object.fromEntries((supportQuery.data?.monthlySpends ?? []).map((item) => [item.month, item.spent])),
    [supportQuery.data?.monthlySpends],
  )
  const activeMonthPreset: MonthPreset | null = useMemo(() => {
    const thisMonth = toYearMonth(new Date())
    if (monthMode === 'last-3-months') return 'last-3-months'
    if (month === thisMonth) return 'this-month'
    if (month === addMonths(thisMonth, -1)) return 'last-month'
    return null
  }, [month, monthMode])
  const recentCategories = useMemo(() => [...new Set(
    [...monthTxs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => t.category)
      .filter((c): c is string => !!c)
  )].slice(0, 3), [monthTxs])
  const hasExtraFilters = !!(selectedCategory || selectedAccount || recurringOnly)
  const isInitialLoading = transactionsQuery.isLoading && !transactionsQuery.data
  const isMonthChanging = transactionsQuery.isPlaceholderData
  const activeTransactionsQueryKey = queryKeys.transactions(monthMode === 'last-3-months' ? `${month}:last-3-months` : month)
  const monthLabel = monthMode === 'last-3-months' ? 'Last 3 Months' : formatMonthLabel(month)
  const toggleSearch = useCallback(() => setSearchOpen((value) => !value), [])
  const openFilters = useCallback(() => setFilterSheetOpen(true), [])
  const clearSearch = useCallback(() => setSearchQuery(''), [])
  const openMonthSheet = useCallback(() => setMonthSheetOpen(true), [])
  const closeFilterSheet = useCallback(() => setFilterSheetOpen(false), [])
  const closeMonthSheet = useCallback(() => setMonthSheetOpen(false), [])
  const selectTransaction = useCallback((tx: Transaction) => {
    setDetailTx(tx)
    setDetailOpen(true)
  }, [])
  const selectCategoryFilter = useCallback((category: string | null) => setSelectedCategory(category), [])
  const selectAccountFilter = useCallback((accountId: string | null) => setSelectedAccount(accountId), [])

  useEffect(() => {
    listOpacity.value = 0.86
    listOpacity.value = withTiming(1, { duration: 280 })
  }, [listOpacity, typeFilter])

  function upsertTx(tx: Transaction) {
    queryClient.setQueryData<Transaction[]>(activeTransactionsQueryKey, (prev) => {
      if (!prev) return prev
      const idx = prev.findIndex((t) => t.id === tx.id)
      const transactions = idx === -1 ? [tx, ...prev] : [...prev]
      if (idx !== -1) transactions[idx] = tx
      return transactions
    })
    invalidateTransactionData(queryClient)
  }

  function removeTx(id: string) {
    queryClient.setQueryData<Transaction[]>(activeTransactionsQueryKey, (prev) => (
      prev ? prev.filter((t) => t.id !== id) : prev
    ))
    invalidateTransactionData(queryClient)
  }

  const clearExtraFilters = useCallback(() => {
    setSelectedCategory(null)
    setSelectedAccount(null)
    setRecurringOnly(false)
  }, [])

  const handleSelectMonth = useCallback((nextMonth: string) => {
    setMonthMode('single')
    setMonth(nextMonth)
  }, [])

  const handleSelectPreset = useCallback((preset: MonthPreset) => {
    if (preset === 'last-3-months') {
      setMonthMode('last-3-months')
      setMonth(toYearMonth(new Date()))
    }
  }, [])

  async function handleDeleteTransaction(tx: Transaction) {
    await deleteTransaction(tx.id)
    removeTx(tx.id)
    setDetailOpen(false)
    setDetailTx(null)
  }

  const requestDeleteTransaction = useCallback((tx: Transaction) => {
    setDeleteConfirmTx(tx)
  }, [])

  async function handleConfirmSwipeDelete() {
    if (!deleteConfirmTx) return
    setDeletingSwipeTx(true)
    try {
      await deleteTransaction(deleteConfirmTx.id)
      haptics.mediumImpact()
      removeTx(deleteConfirmTx.id)
      if (detailTx?.id === deleteConfirmTx.id) {
        setDetailOpen(false)
        setDetailTx(null)
      }
      setDeleteConfirmTx(null)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not delete transaction.' })
    } finally {
      setDeletingSwipeTx(false)
    }
  }

  if (isInitialLoading) {
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
        <TransactionsTopControls
          topInset={insets.top}
          searchOpen={searchOpen}
          searchQuery={searchQuery}
          typeFilter={typeFilter}
          hasExtraFilters={hasExtraFilters}
          onToggleSearch={toggleSearch}
          onOpenFilters={openFilters}
          onSearchChange={setSearchQuery}
          onClearSearch={clearSearch}
          onTypeChange={setTypeFilter}
        />

        <View style={s.monthSummaryRow}>
          <MonthPickerButton label={monthLabel} onPress={openMonthSheet} />
          <View style={s.totalSpentWrap}>
            <AnimatedAmount
              amount={totalSpent}
              style={s.totalSpentValue}
              numberOfLines={1}
            />
            <Text style={s.totalSpentLabel}>Total Spent</Text>
          </View>
        </View>

        <TransactionsList
          isMonthChanging={isMonthChanging}
          monthTxCount={monthTxs.length}
          filteredTxCount={filteredTxs.length}
          sortedDates={sortedDates}
          grouped={grouped}
          accountMap={accountMap}
          catColors={catColors}
          fadeStyle={listFadeStyle}
          onSelectTransaction={selectTransaction}
          onDeleteTransaction={requestDeleteTransaction}
        />
        <View style={{ height: 80 }} />
      </ScrollView>

      <TransactionsFilterSheet
        visible={filterSheetOpen}
        hasExtraFilters={hasExtraFilters}
        monthCategories={monthCategories}
        selectedCategory={selectedCategory}
        selectedAccount={selectedAccount}
        recurringOnly={recurringOnly}
        accounts={accounts}
        catColors={catColors}
        onClose={closeFilterSheet}
        onClearExtraFilters={clearExtraFilters}
        onSelectCategory={selectCategoryFilter}
        onSelectAccount={selectAccountFilter}
        onRecurringOnlyChange={setRecurringOnly}
      />

      <MonthSelectionSheet
        visible={monthSheetOpen}
        onClose={closeMonthSheet}
        selectedMonth={month}
        selectedPreset={activeMonthPreset}
        monthlySpends={monthlySpends}
        onSelectMonth={handleSelectMonth}
        onSelectPreset={handleSelectPreset}
      />

      <TransactionDetailSheet
        tx={detailTx}
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        onSaved={(tx) => { upsertTx(tx); setDetailOpen(false) }}
        onDelete={handleDeleteTransaction}
        accounts={accounts}
        catColors={catColors}
        recentCategories={recentCategories}
      />
      <Dialog
        visible={!!deleteConfirmTx}
        onClose={() => { if (!deletingSwipeTx) setDeleteConfirmTx(null) }}
        title="Delete transaction?"
        message="This cannot be undone."
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setDeleteConfirmTx(null), disabled: deletingSwipeTx },
          { label: 'Delete', variant: 'destructive', onPress: handleConfirmSwipeDelete, loading: deletingSwipeTx },
        ]}
      />
      <MessageDialog
        dialog={messageDialog}
        onClose={() => setMessageDialog(null)}
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
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  sub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, marginTop: 1 },
  recurring: { fontSize: 12, fontFamily: F.semibold, color: C.ink3, flexShrink: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  unreviewedDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.neg },
  amount: { fontSize: 14, fontFamily: F.monoBold },
})

const tp = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 2,
    marginHorizontal: 18,
    marginTop: 8,
    marginBottom: 10,
    padding: 3,
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    position: 'relative',
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  slider: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 8,
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
  searchWrap: { paddingHorizontal: 18, paddingTop: 8 },
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
    paddingHorizontal: 18,
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
  monthLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    paddingTop: 36,
    paddingBottom: 64,
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
  chipText: { fontSize: 14, fontFamily: F.medium, color: C.ink, flexShrink: 1 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  filterRowLabel: { fontSize: 14, fontFamily: F.regular, color: C.ink },
})
