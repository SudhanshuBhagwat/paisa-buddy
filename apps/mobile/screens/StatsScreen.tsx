import React, { useEffect, useRef, useState } from 'react'
import {
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
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { upsertPlan, deletePlan } from '../repositories/planRepository'
import { getStatsData, type StatsData } from '../lib/data'
import { queryKeys } from '../lib/query'
import type { BudgetWithSpent } from '@paisa-buddy/shared/types/budget'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'
import { calcSummary } from '@paisa-buddy/shared/logic/transaction'
import { addMonths, toYearMonth } from '@paisa-buddy/shared/logic/date'
import { formatAmount } from '@paisa-buddy/shared/logic/amount'
import { budgetProgress } from '@paisa-buddy/shared/logic/budget'
import { categoryColor, CATEGORY_COLORS } from '@paisa-buddy/shared/categories'
import { C, F, RADIUS } from '../lib/tokens'
import { CategoryIcon } from '../components/CategoryIcon'
import { Sheet } from '../components/Sheet'
import { Dialog, MessageDialog, type MessageDialogState } from '../components/Dialog'
import { MonthSelectionSheet } from '../components/MonthSelectionSheet'
import { MonthCalendarSheet } from '../components/MonthCalendarSheet'
import { SwipeableRow } from '../components/SwipeableRow'
import { AnimatedAmount } from '../components/AnimatedAmount'
import { AnimatedProgressBar } from '../components/AnimatedProgressBar'
import type { MainTabParamList } from '../navigation/types'

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

type Highlight = { label: string; text: string; accent: string; icon: 'category' | 'day' | 'month' | 'merchant' | 'income' | 'review' }
type TimelineEvent = { title: string; detail: string; date: string; accent: string }

function formatHighlightDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function buildStoryHighlights({
  txs,
  expense,
  expenseCats,
  previousMonthSpend,
}: {
  txs: Transaction[]
  expense: number
  expenseCats: { category: string; total: number }[]
  previousMonthSpend: number
}): Highlight[] {
  const topCat = expenseCats[0]
  const largestTx = txs
    .filter((tx) => tx.type === 'debit')
    .sort((a, b) => b.amount - a.amount)[0]
  const highestIncome = txs
    .filter((tx) => tx.type === 'credit')
    .sort((a, b) => b.amount - a.amount)[0]
  const merchantCounts = new Map<string, number>()
  for (const tx of txs) {
    if (tx.type !== 'debit') continue
    const name = tx.user_display_name || tx.merchant || tx.parsed_display_name
    if (name) merchantCounts.set(name, (merchantCounts.get(name) ?? 0) + 1)
  }
  const topMerchant = Array.from(merchantCounts.entries()).sort((a, b) => b[1] - a[1])[0]
  const dayTotals = new Map<string, number>()
  for (const tx of txs) {
    if (tx.type !== 'debit') continue
    dayTotals.set(tx.date, (dayTotals.get(tx.date) ?? 0) + tx.amount)
  }
  const biggestDay = Array.from(dayTotals.entries()).sort((a, b) => b[1] - a[1])[0]
  const hasPrevious = previousMonthSpend > 0
  const diff = expense - previousMonthSpend
  const lower = hasPrevious && diff < 0
  const same = hasPrevious && diff === 0
  const pct = hasPrevious ? Math.round((Math.abs(diff) / previousMonthSpend) * 100) : 0

  return [
    {
      label: 'TOP MERCHANT',
      text: topMerchant
        ? `Most visited: ${topMerchant[0]} appeared ${topMerchant[1]} time${topMerchant[1] !== 1 ? 's' : ''}.`
        : 'Most visited: no repeat merchant yet.',
      accent: topMerchant ? C.brand : C.ink3,
      icon: 'merchant',
    },
    {
      label: 'LARGEST TRANSACTION',
      text: largestTx
        ? `Largest purchase: ${displayNameForStory(largestTx)} for ${formatAmount(largestTx.amount)}.`
        : 'Largest purchase: no debit transaction yet.',
      accent: largestTx ? C.neg : C.ink3,
      icon: 'day',
    },
    {
      label: 'TOP CATEGORY',
      text: topCat && expense > 0
        ? `Top category: ${topCat.category} took the biggest share.`
        : 'Top category: no spending category stood out.',
      accent: topCat ? C.brand : C.ink3,
      icon: 'category',
    },
    {
      label: 'HIGHEST INCOME',
      text: highestIncome
        ? `Highest income: ${displayNameForStory(highestIncome)} added ${formatAmount(highestIncome.amount)}.`
        : 'Highest income: no income recorded this month.',
      accent: highestIncome ? C.pos : C.ink3,
      icon: 'income',
    },
    {
      label: 'BIGGEST DAY',
      text: biggestDay
        ? `Biggest day: your spending peaked on ${formatHighlightDate(biggestDay[0])}.`
        : 'Biggest day: no debit activity this month.',
      accent: biggestDay ? C.gold : C.ink3,
      icon: 'day',
    },
    {
      label: 'LAST MONTH',
      text: !hasPrevious
        ? 'Last month: start comparing once data is available.'
        : same
          ? 'Last month: you are spending at the same pace.'
          : `Last month: you spent ${pct}% ${lower ? 'less' : 'more'}.`,
      accent: !hasPrevious || same ? C.ink3 : lower ? C.pos : C.neg,
      icon: 'month',
    },
  ]
}

function displayNameForStory(tx: Transaction): string {
  return tx.user_display_name || tx.merchant || tx.parsed_display_name || tx.description || 'Transaction'
}

function buildMonthlyStoryLines(args: {
  expense: number
  income: number
  expectedIncome: number
  previousMonthSpend: number
  expenseCats: { category: string; total: number }[]
  budgets: BudgetWithSpent[]
  txs: Transaction[]
}): string[] {
  const lines: string[] = []
  const { expense, income, expectedIncome, previousMonthSpend, expenseCats, budgets, txs } = args

  if (txs.length === 0) {
    return [
      'No transactions yet for this month.',
      'Add transactions or import a statement to build your story.',
      'Your plan will start comparing once spending appears.',
    ]
  }

  if (previousMonthSpend > 0) {
    const diff = expense - previousMonthSpend
    if (diff === 0) lines.push('You spent the same as last month.')
    else lines.push(`You spent ${formatAmount(Math.abs(diff))} ${diff < 0 ? 'less' : 'more'} than last month.`)
  } else {
    lines.push('This is the first month with enough spending to track.')
  }

  const topCat = expenseCats[0]
  if (topCat) lines.push(`${topCat.category} was your largest category.`)

  const overPlan = budgets.find((budget) => budget.spent > budget.amount)
  const withinPlan = budgets.find((budget) => budget.spent > 0 && budget.spent <= budget.amount)
  if (overPlan) lines.push(`${overPlan.category} exceeded plan by ${formatAmount(overPlan.spent - overPlan.amount)}.`)
  else if (withinPlan) lines.push(`${withinPlan.category} stayed within your plan.`)
  else lines.push('No plan category has been tested by spending yet.')

  const dayTotals = new Map<string, number>()
  for (const tx of txs) {
    if (tx.type === 'debit') dayTotals.set(tx.date, (dayTotals.get(tx.date) ?? 0) + tx.amount)
  }
  const biggestDay = Array.from(dayTotals.entries()).sort((a, b) => b[1] - a[1])[0]
  if (biggestDay) {
    const day = new Date(`${biggestDay[0]}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })
    lines.push(`${day} was your most expensive day.`)
  }

  if (expectedIncome > 0 && income > 0) {
    const saved = income - expense
    lines.push(saved >= 0
      ? `You saved ${Math.round((saved / expectedIncome) * 100)}% of expected income.`
      : `Spending exceeded income by ${formatAmount(Math.abs(saved))}.`)
  }

  return lines.slice(0, 5)
}

function buildTimelineEvents(txs: Transaction[], budgets: BudgetWithSpent[]): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const salary = txs.find((tx) => tx.type === 'credit' && /salary/i.test(`${tx.description} ${tx.merchant ?? ''}`))
  const largestDebit = txs.filter((tx) => tx.type === 'debit').sort((a, b) => b.amount - a.amount)[0]
  const importTx = txs.find((tx) => tx.source === 'bank_import')
  const exceeded = budgets.find((budget) => budget.spent > budget.amount)

  if (salary) events.push({ title: 'Salary received', detail: formatAmount(salary.amount), date: salary.date, accent: C.pos })
  if (largestDebit) events.push({ title: 'Largest purchase', detail: `${displayNameForStory(largestDebit)} · ${formatAmount(largestDebit.amount)}`, date: largestDebit.date, accent: C.neg })
  if (exceeded) events.push({ title: 'Plan exceeded', detail: `${exceeded.category} crossed by ${formatAmount(exceeded.spent - exceeded.amount)}`, date: '', accent: C.gold })
  if (importTx) events.push({ title: 'Statement imported', detail: displayNameForStory(importTx), date: importTx.date, accent: C.brand })

  return events.slice(0, 4)
}

function HighlightIcon({ type, color }: { type: Highlight['icon']; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {type === 'merchant' ? (
        <><Path d="M6 2h12l3 7H3l3-7z" /><Path d="M5 9v11h14V9" /><Path d="M9 20v-6h6v6" /></>
      ) : type === 'income' ? (
        <><Path d="M12 19V5" /><Polyline points="5 12 12 5 19 12" /></>
      ) : type === 'review' ? (
        <><Path d="M9 11l2 2 4-4" /><Path d="M21 12a9 9 0 1 1-3-6.7" /></>
      ) : type === 'category' ? (
        <><Path d="M20 12v7a2 2 0 0 1-2 2h-7" /><Path d="M14 3H5a2 2 0 0 0-2 2v9" /><Path d="m7 7 10 10" /><Path d="M7 17 17 7" /></>
      ) : type === 'day' ? (
        <><Path d="M8 2v4" /><Path d="M16 2v4" /><Path d="M3 10h18" /><Path d="M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /></>
      ) : (
        <><Path d="M3 12a9 9 0 1 0 3-6.7" /><Path d="M3 4v6h6" /><Path d="M12 7v5l3 2" /></>
      )}
    </Svg>
  )
}

function StoryHighlights({ highlights }: { highlights: Highlight[] }) {
  return (
    <View>
      <View style={s.highlightsHeader}>
        <Text style={s.sectionTitle}>Highlights</Text>
      </View>
      <View style={hl.card}>
        {highlights.map((item, idx) => (
          <View key={item.label} style={[hl.row, idx > 0 && hl.rowBorder]}>
            <View style={hl.icon}>
              <HighlightIcon type={item.icon} color={item.accent} />
            </View>
            <Text style={hl.text}>{item.text}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function MonthStoryHeader({
  month,
  spent,
  saved,
  previousMonthLabel,
  onComparePress,
  skipInitialAnimation,
}: {
  month: string
  spent: number
  saved: number
  previousMonthLabel: string
  onComparePress: () => void
  skipInitialAnimation?: boolean
}) {
  return (
    <View style={s.monthStoryHeaderCard}>
      <View style={s.monthStoryHeaderTop}>
        <Text style={s.monthStoryTitle}>{month}</Text>
        <Pressable style={s.compareButton} onPress={onComparePress} accessibilityLabel={`Compare with ${previousMonthLabel}`}>
          <Text style={s.compareButtonText}>Compare With {previousMonthLabel}</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <Polyline points="6 9 12 15 18 9" />
          </Svg>
        </Pressable>
      </View>
      <View style={s.monthStoryMetricRow}>
        <View style={s.monthStoryMetric}>
          <Text style={s.monthStoryMetricLabel}>Spent</Text>
          <AnimatedAmount
            amount={spent}
            style={[s.monthStoryMetricValue, { color: C.neg }]}
            numberOfLines={1}
            skipInitialAnimation={skipInitialAnimation}
          />
        </View>
        <View style={s.monthStoryMetricDivider} />
        <View style={s.monthStoryMetric}>
          <Text style={s.monthStoryMetricLabel}>{saved >= 0 ? 'Saved' : 'Over'}</Text>
          <AnimatedAmount
            amount={Math.abs(saved)}
            style={[s.monthStoryMetricValue, { color: saved >= 0 ? C.pos : C.neg }]}
            numberOfLines={1}
            skipInitialAnimation={skipInitialAnimation}
          />
        </View>
      </View>
    </View>
  )
}

function MonthlyStory({ lines }: { lines: string[] }) {
  return (
    <View>
      <View style={s.highlightsHeader}>
        <Text style={s.sectionTitle}>Monthly Story</Text>
      </View>
      <View style={s.storyLinesCard}>
        {lines.map((line, idx) => (
          <View key={`${line}-${idx}`} style={[s.storyLineRow, idx > 0 && s.storyLineBorder]}>
            <View style={s.storyLineDot} />
            <Text style={s.storyLineText}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function MonthTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <View>
      <View style={s.highlightsHeader}>
        <Text style={s.sectionTitle}>Timeline</Text>
      </View>
      <View style={s.timelineCard}>
        {events.length === 0 ? (
          <View style={s.timelineEmpty}>
            <Text style={s.timelineEmptyTitle}>No major events yet</Text>
            <Text style={s.timelineEmptyText}>Salary, large purchases, imports, and plan alerts will appear here.</Text>
          </View>
        ) : events.map((event, idx) => (
          <View key={`${event.title}-${idx}`} style={[s.timelineRow, idx > 0 && s.timelineBorder]}>
            <View style={[s.timelineMarker, { backgroundColor: event.accent }]} />
            <View style={s.timelineBody}>
              <Text style={s.timelineTitle}>{event.title}</Text>
              <Text style={s.timelineDetail} numberOfLines={2}>{event.detail}</Text>
            </View>
            {event.date ? <Text style={s.timelineDate}>{formatHighlightDate(event.date)}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function getMonthProgressPct(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number)
  const now = new Date()
  const selectedStart = new Date(year, monthNumber - 1, 1)
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()

  if (selectedStart < currentStart) return 100
  if (selectedStart > currentStart) return 0
  return clamp(Math.round((now.getDate() / daysInMonth) * 100), 1, 100)
}

function getStoryHeadline({
  expectedIncome,
  expense,
  remaining,
  monthProgressPct,
}: {
  expectedIncome: number
  expense: number
  remaining: number
  monthProgressPct: number
}): string {
  if (expense === 0) return 'No spending story yet.'
  if (expectedIncome <= 0) return 'You are tracking this month.'
  const spendPct = (expense / expectedIncome) * 100
  if (remaining < 0) return 'Spending is over plan this month.'
  if (spendPct <= monthProgressPct + 15) return "You're doing well this month!"
  return 'Spending is running a little ahead.'
}

function getRemainingLine(expectedIncome: number, expense: number, remaining: number): string {
  if (expectedIncome <= 0) return `${formatAmount(expense)} spent so far`
  if (remaining >= 0) return `${formatAmount(remaining)} remaining`
  return `${formatAmount(Math.abs(remaining))} over your monthly target`
}

function getCategoryImprovementLine(
  currentCats: Record<string, number>,
  prevCats: Record<string, number>,
): string {
  const best = Object.entries(prevCats)
    .filter(([cat, prev]) => prev > 0 && (currentCats[cat] ?? 0) < prev)
    .map(([cat, prev]) => ({ category: cat, pct: Math.round(((prev - (currentCats[cat] ?? 0)) / prev) * 100) }))
    .sort((a, b) => b.pct - a.pct)[0]
  if (!best) return ''
  return `${best.category} down ${best.pct}% vs last month`
}

function getReviewLine(txs: Transaction[]): string {
  if (txs.length === 0) return 'No transactions to review yet'
  const reviewed = txs.filter((tx) => tx.reviewed).length
  if (reviewed === txs.length) return 'All transactions reviewed this month'
  return `${reviewed} of ${txs.length} transactions reviewed`
}

function SummaryMascot({ size = 112, mood = 'happy' }: { size?: number; mood?: 'happy' | 'neutral' | 'sad' }) {
  if (mood === 'sad') return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M31 15 C 29 9, 23 8, 22 11 C 21.5 13, 26 15, 31 15 Z" fill="#8FAA9B" />
      <Path d="M31 17 L 31 13" stroke="#6B8A78" strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="32" cy="36" r="22" fill="#F5EDEA" stroke="#C4907E" strokeWidth="2.5" />
      <Circle cx="32" cy="36" r="17" stroke="#C4907E" strokeWidth="1.5" strokeOpacity="0.2" />
      <Circle cx="22" cy="41" r="3" fill="#E09A8A" fillOpacity="0.5" />
      <Circle cx="42" cy="41" r="3" fill="#E09A8A" fillOpacity="0.5" />
      <Circle cx="25.5" cy="35" r="2.3" fill="#6B4D42" />
      <Circle cx="38.5" cy="35" r="2.3" fill="#6B4D42" />
      <Path d="M23 31 Q25.5 29.5 28 31" stroke="#6B4D42" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <Path d="M36 31 Q38.5 29.5 41 31" stroke="#6B4D42" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <Path d="M26 44 Q32 39 38 44" stroke="#6B4D42" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </Svg>
  )
  if (mood === 'neutral') return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M32 14 C 32 8, 27 5, 24 7.5 C 22.5 9.5, 27 13, 32 14 Z" fill="#6BAA8F" />
      <Path d="M32 14 C 32 9, 36 7, 38 9 C 39 11, 36 14, 32 14 Z" fill="#8BC4A8" />
      <Path d="M32 17 L 32 12" stroke="#3D7A5E" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="32" cy="36" r="22" fill="#ECF0ED" stroke="#7EA88F" strokeWidth="2.5" />
      <Circle cx="32" cy="36" r="17" stroke="#7EA88F" strokeWidth="1.5" strokeOpacity="0.25" />
      <Circle cx="25.5" cy="34" r="2.4" fill="#3D5A48" />
      <Circle cx="38.5" cy="34" r="2.4" fill="#3D5A48" />
      <Path d="M27 42 L37 42" stroke="#3D5A48" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </Svg>
  )
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M32 13 C 32 6, 26 3, 23 6 C 21 9, 26 13, 32 13 Z" fill="#1A936F" />
      <Path d="M32 13 C 32 7, 38 5, 40 8 C 41 11, 37 14, 32 13 Z" fill="#2BA77F" />
      <Path d="M32 16 L 32 11" stroke="#0F5132" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="32" cy="36" r="22" fill="#E4F1EA" stroke="#1A936F" strokeWidth="2.5" />
      <Circle cx="32" cy="36" r="17" stroke="#1A936F" strokeWidth="1.5" strokeOpacity="0.3" />
      <Circle cx="22" cy="40" r="3.2" fill="#F4B8A8" fillOpacity="0.7" />
      <Circle cx="42" cy="40" r="3.2" fill="#F4B8A8" fillOpacity="0.7" />
      <Circle cx="25.5" cy="34" r="2.6" fill="#0F5132" />
      <Circle cx="38.5" cy="34" r="2.6" fill="#0F5132" />
      <Path d="M25 41 Q32 47 39 41" stroke="#0F5132" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </Svg>
  )
}

const hl = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text: { flex: 1, fontSize: 13.5, fontFamily: F.semibold, lineHeight: 19, color: C.ink },
})

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
  onDelete,
  isLast,
  skipInitialAnimation,
}: {
  budget: BudgetWithSpent
  onEdit: () => void
  onDelete: () => void
  isLast: boolean
  skipInitialAnimation?: boolean
}) {
  const pct = budgetProgress(budget.spent, budget.amount)
  const pctLabel = `${Math.round((budget.spent / Math.max(1, budget.amount)) * 100)}%`
  const overBudget = budget.spent > budget.amount
  const barColor = overBudget ? C.neg : C.brand
  const statusLabel = overBudget ? 'Over Budget' : 'On Track'

  return (
    <SwipeableRow actionLabel="Delete" onAction={onDelete}>
      <Pressable style={[bb.row, !isLast && bb.rowBorder]} onPress={onEdit}>
        <View style={bb.header}>
          <CategoryIcon category={budget.category} size={18} circleSize={32} />
          <View style={bb.headerMain}>
            <View style={bb.headerRow}>
              <View style={bb.titleButton}>
                <Text style={bb.catName} numberOfLines={1}>{budget.category}</Text>
              </View>
              <Text style={bb.amounts} numberOfLines={1}>{formatAmount(budget.spent)} of {formatAmount(budget.amount)}</Text>
            </View>
            <View style={bb.progressRow}>
              <AnimatedProgressBar
                progress={pct}
                trackStyle={bb.track}
                fillStyle={[bb.fill, { backgroundColor: barColor }]}
                skipInitialAnimation={skipInitialAnimation}
              />
              <Text style={[bb.pctText, { color: barColor }]}>{pctLabel}</Text>
            </View>
          </View>
          <View style={bb.statusCol}>
            <View style={[bb.statusPill, { backgroundColor: overBudget ? '#FEE2E2' : C.brandPale }]}>
              <Text style={[bb.statusText, { color: barColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>{statusLabel}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </SwipeableRow>
  )
}

function PlanSummary({ budgets, skipInitialAnimation }: { budgets: BudgetWithSpent[]; skipInitialAnimation?: boolean }) {
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
          <AnimatedAmount amount={totalBudget} style={ps.amount} numberOfLines={1} skipInitialAnimation={skipInitialAnimation} />
          <Text style={ps.label}>monthly budget</Text>
          </View>
          <View style={ps.right}>
          <Text style={[ps.percent, { color: accent }]}>{pctUsed}%</Text>
          <Text style={ps.label}>of budget used</Text>
          </View>
        </View>
      </View>
      <AnimatedProgressBar
        progress={fillPct}
        trackStyle={ps.track}
        fillStyle={[ps.fill, { backgroundColor: accent }]}
        skipInitialAnimation={skipInitialAnimation}
      />
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
  headerMain: { flex: 1, gap: 6 },
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
  statusText: { fontSize: 10.5, fontFamily: F.bold, flexShrink: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  pctText: { fontSize: 12, fontFamily: F.monoBold, flexShrink: 0 },
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
          <Text style={[ts.label, active === t.id && ts.labelActive]} numberOfLines={1}>{t.label}</Text>
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

function SpendingSummary({ spent, previousSpent, skipInitialAnimation }: {
  spent: number
  previousSpent: number
  skipInitialAnimation?: boolean
}) {
  const hasPrevious = previousSpent > 0
  const diff = spent - previousSpent
  const lower = hasPrevious && diff < 0
  const same = hasPrevious && diff === 0
  const pct = hasPrevious ? Math.round((Math.abs(diff) / previousSpent) * 100) : 0
  const accent = !hasPrevious || same ? C.ink3 : lower ? C.pos : C.neg
  const pillLabel = !hasPrevious
    ? 'No last month'
    : same
      ? 'No change'
      : `${pct}% ${lower ? 'lower' : 'above'}`

  return (
    <View style={ss.card}>
      <View style={ss.left}>
        <Text style={ss.kicker}>Total Spent</Text>
        <AnimatedAmount amount={spent} style={ss.amount} numberOfLines={1} skipInitialAnimation={skipInitialAnimation} />
        <Text style={ss.caption}>This Month</Text>
      </View>
      <View style={[ss.pill, { backgroundColor: lower ? C.brandPale : same || !hasPrevious ? C.bg : '#FEE2E2' }]}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {lower ? (
            <><Path d="M12 5v14" /><Path d="m19 12-7 7-7-7" /></>
          ) : hasPrevious && !same ? (
            <><Path d="M12 19V5" /><Path d="m5 12 7-7 7 7" /></>
          ) : same ? (
            <Path d="M5 12h14" />
          ) : (
            <Circle cx="12" cy="12" r="9" />
          )}
        </Svg>
        <View style={ss.pillText}>
          <Text style={[ss.pillValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>{pillLabel}</Text>
          <Text style={ss.pillCaption}>than last month</Text>
        </View>
      </View>
    </View>
  )
}

const ss = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    shadowColor: '#14281E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  left: { flex: 1, minWidth: 0, gap: 5 },
  kicker: { fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  amount: { fontSize: 20, fontFamily: F.monoBold, color: C.ink },
  caption: { fontSize: 12, fontFamily: F.medium, color: C.ink2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, flexShrink: 0 },
  pillText: { gap: 1 },
  pillValue: { fontSize: 13, fontFamily: F.bold, flexShrink: 1 },
  pillCaption: { fontSize: 10, fontFamily: F.medium, color: C.ink3 },
})

function BudgetSheet({
  visible, onClose, editing, allCategories, onSaved, onDelete,
}: {
  visible: boolean
  onClose: () => void
  editing: BudgetWithSpent | null
  allCategories: string[]
  onSaved: (b: BudgetWithSpent) => void
  onDelete: (b: BudgetWithSpent) => Promise<void>
}) {
  const [category, setCategory] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const [budgetToDelete, setBudgetToDelete] = useState<BudgetWithSpent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)

  React.useEffect(() => {
    if (visible) {
      setCategory(editing?.category ?? '')
      setAmountStr(editing ? String(editing.amount / 100) : '')
      setCatPickerOpen(false)
      setBudgetToDelete(null)
      setDeleting(false)
    }
  }, [visible, editing])

  async function handleConfirmDelete() {
    if (!budgetToDelete) return
    setDeleting(true)
    try {
      await onDelete(budgetToDelete)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not delete budget.' })
    } finally {
      setDeleting(false)
      setBudgetToDelete(null)
    }
  }

  async function handleSave() {
    const amount = Math.round(parseFloat(amountStr) * 100)
    if (!category || isNaN(amount) || amount <= 0) return
    setSaving(true)
    try {
      const saved = await upsertPlan(category, amount)
      onSaved({ ...saved, spent: editing?.spent ?? 0 })
      onClose()
    } catch (e) {
      setMessageDialog({ title: 'Error', message: 'Could not save budget.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        heightFraction={0.72}
        title={editing ? 'Edit Budget' : 'Add Budget'}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={bs.content} keyboardShouldPersistTaps="handled">
          <View style={bs.field}>
            <Text style={bs.label}>CATEGORY</Text>
            <Pressable style={bs.selectField} onPress={() => setCatPickerOpen(true)}>
              <View style={bs.selectInner}>
                {!!category && (
                  <CategoryIcon category={category} size={13} circleSize={24} />
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
          {editing ? (
            <Pressable
              style={bs.delete}
              onPress={() => setBudgetToDelete(editing)}
            >
              <Text style={bs.deleteText}>Delete Budget</Text>
            </Pressable>
          ) : null}
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
                  <CategoryIcon category={cat} size={18} circleSize={32} />
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

        <Dialog
          visible={!!budgetToDelete}
          onClose={() => { if (!deleting) setBudgetToDelete(null) }}
          title="Delete budget?"
          message="This cannot be undone."
          actions={[
            { label: 'Cancel', variant: 'secondary', onPress: () => setBudgetToDelete(null), disabled: deleting },
            { label: 'Delete', variant: 'destructive', onPress: handleConfirmDelete, loading: deleting },
          ]}
        />
        <MessageDialog
          dialog={messageDialog}
          onClose={() => setMessageDialog(null)}
        />
      </Sheet>
      </>
  )
}

const bs = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
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
  delete: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(219,90,75,0.35)' },
  deleteText: { fontSize: 14, fontFamily: F.semibold, color: C.neg },
})

function SkeletonBlock({ style }: { style?: object }) {
  return <View style={[sk.block, style]} />
}

function StatsSkeleton({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <View style={s.body}>
      <TabSwitcher active={activeTab} onChange={onTabChange} />

      {activeTab === 'story' ? (
        <View style={s.storyStack}>
          <View style={s.summaryCard}>
            {[0, 1, 2].map((idx) => (
              <View key={idx} style={[s.summaryCol, idx > 0 && s.summaryColBorder]}>
                <SkeletonBlock style={sk.summaryLabel} />
                <SkeletonBlock style={sk.summaryValue} />
              </View>
            ))}
          </View>
          <View>
            <View style={s.highlightsHeader}>
              <SkeletonBlock style={sk.sectionTitle} />
            </View>
            <View style={hl.card}>
              {[0, 1, 2].map((idx) => (
                <View key={idx} style={[hl.row, idx > 0 && hl.rowBorder]}>
                  <SkeletonBlock style={sk.highlightIcon} />
                  <SkeletonBlock style={[sk.highlightText, { width: idx === 0 ? 210 : idx === 1 ? 226 : 196 }]} />
                </View>
              ))}
            </View>
          </View>
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
        <>
          <View style={ss.card}>
            <View style={ss.left}>
              <SkeletonBlock style={sk.spendingKicker} />
              <SkeletonBlock style={sk.spendingAmount} />
              <SkeletonBlock style={sk.spendingCaption} />
            </View>
            <SkeletonBlock style={sk.spendingPill} />
          </View>
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
        </>
      )}
    </View>
  )
}

const sk = StyleSheet.create({
  block: { backgroundColor: C.line, opacity: 0.75, borderRadius: 6 },
  summaryLabel: { width: 48, height: 9 },
  summaryValue: { width: 72, height: 14 },
  highlightIcon: { width: 30, height: 30, borderRadius: 15 },
  highlightText: { height: 14 },
  sectionTitle: { width: 76, height: 18 },
  addButton: { width: 62, height: 34, borderRadius: 12 },
  budgetName: { flex: 1, height: 15 },
  budgetAmount: { width: 96, height: 12 },
  budgetTrack: { height: 6, borderRadius: 3 },
  spendingKicker: { width: 82, height: 10 },
  spendingAmount: { width: 118, height: 20 },
  spendingCaption: { width: 78, height: 12 },
  spendingPill: { width: 122, height: 42, borderRadius: 999 },
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
  const route = useRoute<RouteProp<MainTabParamList, 'Month'>>()
  const queryClient = useQueryClient()
  const handledInitialAction = useRef<number | 'initial' | null>(null)
  const storyTabSeenRef = useRef(false)
  const planTabSeenRef = useRef(false)
  const spendingTabSeenRef = useRef(false)
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
  useEffect(() => {
    if (activeTab === 'story') storyTabSeenRef.current = true
    if (activeTab === 'plan') planTabSeenRef.current = true
    if (activeTab === 'spending') spendingTabSeenRef.current = true
  }, [activeTab])
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false)
  const [monthSheetOpen, setMonthSheetOpen] = useState(false)
  const [calendarSheetOpen, setCalendarSheetOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetWithSpent | null>(null)
  const [deleteConfirmBudget, setDeleteConfirmBudget] = useState<BudgetWithSpent | null>(null)
  const [deletingSwipeBudget, setDeletingSwipeBudget] = useState(false)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)

  const data = statsQuery.data ?? null

  function monthHeaderLabel(): string {
    const [year, monthNumber] = month.split('-').map(Number)
    const label = new Date(year, monthNumber - 1, 1).toLocaleString('en-US', { month: 'long' })
    return `${label} ${year}`
  }

  function monthShortLabel(value: string): string {
    const [year, monthNumber] = value.split('-').map(Number)
    return new Date(year, monthNumber - 1, 1).toLocaleString('en-US', { month: 'short' })
  }

  const txs = data?.transactions ?? []
  const budgets = data?.budgets ?? []
  const colorMap = data?.categoryColors ?? {}
  const { income, expense } = calcSummary(txs)
  const expectedIncome = data?.settings.expected_monthly_income ?? 0
  const remaining = expectedIncome - expense
  const savedAmount = income > 0 ? income - expense : remaining
  const monthlySpends = Object.fromEntries((data?.monthlySpends ?? []).map((item) => [item.month, item.spent]))
  monthlySpends[month] = monthlySpends[month] ?? expense
  const previousMonthSpend = monthlySpends[addMonths(month, -1)] ?? 0
  const transactionCounts = txs.reduce<Record<string, number>>((counts, tx) => {
    counts[tx.date] = (counts[tx.date] ?? 0) + 1
    return counts
  }, {})
  const expenseCats = topSpendingCategories(groupByCategory(txs, 'debit'))
  const storyHighlights = buildStoryHighlights({ txs, expense, expenseCats, previousMonthSpend })
  const storyLines = buildMonthlyStoryLines({ expense, income, expectedIncome, previousMonthSpend, expenseCats, budgets, txs })
  const timelineEvents = buildTimelineEvents(txs, budgets)
  const allCategories = [...new Set([...Object.keys(CATEGORY_COLORS), ...Object.keys(colorMap)])]
  const monthProgressPct = getMonthProgressPct(month)
  const storyHeadline = getStoryHeadline({ expectedIncome, expense, remaining, monthProgressPct })
  const storyRemainingLine = getRemainingLine(expectedIncome, expense, remaining)
  const mascotMood: 'happy' | 'neutral' | 'sad' =
    remaining < 0 ? 'sad'
    : (expectedIncome > 0 && remaining / expectedIncome < 0.1) ? 'neutral'
    : 'happy'
  const reviewLine = getReviewLine(txs)
  const allReviewed = txs.length > 0 && txs.every((tx) => tx.reviewed)
  const currentCatMap = Object.fromEntries(groupByCategory(txs, 'debit').map((c) => [c.category, c.total]))
  const prevCatMap = Object.fromEntries((data?.previousMonthCategorySpends ?? []).map((c) => [c.category, c.total]))
  const categoryImprovementLine = getCategoryImprovementLine(currentCatMap, prevCatMap)
  const summaryStrip = [
    { label: 'INCOME', value: income, color: C.pos },
    { label: 'SPENT', value: expense, color: C.neg },
    { label: 'REMAINING', value: remaining, color: remaining >= 0 ? C.pos : C.neg },
  ]

  function openAdd() { setEditingBudget(null); setBudgetSheetOpen(true) }
  function openEdit(b: BudgetWithSpent) { setEditingBudget(b); setBudgetSheetOpen(true) }

  useEffect(() => {
    if (route.params?.initialAction !== 'budget') return
    if (!data) return
    const actionKey = route.params.actionId ?? 'initial'
    if (handledInitialAction.current === actionKey) return
    handledInitialAction.current = actionKey
    setActiveTab('plan')
    if (budgets.length === 0) {
      openAdd()
    }
  }, [budgets.length, data, route.params?.actionId, route.params?.initialAction])

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

  async function handleDeleteBudget(budget: BudgetWithSpent) {
    await deletePlan(budget.id)
    queryClient.setQueryData<StatsData>(queryKeys.stats(month), (prev) => (
      prev ? { ...prev, budgets: prev.budgets.filter((b) => b.id !== budget.id) } : prev
    ))
    queryClient.invalidateQueries({ queryKey: queryKeys.stats() })
    setBudgetSheetOpen(false)
    setEditingBudget(null)
  }

  async function handleConfirmSwipeBudgetDelete() {
    if (!deleteConfirmBudget) return
    setDeletingSwipeBudget(true)
    try {
      await handleDeleteBudget(deleteConfirmBudget)
      setDeleteConfirmBudget(null)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not delete budget.' })
    } finally {
      setDeletingSwipeBudget(false)
    }
  }

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
              <View style={s.storyStack}>
                <MonthStoryHeader
                  month={monthHeaderLabel()}
                  spent={expense}
                  saved={savedAmount}
                  previousMonthLabel={monthShortLabel(addMonths(month, -1))}
                  onComparePress={() => setMonthSheetOpen(true)}
                  skipInitialAnimation={storyTabSeenRef.current}
                />
                <View style={s.storySummaryCardWrap}>
                <View style={s.storySummaryCard}>
                  <View style={s.mascotWrap}>
                    <SummaryMascot mood={mascotMood} size={160} />
                  </View>
                  <View style={s.storySummaryTop}>
                    <View style={s.storySummaryCopy}>
                      <Text style={s.storyHeadline}>{storyHeadline}</Text>
                      <Text style={s.storyRemaining}>
                        {storyRemainingLine}
                      </Text>
                      {categoryImprovementLine ? (
                        <Text style={s.storyCategoryImprovement}>{categoryImprovementLine}</Text>
                      ) : null}
                      <View style={s.reviewPill}>
                        <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                          {allReviewed ? (
                            <Path d="M2 6 L4.5 8.5 L10 3" stroke={C.brandDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <>
                              <Path d="M6 2.5 L6 6.5" stroke={C.brandDeep} strokeWidth="1.8" strokeLinecap="round" />
                              <Circle cx="6" cy="9.5" r="1" fill={C.brandDeep} />
                            </>
                          )}
                        </Svg>
                        <Text style={s.reviewPillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>{reviewLine}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.monthProgressGroup}>
                    <View style={s.monthProgressHeader}>
                      <Text style={s.monthProgressLabel}>{monthHeaderLabel()}</Text>
                      <Text style={s.monthProgressValue}>{monthProgressPct}% completed</Text>
                    </View>
                    <AnimatedProgressBar
                      progress={monthProgressPct}
                      trackStyle={s.monthProgressTrack}
                      fillStyle={s.monthProgressFill}
                      skipInitialAnimation={storyTabSeenRef.current}
                    />
                  </View>
                </View>
                </View>
                <View style={s.summaryCard}>
                  {summaryStrip.map(({ label, value, color }, idx) => (
                    <View key={label} style={[s.summaryCol, idx > 0 && s.summaryColBorder]}>
                      <Text style={s.summaryLabel}>{label}</Text>
                      <AnimatedAmount
                        amount={value}
                        style={[s.summaryValue, { color }]}
                        numberOfLines={1}
                        skipInitialAnimation={storyTabSeenRef.current}
                      />
                    </View>
                  ))}
                </View>
                <MonthlyStory lines={storyLines} />
                <StoryHighlights highlights={storyHighlights} />
                <MonthTimeline events={timelineEvents} />
              </View>
            ) : activeTab === 'plan' ? (
              <>
                <PlanSummary budgets={budgets} skipInitialAnimation={planTabSeenRef.current} />
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
                        onDelete={() => setDeleteConfirmBudget(b)}
                        isLast={idx === budgets.length - 1}
                        skipInitialAnimation={planTabSeenRef.current}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={s.spendingStack}>
                <SpendingSummary spent={expense} previousSpent={previousMonthSpend} skipInitialAnimation={spendingTabSeenRef.current} />
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
                <SpendingTrend month={month} monthlySpends={monthlySpends} />
              </View>
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
        onDelete={handleDeleteBudget}
      />
      <Dialog
        visible={!!deleteConfirmBudget}
        onClose={() => { if (!deletingSwipeBudget) setDeleteConfirmBudget(null) }}
        title="Delete budget?"
        message="This cannot be undone."
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setDeleteConfirmBudget(null), disabled: deletingSwipeBudget },
          { label: 'Delete', variant: 'destructive', onPress: handleConfirmSwipeBudgetDelete, loading: deletingSwipeBudget },
        ]}
      />
      <MessageDialog
        dialog={messageDialog}
        onClose={() => setMessageDialog(null)}
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
  storyStack: { gap: 16 },
  spendingStack: { gap: 8 },
  monthStoryHeaderCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    gap: 14,
    shadowColor: '#14281E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  monthStoryHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  monthStoryTitle: { flex: 1, fontSize: 21, fontFamily: F.extrabold, color: C.ink },
  compareButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  compareButtonText: { fontSize: 12.5, fontFamily: F.bold, color: C.brand },
  monthStoryMetricRow: { flexDirection: 'row', alignItems: 'stretch' },
  monthStoryMetric: { flex: 1, gap: 4 },
  monthStoryMetricDivider: { width: 1, backgroundColor: C.line, marginHorizontal: 14 },
  monthStoryMetricLabel: { fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  monthStoryMetricValue: { fontSize: 19, fontFamily: F.monoBold },
  storySummaryCardWrap: {
    borderRadius: RADIUS,
    shadowColor: '#14281E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  storySummaryCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    gap: 10,
    overflow: 'hidden',
  },
  storySummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storySummaryCopy: { flex: 1, minWidth: 0, gap: 8 },
  storyHeadline: { fontSize: 17, lineHeight: 23, fontFamily: F.extrabold, color: C.ink },
  storyRemaining: { fontSize: 13.5, fontFamily: F.regular, lineHeight: 20, color: C.ink },
  storyCategoryImprovement: { fontSize: 13.5, fontFamily: F.semibold, lineHeight: 20, color: C.pos },
  reviewPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: C.brandPale,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  reviewPillText: { flexShrink: 1, fontSize: 11.5, fontFamily: F.bold, lineHeight: 16, color: C.brandDeep },
  mascotWrap: {
    position: 'absolute',
    right: -40,
    top: -8,
    width: 160,
    height: 160,
    transform: [{ rotate: '-20deg' }],
    opacity: 0.6,
  },
  monthProgressGroup: { gap: 12 },
  monthProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthProgressLabel: { fontSize: 12, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  monthProgressValue: { fontSize: 12, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  monthProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: C.bg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.line,
  },
  monthProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: C.brand,
  },
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
  highlightsHeader: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontFamily: F.extrabold, color: C.ink },
  storyLinesCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  storyLineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 15, paddingVertical: 13 },
  storyLineBorder: { borderTopWidth: 1, borderTopColor: C.line },
  storyLineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.brand, marginTop: 6 },
  storyLineText: { flex: 1, fontSize: 13.5, fontFamily: F.regular, lineHeight: 20, color: C.ink },
  timelineCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 13 },
  timelineBorder: { borderTopWidth: 1, borderTopColor: C.line },
  timelineMarker: { width: 9, height: 9, borderRadius: 5 },
  timelineBody: { flex: 1, minWidth: 0, gap: 2 },
  timelineTitle: { fontSize: 13.5, fontFamily: F.semibold, color: C.ink },
  timelineDetail: { fontSize: 12, fontFamily: F.regular, color: C.ink3, lineHeight: 17 },
  timelineDate: { fontSize: 11.5, fontFamily: F.bold, color: C.ink3 },
  timelineEmpty: { paddingHorizontal: 15, paddingVertical: 16, gap: 3 },
  timelineEmptyTitle: { fontSize: 13.5, fontFamily: F.semibold, color: C.ink },
  timelineEmptyText: { fontSize: 12, fontFamily: F.regular, color: C.ink3, lineHeight: 17 },
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
  },
  chartLabel: { marginLeft: 18, fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.6 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  emptyLink: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
})
