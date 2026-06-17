import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation'
import type { Transaction, TransactionType } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'
import {
  filterTransactions,
  groupByDate,
  calcSummary,
  getMonthTransactions,
} from '@paisa-buddy/shared/logic/transaction'
import { formatAmount } from '@paisa-buddy/shared/logic/amount'
import {
  toYearMonth,
  addMonths,
  formatMonthLabel,
  formatDateLabel,
} from '@paisa-buddy/shared/logic/date'
import { categoryColor } from '@paisa-buddy/shared/categories'
import { C, F, RADIUS, ROW_PAD } from '../lib/tokens'
import { deleteTransaction, fetchHomeData } from '../lib/api'
import { Sheet } from '../components/Sheet'
import { AddTransactionSheet } from '../components/AddTransactionSheet'
import { TransactionDetailSheet } from '../components/TransactionDetailSheet'

type HomeData = {
  transactions: Transaction[]
  accounts: Account[]
  settings: { display_name: string | null; expected_monthly_income: number | null }
  categoryColors: Record<string, string>
}

// ─── SVG Components ────────────────────────────────────────────────────────────

function BuddySVG({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M32 13 C 32 6, 26 3, 23 6 C 21 9, 26 13, 32 13 Z" fill={C.brand} />
      <Path d="M32 13 C 32 7, 38 5, 40 8 C 41 11, 37 14, 32 13 Z" fill="#2BA77F" />
      <Path d="M32 16 L 32 11" stroke={C.brandDeep} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="32" cy="36" r="22" fill={C.brandPale} stroke={C.brand} strokeWidth="2.5" />
      <Circle cx="32" cy="36" r="17" stroke={C.brand} strokeWidth="1.5" strokeOpacity="0.3" />
      <Circle cx="22" cy="40" r="3.2" fill="#F4B8A8" fillOpacity="0.7" />
      <Circle cx="42" cy="40" r="3.2" fill="#F4B8A8" fillOpacity="0.7" />
      <Circle cx="25.5" cy="34" r="2.6" fill={C.brandDeep} />
      <Circle cx="38.5" cy="34" r="2.6" fill={C.brandDeep} />
      <Path d="M25 41 Q32 47 39 41" stroke={C.brandDeep} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </Svg>
  )
}

function EmptyBuddy({ size = 104 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect x="40" y="6" width="20" height="14" rx="5" fill={C.brand} />
      <Path d="M45 19 L45 24 L50 19 Z" fill={C.brand} />
      <SvgText x="50" y="16" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">hi!</SvgText>
      <Path d="M10 16 C 10 18, 12 20, 14 20 C 12 20, 10 22, 10 24 C 10 22, 8 20, 6 20 C 8 20, 10 18, 10 16 Z" fill={C.gold} />
      <Path d="M58 34 C 58 35.6, 59.6 37, 61 37 C 59.6 37, 58 38.4, 58 40 C 58 38.4, 56.4 37, 55 37 C 56.4 37, 58 35.6, 58 34 Z" fill="#2BA77F" />
      <Path d="M27 22 C 27 16, 22 13, 19 16 C 17 19, 22 22, 27 22 Z" fill={C.brand} />
      <Path d="M27 22 C 27 17, 32 15, 34 18 C 35 20, 31 23, 27 22 Z" fill="#2BA77F" />
      <Path d="M27 25 L 27 20" stroke={C.brandDeep} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="27" cy="44" r="19" fill={C.brandPale} stroke={C.brand} strokeWidth="2.5" />
      <Circle cx="27" cy="44" r="14.5" stroke={C.brand} strokeWidth="1.3" strokeOpacity="0.3" />
      <Circle cx="18.5" cy="46" r="3" fill="#F4B8A8" fillOpacity="0.75" />
      <Circle cx="35.5" cy="46" r="3" fill="#F4B8A8" fillOpacity="0.75" />
      <Circle cx="21.5" cy="41" r="2.5" fill={C.brandDeep} />
      <Circle cx="32.5" cy="41" r="2.5" fill={C.brandDeep} />
      <Path d="M20.5 46 Q27 53 33.5 46" stroke={C.brandDeep} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <Path d="M2 55 H62 V62 a2 2 0 0 1 -2 2 H4 a2 2 0 0 1 -2 -2 Z" fill={C.brandDeep} />
      <Rect x="2" y="53" width="60" height="3" rx="1.5" fill={C.brand} />
    </Svg>
  )
}

// ─── TxItem ────────────────────────────────────────────────────────────────────

