import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CommonActions, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'
import {
  calcSummary,
  getMonthTransactions,
} from '@paisa-buddy/shared/logic/transaction'
import { formatAmount } from '@paisa-buddy/shared/logic/amount'
import {
  toYearMonth,
} from '@paisa-buddy/shared/logic/date'
import { C, F, RADIUS } from '../lib/tokens'
import { getHomeData } from '../lib/data'
import { invalidateTransactionData, queryKeys } from '../lib/query'
import { AddTransactionSheet } from '../components/AddTransactionSheet'

type HomeData = {
  transactions: Transaction[]
  accounts: Account[]
  settings: { display_name: string | null; expected_monthly_income: number | null }
  categoryColors: Record<string, string>
}

// ─── SVG Components ────────────────────────────────────────────────────────────

type BuddyMood = 'happy' | 'neutral' | 'worried' | 'stressed'

function BuddySVG({ size = 48, mood = 'happy' }: { size?: number; mood?: BuddyMood }) {
  const mouthPath =
    mood === 'happy'   ? 'M25 41 Q32 47 39 41' :
    mood === 'neutral' ? 'M25 42 L39 42' :
    mood === 'worried' ? 'M26 45 Q32 41 38 45' :
                         'M26 46 Q32 40 38 46'
  const showFrown = mood === 'worried' || mood === 'stressed'
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
      {showFrown ? (
        <>
          <Path d="M22 29 Q25.5 26.5 29 29" stroke={C.brandDeep} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <Path d="M35 29 Q38.5 26.5 42 29" stroke={C.brandDeep} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </>
      ) : null}
      <Path d={mouthPath} stroke={C.brandDeep} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </Svg>
  )
}

function BuddyWelcomeSVG({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect x="40" y="6" width="20" height="14" rx="5" fill="#1A936F" />
      <Path d="M45 19 L45 24 L50 19 Z" fill="#1A936F" />
      <SvgText x="50" y="16" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700">hi!</SvgText>
      <Path d="M10 16 C 10 18, 12 20, 14 20 C 12 20, 10 22, 10 24 C 10 22, 8 20, 6 20 C 8 20, 10 18, 10 16 Z" fill="#E0A33C" />
      <Path d="M58 34 C 58 35.6, 59.6 37, 61 37 C 59.6 37, 58 38.4, 58 40 C 58 38.4, 56.4 37, 55 37 C 56.4 37, 58 35.6, 58 34 Z" fill="#2BA77F" />
      <Path d="M27 22 C 27 16, 22 13, 19 16 C 17 19, 22 22, 27 22 Z" fill="#1A936F" />
      <Path d="M27 22 C 27 17, 32 15, 34 18 C 35 20, 31 23, 27 22 Z" fill="#2BA77F" />
      <Path d="M27 25 L 27 20" stroke="#0F5132" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="27" cy="44" r="19" fill="#E4F1EA" stroke="#1A936F" strokeWidth="2.5" />
      <Circle cx="27" cy="44" r="14.5" stroke="#1A936F" strokeWidth="1.3" strokeOpacity="0.3" />
      <Circle cx="18.5" cy="46" r="3" fill="#F4B8A8" fillOpacity="0.75" />
      <Circle cx="35.5" cy="46" r="3" fill="#F4B8A8" fillOpacity="0.75" />
      <Circle cx="21.5" cy="41" r="2.5" fill="#0F5132" />
      <Circle cx="32.5" cy="41" r="2.5" fill="#0F5132" />
      <Path d="M20.5 46 Q27 53 33.5 46" stroke="#0F5132" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <Path d="M2 55 H62 V62 a2 2 0 0 1 -2 2 H4 a2 2 0 0 1 -2 -2 Z" fill="#0F5132" />
      <Rect x="2" y="53" width="60" height="3" rx="1.5" fill="#1A936F" />
    </Svg>
  )
}

// ─── HomeScreen ────────────────────────────────────────────────────────────────

function formatTimeLabel(time: string): string {
  const [hoursRaw, minutesRaw] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(Number.isFinite(hoursRaw) ? hoursRaw : 0)
  date.setMinutes(Number.isFinite(minutesRaw) ? minutesRaw : 0)
  date.setSeconds(0, 0)
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
}

