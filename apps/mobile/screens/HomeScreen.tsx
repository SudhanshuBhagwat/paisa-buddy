import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, {
  Circle,
  Ellipse,
  Line,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainTabParamList, RootStackParamList } from '../navigation/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'
import type { ReviewSession } from '../repositories/reviewSessionRepository'
import { formatAmount } from '@paisa-buddy/shared/logic/amount'
import { C, F, RADIUS } from '../lib/tokens'
import { getHomeData } from '../lib/data'
import { invalidateTransactionData, queryKeys } from '../lib/query'
import { AddTransactionSheet } from '../components/AddTransactionSheet'
import { AnimatedAmount } from '../components/AnimatedAmount'
import type { MonthlyTransactionTotals } from '../repositories/transactionRepository'

type HomeData = {
  transactions: Transaction[]
  monthlyTotals: MonthlyTransactionTotals
  pendingReviewCount: number
  accounts: Account[]
  settings: { display_name: string | null; expected_monthly_income: number | null }
  categoryColors: Record<string, string>
  reviewSession: ReviewSession | null
}

type QuickAction = {
  key: string
  label: string
  icon: 'plus' | 'import' | 'budget' | 'account'
  onPress: () => void
}

// ─── SVG Components ────────────────────────────────────────────────────────────

type CornerBuddyMood = 'happy' | 'neutral' | 'sad'

function CornerBuddy({ size = 172, mood = 'happy' }: { size?: number; mood?: CornerBuddyMood }) {
  if (mood === 'neutral') {
    return (
      <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
        <Path d="M100 54 C100 36, 84 29, 76 37 C70 44, 84 56, 100 56 Z" fill="#6BAA8F" />
        <Path d="M100 62 L100 50" stroke="#3D7A5E" strokeWidth="4.5" strokeLinecap="round" />
        <Circle cx="100" cy="116" r="56" fill="#ECF0ED" stroke="#7EA88F" strokeWidth="7" />
        <Circle cx="100" cy="116" r="43" stroke="#7EA88F" strokeWidth="3" strokeOpacity="0.25" />
        <Circle cx="86" cy="110" r="6" fill="#3D5A48" />
        <Circle cx="114" cy="110" r="6" fill="#3D5A48" />
        <Path d="M88 130 L112 130" stroke="#3D5A48" strokeWidth="6" strokeLinecap="round" />
        <Path d="M28 176 Q100 150 172 176 Q172 194 100 194 Q28 194 28 176 Z" fill="#3D5A48" />
        <Ellipse cx="100" cy="176" rx="72" ry="9" fill="#4E7A60" />
      </Svg>
    )
  }

  if (mood === 'sad') {
    return (
      <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
        <Path d="M98 56 C92 40, 74 38, 72 48 C71 56, 86 60, 98 56 Z" fill="#8FAA9B" />
        <Path d="M99 60 C100 54, 100 50, 100 46" stroke="#6B8A78" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <Circle cx="100" cy="116" r="56" fill="#F5EDEA" stroke="#C4907E" strokeWidth="7" />
        <Circle cx="100" cy="116" r="43" stroke="#C4907E" strokeWidth="3" strokeOpacity="0.2" />
        <Path d="M78 101 Q86 96 94 101" stroke="#6B4D42" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <Path d="M106 101 Q114 96 122 101" stroke="#6B4D42" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <Circle cx="86" cy="113" r="6" fill="#6B4D42" />
        <Circle cx="114" cy="113" r="6" fill="#6B4D42" />
        <Circle cx="75" cy="129" r="7.5" fill="#E09A8A" fillOpacity="0.5" />
        <Circle cx="125" cy="129" r="7.5" fill="#E09A8A" fillOpacity="0.5" />
        <Path d="M84 136 Q100 124 116 136" stroke="#6B4D42" strokeWidth="6.5" strokeLinecap="round" fill="none" />
        <Path d="M139 120 q4 7 0 11 q-4 -4 0 -11 z" fill="#6FB6D6" />
        <Path d="M28 176 Q100 152 172 176 Q172 194 100 194 Q28 194 28 176 Z" fill="#6B5E50" />
        <Ellipse cx="100" cy="176" rx="72" ry="9" fill="#8A7A66" />
      </Svg>
    )
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Path d="M34 54 l3.5 8 8 3.5 -8 3.5 -3.5 8 -3.5 -8 -8 -3.5 8 -3.5 z" fill="#E0A33C" />
      <Path d="M166 70 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#2BA77F" />
      <Path d="M100 50 C100 30, 82 22, 73 31 C66 39, 82 52, 100 52 Z" fill="#1A936F" />
      <Path d="M100 52 C100 32, 120 25, 128 36 C133 45, 118 56, 100 52 Z" fill="#2BA77F" />
      <Path d="M100 60 L100 46" stroke="#0F5132" strokeWidth="5" strokeLinecap="round" />
      <Circle cx="100" cy="116" r="56" fill="#E4F1EA" stroke="#1A936F" strokeWidth="7" />
      <Circle cx="100" cy="116" r="43" stroke="#1A936F" strokeWidth="3" strokeOpacity="0.3" />
      <Circle cx="76" cy="126" r="8" fill="#F4B8A8" fillOpacity="0.75" />
      <Circle cx="124" cy="126" r="8" fill="#F4B8A8" fillOpacity="0.75" />
      <Circle cx="86" cy="108" r="6.5" fill="#0F5132" />
      <Circle cx="114" cy="108" r="6.5" fill="#0F5132" />
      <Path d="M84 126 Q100 142 116 126" stroke="#0F5132" strokeWidth="6.5" strokeLinecap="round" fill="none" />
      <Path d="M28 176 Q100 150 172 176 Q172 194 100 194 Q28 194 28 176 Z" fill="#0F5132" />
      <Ellipse cx="100" cy="176" rx="72" ry="9" fill="#157F4C" />
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

function QuickActionButton({ action }: { action: QuickAction }) {
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Pressable
      style={s.quickAction}
      onPress={action.onPress}
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 15, stiffness: 300 }) }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }) }}
    >
      <Animated.View style={[s.quickActionContent, animStyle]}>
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
          ) : action.icon === 'budget' ? (
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 19V5" />
              <Path d="M4 19h16" />
              <Path d="M8 15v-4" />
              <Path d="M12 15V8" />
              <Path d="M16 15v-6" />
            </Svg>
          ) : (
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M3 21h18" />
              <Path d="M5 21V10" />
              <Path d="M19 21V10" />
              <Path d="M9 21V10" />
              <Path d="M15 21V10" />
              <Path d="M3 10h18" />
              <Path d="M12 3 3 8h18z" />
            </Svg>
          )}
        </View>
        <Text style={s.quickActionText} numberOfLines={2}>{action.label}</Text>
      </Animated.View>
    </Pressable>
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

function getDayGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function HomeScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<MainTabParamList, 'Home'>>()
  const queryClient = useQueryClient()
  const handledInitialAction = useRef(false)
  const homeQuery = useQuery({
    queryKey: queryKeys.home,
    queryFn: getHomeData,
  })

  // Sheets
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)

  useEffect(() => {
    if (handledInitialAction.current) return
    const action = route.params?.initialAction
    if (!action || action === 'dashboard') return
    handledInitialAction.current = true
    if (action === 'import') {
      navigation.navigate('ImportStatement')
      return
    }
    setEditTx(null)
    setAddSheetOpen(true)
  }, [navigation, route.params?.initialAction])

  const allTxs = homeQuery.data?.transactions ?? []
  const monthlyTotals = homeQuery.data?.monthlyTotals ?? { income: 0, expense: 0, transfer: 0, balance: 0 }
  const pendingReviewCount = homeQuery.data?.pendingReviewCount ?? 0
  const accounts = homeQuery.data?.accounts ?? []
  const settings = homeQuery.data?.settings ?? null
  const catColors = homeQuery.data?.categoryColors ?? {}
  const reviewSession = homeQuery.data?.reviewSession ?? null

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
  const { income, expense, balance } = monthlyTotals
  const expectedIncome = settings?.expected_monthly_income ?? 0
  const hasIncomeTarget = expectedIncome > 0
  const displayBalance = hasIncomeTarget ? expectedIncome - expense : balance
  const displayBalanceColor = displayBalance >= 0 ? C.pos : C.neg
  const incomeSpentPct = hasIncomeTarget
    ? Math.min(100, Math.round((expense / expectedIncome) * 100))
    : 0
  const incomeBarColor = incomeSpentPct >= 100 ? C.neg : incomeSpentPct >= 80 ? C.gold : C.brand
  const cornerBuddyMood: CornerBuddyMood = hasIncomeTarget
    ? displayBalance < 0 ? 'sad'
      : displayBalance / expectedIncome < 0.05 ? 'neutral'
      : 'happy'
    : displayBalance < 0 ? 'sad' : displayBalance === 0 ? 'neutral' : 'happy'
  const reviewRemaining = reviewSession
    ? Math.max(reviewSession.total_count - reviewSession.review_progress, pendingReviewCount)
    : pendingReviewCount
  const now = new Date()
  const firstName = settings?.display_name?.split(' ')[0] ?? null
  const dayGreeting = getDayGreeting(now)
  const greetingDate = now.toLocaleDateString('en-IN', {
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

  const quickActions: QuickAction[] = [
    {
      key: 'add-transaction',
      label: 'Add\nTransaction',
      icon: 'plus',
      onPress: () => { setEditTx(null); setAddSheetOpen(true) },
    },
    {
      key: 'import-statement',
      label: 'Import\nStatement',
      icon: 'import',
      onPress: () => navigation.navigate('ImportStatement'),
    },
    {
      key: 'add-edit-budget',
      label: 'Add/Edit\nBudget',
      icon: 'budget',
      onPress: () => navigation.dispatch(CommonActions.navigate({
        name: 'Main',
        params: {
          screen: 'Month',
          params: { initialAction: 'budget', actionId: Date.now() },
        },
      })),
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
            <Text style={s.greetName}>
              {firstName ? `${dayGreeting}, ${firstName}` : dayGreeting}
            </Text>
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
                  <AnimatedAmount
                    amount={displayBalance}
                    style={[s.balInt, { color: displayBalanceColor }]}
                    numberOfLines={1}
                  />
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
                    <View style={[s.progressTrack, s.progressStatusWidth]}>
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
            </View>
            <View pointerEvents="none" style={s.cornerBuddy}>
              <CornerBuddy size={172} mood={cornerBuddyMood} />
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
                    <AnimatedAmount
                      amount={value}
                      style={[s.statValue, { color }]}
                      numberOfLines={1}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Pending review banner ── */}
        {reviewRemaining > 0 && (
          <Pressable
            style={s.pendingBanner}
            onPress={() => navigation.navigate('Review')}
          >
            <View style={s.pendingBadge}>
              <Text style={s.pendingBadgeText}>{reviewRemaining}</Text>
            </View>
            <View style={s.pendingInfo}>
              <Text style={s.pendingTitle}>Resume Review</Text>
              <Text style={s.pendingSub}>{reviewRemaining} transactions remaining</Text>
            </View>
            <Text style={s.resumeText}>Continue</Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.neg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="9 18 15 12 9 6" />
            </Svg>
          </Pressable>
        )}

        {/* ── Quick actions ── */}
        <View style={s.quickActionsWrap}>
          <Text style={s.quickActionsTitle}>Quick Actions</Text>
          <View style={s.quickActionsRow}>
            {quickActions.map((action) => <QuickActionButton key={action.key} action={action} />)}
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
                const categoryColor = tx.category ? catColors[tx.category] : null
                const dateLabel = new Date(`${tx.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                const timeLabel = tx.time ? formatTimeLabel(tx.time) : null

                return (
                  <View key={tx.id} style={[s.recentRow, idx < recentTxs.length - 1 && s.recentRowBorder]}>
                    <View style={s.recentInfo}>
                      <Text style={s.recentName} numberOfLines={1}>{tx.merchant || tx.description || 'Transaction'}</Text>
                      <Text style={s.recentSub} numberOfLines={1}>
                        {tx.category ? (
                          <Text style={[s.recentCategory, { color: categoryColor ?? C.ink3 }]}>{tx.category}</Text>
                        ) : (
                          'Uncategorized'
                        )}
                        {accountName ? <Text>{` · ${accountName}`}</Text> : null}
                      </Text>
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
    overflow: 'hidden',
    position: 'relative',
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
    minHeight: 136,
  },
  balTopLeft: { flex: 1, minWidth: 0, maxWidth: '64%', paddingRight: 8, zIndex: 2 },
  balLabel: {
    fontSize: 11,
    fontFamily: F.bold,
    color: C.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
  },
  balRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  balInt: { fontSize: 34, fontFamily: F.monoBold, letterSpacing: -0.68 },
  progressWrap: { marginTop: 8, paddingLeft: 6 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  progressLabel: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3 },
  progressPct: { fontSize: 11.5, fontFamily: F.bold, marginRight: 12 },
  progressStatusWidth: { width: 190 },
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
  cornerBuddy: {
    position: 'absolute',
    right: -10,
    bottom: 45,
    width: 172,
    height: 172,
    zIndex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.surface,
    zIndex: 3,
  },
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
  resumeText: { fontSize: 12, fontFamily: F.bold, color: C.neg },

  quickActionsWrap: { paddingTop: 14, paddingHorizontal: 16 },
  quickActionsTitle: {
    marginBottom: 10,
    fontSize: 16,
    fontFamily: F.extrabold,
    color: C.ink,
  },
  quickActionsRow: { flexDirection: 'row', gap: 10 },
  quickAction: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 10,
    borderRadius: 12,
  },
  quickActionContent: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 7,
  },
  quickActionIcon: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 12,
    backgroundColor: C.brandPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    minHeight: 34,
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
  recentCategory: { fontFamily: F.semibold },
  recentSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, marginTop: 2 },
  recentRight: { alignItems: 'flex-end', flexShrink: 0, maxWidth: 132 },
  recentAmount: { fontSize: 14, fontFamily: F.monoBold },
  recentDate: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, marginTop: 2 },

})