const TYPE_PREFIX: Record<string, string> = { credit: '+', debit: '−', transfer: '⇄' }
const TYPE_COLOR: Record<string, string> = { credit: C.pos, debit: C.neg, transfer: C.transfer }

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

// ─── HomeScreen ────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const fabScale = useSharedValue(1)
  const fabAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }))
  const [month, setMonth] = useState(() => toYearMonth(new Date()))
  const [allTxs, setAllTxs] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [settings, setSettings] = useState<{
    display_name: string | null
    expected_monthly_income: number | null
  } | null>(null)
  const [catColors, setCatColors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<TransactionType | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [recurringOnly, setRecurringOnly] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)


  // Sheets
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchHomeData() as HomeData
      setAllTxs(Array.isArray(data.transactions) ? data.transactions : [])
      setAccounts(Array.isArray(data.accounts) ? data.accounts : [])
      setSettings(data.settings)
      setCatColors(data.categoryColors ?? {})
    } catch {
      setAllTxs([])
      setAccounts([])
      setSettings(null)
      setCatColors({})
    }
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    load().finally(() => setRefreshing(false))
  }, [load])

  function upsertTx(tx: Transaction) {
    setAllTxs((prev) => {
      const idx = prev.findIndex((t) => t.id === tx.id)
      if (idx === -1) return [tx, ...prev]
      const next = [...prev]
      next[idx] = tx
      return next
    })
  }

  function removeTx(id: string) {
    setAllTxs((prev) => prev.filter((t) => t.id !== id))
  }

  // ─── Derived state ──────────────────────────────────────────────────────────
  const monthTxs = getMonthTransactions(allTxs, month)
  const { income, expense, balance, transfer } = calcSummary(monthTxs)
  const expectedIncome = settings?.expected_monthly_income ?? 0
  const hasIncomeTarget = expectedIncome > 0
  const displayBalance = hasIncomeTarget ? expectedIncome - expense : balance
  const displayBalanceColor = displayBalance >= 0 ? C.pos : C.neg
  const incomeSpentPct = hasIncomeTarget
    ? Math.min(100, Math.round((expense / expectedIncome) * 100))
    : 0
  const incomeBarColor = incomeSpentPct >= 100 ? C.neg : incomeSpentPct >= 80 ? C.gold : C.brand
  const pendingCount = allTxs.filter((t) => !t.reviewed).length
  const baseTxs = monthTxs
  const filteredTxs = filterTransactions(baseTxs, {
    search: searchQuery,
    type: selectedType,
    category: selectedCategory,
    account: selectedAccount,
    recurringOnly,
  })
  const grouped = groupByDate(filteredTxs)
  const sortedDates = [...grouped.keys()].sort((a, b) => b.localeCompare(a))
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))
  const firstName = settings?.display_name?.split(' ')[0] ?? null
  const greetingDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const hasFilters = !!(selectedType || selectedCategory || selectedAccount || recurringOnly)
  const monthCategories = [...new Set(monthTxs.map((t) => t.category).filter(Boolean) as string[])]

  const absFmt = formatAmount(Math.abs(displayBalance))
  const balSign = displayBalance < 0 ? '−' : ''
  const dotIdx = absFmt.lastIndexOf('.')
  const balInt = dotIdx === -1 ? absFmt : absFmt.slice(0, dotIdx)
  const balDec = dotIdx === -1 ? '' : absFmt.slice(dotIdx)

  function clearFilters() {
    setSelectedType(null)
    setSelectedCategory(null)
    setSelectedAccount(null)
    setRecurringOnly(false)
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />
        }
      >
        {/* ── Greeting header ── */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <BuddySVG size={48} />
          <View style={s.headerText}>
            <Text style={s.greetName}>{firstName ? `Hi, ${firstName}` : 'Hi there'}</Text>
            <Text style={s.greetDate}>{greetingDate}</Text>
          </View>
        </View>

        {/* ── Month picker ── */}
        <View style={s.monthPicker}>
          <Pressable onPress={() => setMonth(addMonths(month, -1))} hitSlop={8} style={s.monthArrow}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="15 18 9 12 15 6" />
            </Svg>
          </Pressable>
          <View style={s.monthCenter}>
            <Text style={s.monthLabel}>{formatMonthLabel(month)}</Text>
            <Text style={s.monthCount}>
              {monthTxs.length} transaction{monthTxs.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Pressable onPress={() => setMonth(addMonths(month, 1))} hitSlop={8} style={s.monthArrow}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="9 18 15 12 9 6" />
            </Svg>
          </Pressable>
        </View>

        {/* ── Balance card ── */}
        <View style={s.cardPad}>
          <View style={s.card}>
            <Text style={s.balLabel}>
              {hasIncomeTarget ? 'Remaining' : 'Net balance'}
            </Text>
            <View style={s.balRow}>
              <Text style={[s.balInt, { color: displayBalanceColor }]}>
                {balSign}{balInt}
              </Text>
              {balDec ? (
                <Text style={[s.balDec, { color: C.ink3 }]}>{balDec}</Text>
              ) : null}
            </View>
            {hasIncomeTarget && (
              <View style={s.progressWrap}>
                <View style={s.progressLabelRow}>
                  <Text style={s.progressLabel}>
                    {formatAmount(expense)} of {formatAmount(expectedIncome)} spent
                  </Text>
                  <Text style={[s.progressPct, { color: incomeBarColor }]}>
                    {incomeSpentPct}%
                  </Text>
                </View>
                <View style={s.progressTrack}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${incomeSpentPct}%` as `${number}%`,
                        backgroundColor: incomeBarColor,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
            <View style={s.statsRow}>
              {[
                { label: 'INCOME', value: income, color: C.pos },
                { label: 'SPENT', value: expense, color: C.neg },
                { label: 'TRANSFERS', value: transfer, color: C.transfer },
              ].map(({ label, value, color }, i) => (
                <View key={label} style={[s.statCol, i > 0 && s.statColBorder]}>
                  <Text style={s.statLabel}>{label}</Text>
                  <Text style={[s.statValue, { color }]} numberOfLines={1}>
                    {formatAmount(value)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Pending review banner ── */}
        {pendingCount > 0 && (
          <Pressable
            style={s.pendingBanner}
            onPress={() => navigation.navigate('Review')}
          >
            <View style={s.pendingBadge}>
              <Text style={s.pendingBadgeText}>{pendingCount}</Text>
            </View>
            <View style={s.pendingInfo}>
              <Text style={s.pendingTitle}>Transactions pending review</Text>
              <Text style={s.pendingSub}>Tap to review · From imports &amp; shortcuts</Text>
            </View>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.neg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="9 18 15 12 9 6" />
            </Svg>
          </Pressable>
        )}

        {/* ── Search bar ── */}
        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="11" cy="11" r="8" />
              <Line x1="21" y1="21" x2="16.65" y2="16.65" />
            </Svg>
            <TextInput
              style={s.searchInput}
              placeholder="Search by name or notes…"
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
          {monthTxs.length > 0 && (
            <Pressable
              onPress={() => setFilterSheetOpen(true)}
              style={[s.filterBtn, hasFilters && s.filterBtnActive]}
              accessibilityLabel="Open filters"
            >
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={hasFilters ? '#fff' : C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <Line x1="4" y1="6" x2="20" y2="6" />
                <Line x1="8" y1="12" x2="16" y2="12" />
                <Line x1="11" y1="18" x2="13" y2="18" />
              </Svg>
            </Pressable>
          )}
        </View>

        {/* ── Transaction list / empty states ── */}
        {monthTxs.length === 0 ? (
          <View style={s.emptyState}>
            <EmptyBuddy size={104} />
            <Text style={s.emptyTitle}>Let's get your paisa in order!</Text>
            <Text style={s.emptySub}>Tap + to add your first transaction.</Text>
          </View>
        ) : filteredTxs.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No results</Text>
            <Text style={s.emptySub}>Try adjusting your search or filters.</Text>
          </View>
        ) : (
          sortedDates.map((date) => (
            <View key={date}>
              <View style={s.dateHeader}>
                <Text style={s.dateLabel}>{formatDateLabel(date)}</Text>
              </View>
              {grouped.get(date)!.map((tx) => (
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
                        text: 'Delete', style: 'destructive',
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
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <Pressable
        style={[s.fabWrap, { bottom: insets.bottom - 20 }]}
        accessibilityLabel="Add transaction"
        onPressIn={() => { fabScale.value = withSpring(0.90, { damping: 15, stiffness: 300 }) }}
        onPressOut={() => { fabScale.value = withSpring(1, { damping: 15, stiffness: 300 }) }}
        onPress={() => { setEditTx(null); setAddSheetOpen(true) }}
      >
        <Animated.View style={[s.fab, fabAnimStyle]}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <Line x1="12" y1="5" x2="12" y2="19" />
            <Line x1="5" y1="12" x2="19" y2="12" />
          </Svg>
        </Animated.View>
      </Pressable>

      {/* ── Filter bottom sheet ── */}
      <Sheet visible={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} heightFraction={0.55}>
        <View style={s.filterContent}>
          <View style={s.filterHeader}>
            <Text style={s.filterTitle}>Filters</Text>
            {hasFilters && (
              <Pressable onPress={clearFilters}>
                <Text style={s.clearAll}>Clear all</Text>
              </Pressable>
            )}
          </View>

          <View style={s.filterSection}>
            <Text style={s.filterSectionLabel}>TYPE</Text>
            <View style={s.chips}>
              {(['debit', 'credit', 'transfer'] as TransactionType[]).map((type) => {
                const active = selectedType === type
                const tc = TYPE_COLOR[type]
                return (
                  <Pressable
                    key={type}
                    onPress={() => setSelectedType(active ? null : type)}
                    style={[s.chip, active && { backgroundColor: tc, borderColor: tc }]}
                  >
                    <Text style={[s.chipText, active && { color: '#fff' }]}>{type}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

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

      {/* ── Add / Edit transaction sheet ── */}
      <AddTransactionSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onSaved={(tx) => upsertTx(tx)}
        accounts={accounts}
        catColors={catColors}
        editTx={editTx}
        onAccountCreated={(acc) => setAccounts((prev) => [...prev, acc])}
        onCategoryCreated={(name, color) => setCatColors((prev) => ({ ...prev, [name]: color }))}
      />

      {/* ── Transaction detail sheet ── */}
      <TransactionDetailSheet
        tx={detailTx}
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        onSaved={(tx) => { upsertTx(tx); setDetailOpen(false) }}
        onDeleted={(id) => { removeTx(id); setDetailOpen(false) }}
        accounts={accounts}
        catColors={catColors}
      />
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 8,
    gap: 11,
  },
  headerText: { flex: 1 },
  greetName: { fontSize: 18, fontFamily: F.extrabold, color: C.ink, letterSpacing: -0.18 },
  greetDate: { fontSize: 12.5, fontFamily: F.regular, color: C.ink3, marginTop: 1 },

  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  monthArrow: { padding: 4 },
  monthCenter: { alignItems: 'center', gap: 2 },
  monthLabel: { fontSize: 14, fontFamily: F.medium, color: C.ink },
  monthCount: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },

  cardPad: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    padding: 14,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#14281E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  balLabel: {
    fontSize: 11,
    fontFamily: F.bold,
    color: C.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
  },
  balRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2, marginBottom: 12 },
  balInt: { fontSize: 34, fontFamily: F.monoBold, letterSpacing: -0.68 },
  balDec: { fontSize: 20, fontFamily: F.mono, marginLeft: 1 },
  progressWrap: { marginBottom: 12 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  progressLabel: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3 },
  progressPct: { fontSize: 11.5, fontFamily: F.bold },
  progressTrack: { height: 5, borderRadius: 99, backgroundColor: C.line, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 99 },
  statsRow: { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  statCol: { flex: 1, gap: 2 },
  statColBorder: { paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: C.line },
  statLabel: {
    fontSize: 11,
    fontFamily: F.bold,
    color: C.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.33,
  },
  statValue: { fontSize: 13, fontFamily: F.monoBold },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(219,90,75,0.08)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.line,
  },

  pendingBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: C.neg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadgeText: { color: '#fff', fontSize: 12, fontFamily: F.bold },
  pendingInfo: { flex: 1 },
  pendingTitle: { fontSize: 14, fontFamily: F.semibold, color: C.neg },
  pendingSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.ink, padding: 0 },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  filterBtnActive: { backgroundColor: C.brand, borderColor: C.brand },

  emptyState: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 24,
    gap: 12,
    marginTop: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: F.extrabold,
    color: C.ink,
    letterSpacing: -0.17,
    textAlign: 'center',
  },
  emptySub: { fontSize: 13.5, fontFamily: F.regular, color: C.ink3, lineHeight: 20, textAlign: 'center' },

  dateHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  dateLabel: { fontSize: 12, fontFamily: F.bold, color: C.ink3 },

  fabWrap: {
    position: 'absolute',
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 11,
    elevation: 12,
  },

  filterContent: { paddingHorizontal: 16, paddingBottom: 16 },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterTitle: { fontSize: 16, fontFamily: F.semibold, color: C.ink },
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
  chipText: { fontSize: 14, fontFamily: F.medium, color: C.ink, textTransform: 'capitalize' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  filterRowLabel: { fontSize: 14, fontFamily: F.regular, color: C.ink },
})