export function HomeScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const queryClient = useQueryClient()
  const month = toYearMonth(new Date())
  const homeQuery = useQuery({
    queryKey: queryKeys.home,
    queryFn: getHomeData,
  })

  // Sheets
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)

  const allTxs = homeQuery.data?.transactions ?? []
  const accounts = homeQuery.data?.accounts ?? []
  const settings = homeQuery.data?.settings ?? null
  const catColors = homeQuery.data?.categoryColors ?? {}

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

  // ─── Derived state ──────────────────────────────────────────────────────────
  const monthTxs = getMonthTransactions(allTxs, month)
  const { income, expense, balance } = calcSummary(monthTxs)
  const expectedIncome = settings?.expected_monthly_income ?? 0
  const hasIncomeTarget = expectedIncome > 0
  const displayBalance = hasIncomeTarget ? expectedIncome - expense : balance
  const displayBalanceColor = displayBalance >= 0 ? C.pos : C.neg
  const incomeSpentPct = hasIncomeTarget
    ? Math.min(100, Math.round((expense / expectedIncome) * 100))
    : 0
  const incomeBarColor = incomeSpentPct >= 100 ? C.neg : incomeSpentPct >= 80 ? C.gold : C.brand
  const buddyMood: BuddyMood = hasIncomeTarget
    ? incomeSpentPct >= 100 ? 'stressed'
      : incomeSpentPct >= 80 ? 'worried'
      : incomeSpentPct >= 60 ? 'neutral'
      : 'happy'
    : displayBalance >= 0 ? 'happy' : 'stressed'
  const pendingCount = allTxs.filter((t) => !t.reviewed).length
  const firstName = settings?.display_name?.split(' ')[0] ?? null
  const greetingDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const recentCategories = [...new Set(
    [...allTxs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => t.category)
      .filter((c): c is string => !!c)
  )].slice(0, 3)
  const accountMap = Object.fromEntries(accounts.map((account) => [account.id, account.name]))
  const recentTxs = [...allTxs]
    .sort((left, right) => {
      const dateCmp = right.date.localeCompare(left.date)
      if (dateCmp !== 0) return dateCmp
      return (right.time ?? '').localeCompare(left.time ?? '')
    })
    .slice(0, 3)

  const absFmt = formatAmount(Math.abs(displayBalance))
  const balSign = displayBalance < 0 ? '−' : ''
  const dotIdx = absFmt.lastIndexOf('.')
  const balInt = dotIdx === -1 ? absFmt : absFmt.slice(0, dotIdx)
  const balDec = dotIdx === -1 ? '' : absFmt.slice(dotIdx)
  const quickActions = [
    {
      key: 'add-transaction',
      label: 'Add Transaction',
      icon: 'plus',
      onPress: () => { setEditTx(null); setAddSheetOpen(true) },
    },
    {
      key: 'import-statement',
      label: 'Import Statement',
      icon: 'import',
      onPress: () => Alert.alert('Import Statement', 'Statement import is not available on mobile yet.'),
    },
    {
      key: 'add-account',
      label: 'Add\nAccount',
      icon: 'account',
      onPress: () => navigation.dispatch(CommonActions.navigate({
        name: 'Main',
        params: { screen: 'Accounts' },
      })),
    },
    ...(pendingCount > 0 ? [{
      key: 'review',
      label: `Review (${pendingCount})\nTransactions`,
      icon: 'review',
      onPress: () => navigation.navigate('Review'),
    }] : []),
  ]

  if (homeQuery.isLoading) {
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
      >
        {/* ── Greeting header ── */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <BuddyWelcomeSVG size={48} />
          <View style={s.headerText}>
            <Text style={s.greetName}>{firstName ?? 'Welcome!'}</Text>
            <Text style={s.greetDate}>{greetingDate}</Text>
          </View>
        </View>

        {/* ── Balance card ── */}
        <View style={s.cardPad}>
          <View style={s.card}>
            <View style={s.balTopRow}>
              <View style={s.balTopLeft}>
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
                        left of {formatAmount(expectedIncome)}
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
                    <View style={[s.statusPill, { backgroundColor: incomeSpentPct < 100 ? `${C.pos}18` : `${C.neg}18` }]}>
                      <Text style={[s.statusPillText, { color: incomeSpentPct < 100 ? C.pos : C.neg }]}>
                        {incomeSpentPct < 100 ? '🤩  You\'re on track! Keep going' : '⚠️ You\'ve gone over — slow down'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              <BuddySVG size={120} mood={buddyMood} />
            </View>
            <View style={s.statsRow}>
              {[
                { label: 'INCOME', value: income, color: C.pos, icon: 'income' },
                { label: 'SPENT', value: expense, color: C.neg, icon: 'spent' },
              ].map(({ label, value, color, icon }, i) => (
                <View key={label} style={[s.statCol, i > 0 && s.statColBorder]}>
                  <View style={[s.statIcon, { backgroundColor: `${color}18` }]}>
                    {icon === 'income' ? (
                      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M12 19V5" />
                        <Polyline points="5 12 12 5 19 12" />
                      </Svg>
                    ) : (
                      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M12 5v14" />
                        <Polyline points="19 12 12 19 5 12" />
                      </Svg>
                    )}
                  </View>
                  <View style={s.statInfo}>
                    <Text style={s.statLabel}>{label}</Text>
                    <Text style={[s.statValue, { color }]} numberOfLines={1}>
                      {formatAmount(value)}
                    </Text>
                  </View>
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

        {/* ── Quick actions ── */}
        <View style={s.quickActionsWrap}>
          <Text style={s.quickActionsTitle}>Quick Actions</Text>
          <View style={s.quickActionsRow}>
            {quickActions.map((action) => (
              <Pressable
                key={action.key}
                style={s.quickAction}
                onPress={action.onPress}
              >
                <View style={s.quickActionIcon}>
                  {action.icon === 'plus' ? (
                    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.5" strokeLinecap="round">
                      <Line x1="12" y1="5" x2="12" y2="19" />
                      <Line x1="5" y1="12" x2="19" y2="12" />
                    </Svg>
                  ) : action.icon === 'import' ? (
                    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M12 3v12" />
                      <Path d="M7 10l5 5 5-5" />
                      <Path d="M5 21h14" />
                    </Svg>
                  ) : action.icon === 'account' ? (
                    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M3 21h18" />
                      <Path d="M5 21V10" />
                      <Path d="M19 21V10" />
                      <Path d="M9 21V10" />
                      <Path d="M15 21V10" />
                      <Path d="M3 10h18" />
                      <Path d="M12 3 3 8h18z" />
                    </Svg>
                  ) : (
                    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M9 11l2 2 4-5" />
                      <Path d="M21 12a9 9 0 1 1-3-6.7" />
                    </Svg>
                  )}
                </View>
                <Text style={s.quickActionText} numberOfLines={2}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Recent transactions ── */}
        {recentTxs.length > 0 && (
          <View style={s.recentWrap}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent Transactions</Text>
              <Pressable onPress={() => navigation.dispatch(CommonActions.navigate({
                name: 'Main',
                params: { screen: 'Transactions' },
              }))}>
                <Text style={s.sectionCta}>View All</Text>
              </Pressable>
            </View>
            <View style={s.recentList}>
              {recentTxs.map((tx, idx) => {
                const amountColor = tx.type === 'credit' ? C.pos : tx.type === 'transfer' ? C.transfer : C.neg
                const amountPrefix = tx.type === 'credit' ? '+' : tx.type === 'transfer' ? '⇄' : '−'
                const accountName = tx.account_id ? accountMap[tx.account_id] : null
                const detail = [tx.category, accountName].filter(Boolean).join(' · ')
                const dateLabel = new Date(`${tx.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                const timeLabel = tx.time ? formatTimeLabel(tx.time) : null

                return (
                  <View key={tx.id} style={[s.recentRow, idx < recentTxs.length - 1 && s.recentRowBorder]}>
                    <View style={s.recentInfo}>
                      <Text style={s.recentName} numberOfLines={1}>{tx.merchant || tx.description || 'Transaction'}</Text>
                      <Text style={s.recentSub} numberOfLines={1}>{detail || 'Uncategorized'}</Text>
                    </View>
                    <View style={s.recentRight}>
                      <Text style={[s.recentAmount, { color: amountColor }]} numberOfLines={1}>
                        {amountPrefix}{formatAmount(tx.amount)}
                      </Text>
                      <Text style={s.recentDate} numberOfLines={1}>
                        {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Add / Edit transaction sheet ── */}
      <AddTransactionSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onSaved={(tx) => upsertTx(tx)}
        accounts={accounts}
        catColors={catColors}
        editTx={editTx}
        recentCategories={recentCategories}
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
  balTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  balTopLeft: { flex: 1, minWidth: 0, paddingRight: 8 },
  balLabel: {
    fontSize: 11,
    fontFamily: F.bold,
    color: C.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
  },
  balRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  balInt: { fontSize: 34, fontFamily: F.monoBold, letterSpacing: -0.68 },
  balDec: { fontSize: 20, fontFamily: F.mono, marginLeft: 1 },
  progressWrap: { marginTop: 8, paddingLeft: 6 },
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
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusPillText: { fontSize: 11.5, fontFamily: F.semibold },
  statsRow: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  statCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statColBorder: { paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: C.line },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: { flex: 1, minWidth: 0, gap: 2 },
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

  quickActionsWrap: { paddingTop: 14, paddingHorizontal: 16 },
  quickActionsTitle: {
    marginBottom: 10,
    fontSize: 16,
    fontFamily: F.extrabold,
    color: C.ink,
  },
  quickActionsRow: { flexDirection: 'row', gap: 16 },
  quickAction: {
    alignItems: 'center',
    gap: 7,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 10,
    borderRadius: 12,
  },
  quickActionIcon: {
    alignSelf: 'stretch',
    height: 58,
    borderRadius: 12,
    backgroundColor: C.brandPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    minHeight: 30,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: F.semibold,
    color: C.ink,
    textAlign: 'center',
  },
  recentWrap: { paddingHorizontal: 16, paddingTop: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontFamily: F.extrabold, color: C.ink },
  sectionCta: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
  recentList: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  recentInfo: { flex: 1, minWidth: 0 },
  recentName: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  recentSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, marginTop: 2 },
  recentRight: { alignItems: 'flex-end', flexShrink: 0, maxWidth: 132 },
  recentAmount: { fontSize: 14, fontFamily: F.monoBold },
  recentDate: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, marginTop: 2 },

})
