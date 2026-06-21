import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Circle, Path, Polyline } from 'react-native-svg'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sheet } from '../components/Sheet'
import { Dialog, MessageDialog, type MessageDialogState } from '../components/Dialog'
import { TypePicker } from '../components/TypePicker'
import { C, F, RADIUS } from '../lib/tokens'
import { getReviewData } from '../lib/data'
import { updateTransaction, deleteTransaction } from '../repositories/transactionRepository'
import { invalidateTransactionData, queryKeys } from '../lib/query'
import { PREDEFINED_CATEGORIES, categoryColor } from '@paisa-buddy/shared/categories'
import {
  sanitizeAmountInput,
  formatDisplayAmount,
  formatAmount,
  parseAmountToPaise,
} from '@paisa-buddy/shared/logic/amount'
import {
  txToFormState,
  formStateToPayload,
  type ReviewFormState,
} from '@paisa-buddy/shared/logic/review'
import { groupTransactionsByMonth } from '@paisa-buddy/shared/logic/transaction'
import { formatMonthLabel, formatDateLabel } from '@paisa-buddy/shared/logic/date'
import type { Transaction, TransactionType } from '@paisa-buddy/shared/types/transaction'
import type { RootStackParamList } from '../navigation'
import { groupTransactions, type TxGroup } from '../lib/grouping'
import { loadSuggestionsForGroups, saveSuggestion } from '../lib/suggestions'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Review'>
}

type Phase = 'loading' | 'empty' | 'summary' | 'group-review' | 'individual-review' | 'done'

const TYPE_COLOR: Record<TransactionType, string> = {
  credit: C.pos,
  debit: C.neg,
  transfer: C.transfer,
}
const TYPE_PREFIX: Record<TransactionType, string> = { credit: '+', debit: '−', transfer: '⇄' }
const TYPES: Array<{ value: TransactionType; label: string; color: string }> = [
  { value: 'debit', label: 'Expense', color: C.neg },
  { value: 'credit', label: 'Income', color: C.pos },
  { value: 'transfer', label: 'Transfer', color: C.transfer },
]

function ChevronDown() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="6 9 12 15 18 9" />
    </Svg>
  )
}

function CheckIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  )
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatTimeLabel(time: string): string {
  const date = timeToDate(time)
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
}

function timeToDate(time: string): Date {
  const date = new Date()
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isFinite(hours)) date.setHours(hours)
  if (Number.isFinite(minutes)) date.setMinutes(minutes)
  date.setSeconds(0, 0)
  return date
}

function ProgressBar({ reviewed, total }: { reviewed: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((reviewed / total) * 100)) : 0
  return (
    <View style={pb.wrap}>
      <View style={pb.track}>
        <View style={[pb.fill, { width: `${pct}%` as `${number}%` }]} />
      </View>
      <View style={pb.row}>
        <Text style={pb.count}>{reviewed} / {total} reviewed</Text>
        <Text style={pb.pct}>{pct}%</Text>
      </View>
    </View>
  )
}

function isReviewConfirmable(form: ReviewFormState): boolean {
  const paise = parseAmountToPaise(form.amountStr)
  if (!paise || paise <= 0) return false
  if (!form.category) return false
  if (!form.accountId) return false
  if (form.type === 'transfer' && !form.toAccountId) return false
  return true
}

const pb = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  track: { height: 5, borderRadius: 99, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99, backgroundColor: C.brand },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  count: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  pct: { fontSize: 12, fontFamily: F.semibold, color: C.brand },
})

export function ReviewScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const reviewQuery = useQuery({ queryKey: queryKeys.review, queryFn: getReviewData })

  const accounts = reviewQuery.data?.accounts ?? []
  const catColors = reviewQuery.data?.categoryColors ?? {}

  // ── Phase ─────────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('loading')
  const [groups, setGroups] = useState<TxGroup[]>([])
  const [individuals, setIndividuals] = useState<Transaction[]>([])
  const [currentGroupIdx, setCurrentGroupIdx] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null)
  const [applyingGroup, setApplyingGroup] = useState(false)
  const [groupJustDone, setGroupJustDone] = useState<{ count: number; category: string } | null>(null)
  const [completionStats, setCompletionStats] = useState({ groupCount: 0, groupTxCount: 0, individualCount: 0 })

  // ── Individual review sheet ───────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeTx, setActiveTx] = useState<Transaction | null>(null)
  const [form, setForm] = useState<ReviewFormState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pendingDate, setPendingDate] = useState(new Date())
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [pendingTime, setPendingTime] = useState(new Date())
  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [accPickerOpen, setAccPickerOpen] = useState(false)
  const [toAccPickerOpen, setToAccPickerOpen] = useState(false)

  // ── Derived ───────────────────────────────────────────────────────────────────
  const allCategories = [...new Set([...PREDEFINED_CATEGORIES, ...Object.keys(catColors)])].filter(
    (c) => c !== 'Investment',
  )
  const recentCategories = [...new Set(
    [...individuals]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => t.category)
      .filter((c): c is string => !!c),
  )].slice(0, 3)
  const recentCats = recentCategories.filter((c) => allCategories.includes(c))
  const restCats = allCategories.filter((c) => !recentCats.includes(c))
  const categorySearchKey = categorySearch.trim().toLowerCase()
  const shownRecentCats = categorySearchKey
    ? recentCats.filter((cat) => cat.toLowerCase().includes(categorySearchKey))
    : recentCats
  const shownRestCats = categorySearchKey
    ? restCats.filter((cat) => cat.toLowerCase().includes(categorySearchKey))
    : restCats
  const currentGroup = groups[currentGroupIdx] ?? null
  const groupedIndividuals = groupTransactionsByMonth(individuals)
  const groupedTxCount = groups.reduce((n, g) => n + g.transactions.length, 0)
  const remainingCount = Math.max(totalCount - reviewedCount, 0)
  const completedGroupCount = groupJustDone ? currentGroupIdx + 1 : currentGroupIdx
  const selectedGroupAccountName = pendingAccountId
    ? accounts.find((account) => account.id === pendingAccountId)?.name
    : null

  // ── Init from query ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (reviewQuery.isLoading) return
    const txs = reviewQuery.data?.transactions ?? []
    if (txs.length === 0) { setPhase('empty'); return }

    const { groups: g, singles } = groupTransactions(txs)
    setTotalCount(txs.length)
    setReviewedCount(0)
    setCurrentGroupIdx(0)
    setCompletionStats({ groupCount: 0, groupTxCount: 0, individualCount: 0 })
    setIndividuals(singles)

    loadSuggestionsForGroups(g).then((gWithSug) => {
      setGroups(gWithSug)
      setPhase('summary')
    })
  }, [reviewQuery.isLoading, reviewQuery.data?.transactions.length])

  // ── Done when no individuals left ─────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'individual-review' && individuals.length === 0) {
      setPhase('done')
    }
  }, [phase, individuals.length])

  useEffect(() => {
    if (!currentGroup || groupJustDone) return
    const accountIds = [...new Set(currentGroup.transactions.map((tx) => tx.account_id).filter((id): id is string => !!id))]
    setPendingAccountId(accountIds.length === 1 ? accountIds[0] : null)
  }, [currentGroupIdx, currentGroup, groupJustDone])

  // ── Group actions ─────────────────────────────────────────────────────────────
  async function applyToGroup() {
    if (!currentGroup || !pendingCategory || !pendingAccountId) return
    setApplyingGroup(true)
    try {
      await Promise.all(
        currentGroup.transactions.map((tx) =>
          updateTransaction(tx.id, { account_id: pendingAccountId, category: pendingCategory, reviewed: true }),
        ),
      )
      await saveSuggestion(currentGroup.key, pendingCategory)
      invalidateTransactionData(queryClient)

      const count = currentGroup.transactions.length
      const cat = pendingCategory
      setReviewedCount((prev) => prev + count)
      setCompletionStats((prev) => ({
        ...prev,
        groupCount: prev.groupCount + 1,
        groupTxCount: prev.groupTxCount + count,
      }))
      setGroupJustDone({ count, category: cat })
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not apply category. Please try again.' })
    } finally {
      setApplyingGroup(false)
    }
  }

  function moveToNextGroup() {
    setGroupJustDone(null)
    setPendingCategory(null)
    setPendingAccountId(null)
    const nextIdx = currentGroupIdx + 1
    if (nextIdx < groups.length) {
      setCurrentGroupIdx(nextIdx)
    } else {
      setPhase(individuals.length > 0 ? 'individual-review' : 'done')
    }
  }

  function skipGroup() {
    if (!currentGroup) return
    setIndividuals((prev) => [...prev, ...currentGroup.transactions])
    setPendingCategory(null)
    setPendingAccountId(null)
    const nextIdx = currentGroupIdx + 1
    if (nextIdx < groups.length) {
      setCurrentGroupIdx(nextIdx)
    } else {
      setPhase('individual-review')
    }
  }

  // ── Individual actions ────────────────────────────────────────────────────────
  function openSheet(tx: Transaction) {
    setActiveTx(tx)
    setForm(txToFormState(tx))
    setShowDatePicker(false)
    setShowTimePicker(false)
    setSheetOpen(true)
  }

  function removeIndividual(id: string) {
    setIndividuals((prev) => prev.filter((t) => t.id !== id))
    setReviewedCount((prev) => prev + 1)
    setCompletionStats((prev) => ({ ...prev, individualCount: prev.individualCount + 1 }))
    invalidateTransactionData(queryClient)
  }

  async function handleConfirm() {
    if (!activeTx || !form) return
    if (!isReviewConfirmable(form)) {
      setMessageDialog({ title: 'Required', message: 'Choose a category and account to confirm.' })
      return
    }
    setConfirming(true)
    try {
      await updateTransaction(activeTx.id, { ...formStateToPayload(form), reviewed: true })
      removeIndividual(activeTx.id)
      setSheetOpen(false)
    } catch (e) {
      setMessageDialog({ title: 'Error', message: e instanceof Error ? e.message : 'Failed to confirm.' })
    } finally {
      setConfirming(false)
    }
  }

  function handleReject() {
    setRejectDialogOpen(true)
  }

  async function confirmReject() {
    if (!activeTx) return
    setRejecting(true)
    try {
      await deleteTransaction(activeTx.id)
      removeIndividual(activeTx.id)
      setRejectDialogOpen(false)
      setSheetOpen(false)
    } catch (e) {
      setRejectDialogOpen(false)
      setMessageDialog({ title: 'Error', message: e instanceof Error ? e.message : 'Failed to reject.' })
    } finally {
      setRejecting(false)
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  const activeType = form ? TYPES.find((t) => t.value === form.type)! : TYPES[0]
  const toAccounts = form ? accounts.filter((a) => a.id !== form.accountId) : []
  const canConfirm = form ? isReviewConfirmable(form) : false
  const formDate = form ? new Date(form.date + 'T00:00:00') : new Date()
  const selectedAccountName = form ? accounts.find((a) => a.id === form.accountId)?.name : undefined
  const selectedToAccountName = form ? toAccounts.find((a) => a.id === form.toAccountId)?.name : undefined

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <Polyline points="15 18 9 12 15 6" />
          </Svg>
        </Pressable>
        <Text style={s.headerTitle}>Review</Text>
        {phase === 'group-review' && (
          <View style={s.headerGroupBadge}>
            <Text style={s.headerGroupBadgeText}>{currentGroupIdx + 1} / {groups.length}</Text>
          </View>
        )}
      </View>

      {/* ── Loading ── */}
      {(phase === 'loading' || reviewQuery.isLoading) && (
        <View style={s.processingCenter}>
          <View style={s.processingMascot}>
            <ActivityIndicator size="large" color={C.brand} />
          </View>
          <Text style={s.processingTitle}>Preparing review</Text>
          <Text style={s.processingSub}>Reading imported transactions on this device.</Text>
          <View style={s.processingSteps}>
            {['File uploaded', 'Reading statement', 'Extracting transactions'].map((step) => (
              <View key={step} style={s.processingStep}>
                <View style={s.processingCheck}>
                  <CheckIcon color="#fff" size={12} />
                </View>
                <Text style={s.processingStepText}>{step}</Text>
              </View>
            ))}
            <View style={s.processingStep}>
              <View style={s.processingDot} />
              <Text style={s.processingStepText}>Preparing review</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Empty ── */}
      {phase === 'empty' && (
        <View style={s.center}>
          <View style={s.checkCircle}>
            <CheckIcon color="#fff" size={32} />
          </View>
          <Text style={s.emptyTitle}>All caught up!</Text>
          <Text style={s.emptySub}>No transactions to review right now.</Text>
        </View>
      )}

      {/* ── Summary ── */}
      {phase === 'summary' && (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.summaryContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.summaryHero}>
            <Text style={s.summaryCount}>{totalCount}</Text>
            <Text style={s.summaryCountLabel}>Transactions Imported</Text>
            <Text style={s.summaryPrivacy}>Your statement stays on your device.</Text>
          </View>

          <View style={s.summaryCards}>
            {groups.length > 0 && (
              <View style={s.summaryCard}>
                <View style={s.summaryCardIcon}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <Circle cx="9" cy="7" r="4" />
                    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </Svg>
                </View>
                <View style={s.summaryCardBody}>
                  <Text style={s.summaryCardNum}>{groupedTxCount} transactions grouped</Text>
                  <Text style={s.summaryCardSub}>{groups.length} group{groups.length !== 1 ? 's' : ''} ready for batch review</Text>
                </View>
                <View style={s.summaryCardBadge}>
                  <Text style={s.summaryCardBadgeText}>Offline</Text>
                </View>
              </View>
            )}

            {individuals.length > 0 && (
              <View style={s.summaryCard}>
                <View style={s.summaryCardIcon}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <Circle cx="12" cy="7" r="4" />
                  </Svg>
                </View>
                <View style={s.summaryCardBody}>
                  <Text style={s.summaryCardNum}>{individuals.length} need individual review</Text>
                  <Text style={s.summaryCardSub}>odd transactions kept in a queue</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={s.summaryHint}>
            {groups.length > 0
              ? `Review ${groups.length} group${groups.length !== 1 ? 's' : ''} first, then ${individuals.length} individual transaction${individuals.length !== 1 ? 's' : ''}.`
              : `Review ${individuals.length} transaction${individuals.length !== 1 ? 's' : ''} one by one.`}
          </Text>

          <Pressable
            style={s.startBtn}
            onPress={() => setPhase(groups.length > 0 ? 'group-review' : 'individual-review')}
          >
            <Text style={s.startBtnText}>Start Review →</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── Group Review ── */}
      {phase === 'group-review' && currentGroup && (
        <View style={s.flex}>
          <View style={s.groupProgressArea}>
            <Text style={s.reviewStageText}>{completedGroupCount} of {groups.length} groups completed</Text>
            <ProgressBar reviewed={reviewedCount} total={totalCount} />
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.groupContent, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Group card */}
            <View style={s.groupCard}>
              <View style={s.groupCardTop}>
                <View style={s.groupCardInfo}>
                  <Text style={s.groupName} numberOfLines={2}>{currentGroup.displayName}</Text>
                  {currentGroup.suggestion && !groupJustDone && (
                    <View style={s.suggestionRow}>
                      <View style={s.suggestionChip}>
                        <Text style={s.suggestionText}>Suggested: {currentGroup.suggestion}</Text>
                      </View>
                      <Pressable style={s.suggestionConfirm} onPress={() => setPendingCategory(currentGroup.suggestion)}>
                        <Text style={s.suggestionConfirmText}>Confirm</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <View style={s.groupCountBadge}>
                  <Text style={s.groupCountNum}>{currentGroup.transactions.length}</Text>
                  <Text style={s.groupCountSub}>txns</Text>
                </View>
              </View>

              {groupJustDone ? (
                <View style={s.groupDonePanel}>
                  <View style={s.groupDoneRow}>
                    <View style={s.groupDoneCircle}>
                      <CheckIcon color="#fff" size={16} />
                    </View>
                    <View style={s.groupDoneCopy}>
                      <Text style={s.groupDoneText}>
                        {groupJustDone.count} transaction{groupJustDone.count !== 1 ? 's' : ''} categorized
                      </Text>
                      <Text style={s.groupDoneSub}>{remainingCount} remaining</Text>
                    </View>
                  </View>
                  <Pressable style={s.nextGroupBtn} onPress={moveToNextGroup}>
                    <Text style={s.nextGroupBtnText}>
                      {currentGroupIdx + 1 < groups.length ? 'Next Group' : individuals.length > 0 ? 'Review Individuals' : 'Finish Review'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={s.amountPills}>
                  {currentGroup.transactions.slice(0, 4).map((tx) => (
                    <View key={tx.id} style={[s.amountPill, { backgroundColor: TYPE_COLOR[tx.type] + '18' }]}>
                      <Text style={[s.amountPillText, { color: TYPE_COLOR[tx.type] }]}>
                        {TYPE_PREFIX[tx.type]}{formatAmount(tx.amount)}
                      </Text>
                    </View>
                  ))}
                  {currentGroup.transactions.length > 4 && (
                    <View style={s.amountPillMore}>
                      <Text style={s.amountPillMoreText}>+{currentGroup.transactions.length - 4} more</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Category pills */}
            {!groupJustDone && (
              <>
                <Text style={s.catQuestion}>What category?</Text>
                <View style={s.catPills}>
                  {allCategories.map((cat) => {
                    const color = categoryColor(cat, catColors)
                    const isSelected = pendingCategory === cat
                    const isSuggested = currentGroup.suggestion === cat && !isSelected
                    return (
                      <Pressable
                        key={cat}
                        style={[
                          s.catPill,
                          isSelected && { borderColor: color },
                          isSuggested && s.catPillSuggested,
                        ]}
                        onPress={() => setPendingCategory(cat)}
                      >
                        <View style={[s.catPillDot, { backgroundColor: color }]} />
                        <Text style={[s.catPillText, isSelected && { color, fontFamily: F.semibold }]}>{cat}</Text>
                        {isSuggested && <Text style={s.suggestedTag}>✦</Text>}
                      </Pressable>
                    )
                  })}
                </View>

                <Text style={s.catQuestion}>Which account?</Text>
                <View style={s.catPills}>
                  {accounts.length === 0 && (
                    <Text style={s.inlineEmptyText}>Add an account before applying this group.</Text>
                  )}
                  {accounts.map((account) => {
                    const isSelected = pendingAccountId === account.id
                    return (
                      <Pressable
                        key={account.id}
                        style={[s.catPill, isSelected && s.accountPillSelected]}
                        onPress={() => setPendingAccountId(account.id)}
                      >
                        <View style={[s.catPillDot, { backgroundColor: isSelected ? C.brand : C.ink3 }]} />
                        <Text style={[s.catPillText, isSelected && { color: C.brand, fontFamily: F.semibold }]}>{account.name}</Text>
                        {isSelected && <CheckIcon color={C.brand} size={14} />}
                      </Pressable>
                    )
                  })}
                </View>

                {pendingCategory && pendingAccountId && (
                  <View style={s.applyBar}>
                    <Text style={s.applyBarText}>
                      Apply "{pendingCategory}" from {selectedGroupAccountName} to {currentGroup.transactions.length} transaction{currentGroup.transactions.length !== 1 ? 's' : ''}?
                    </Text>
                    <View style={s.applyBarBtns}>
                      <Pressable style={s.changeBtn} onPress={() => { setPendingCategory(null); setPendingAccountId(null) }}>
                        <Text style={s.changeBtnText}>Change</Text>
                      </Pressable>
                      <Pressable
                        style={[s.applyBtn, applyingGroup && s.btnDisabled]}
                        onPress={applyToGroup}
                        disabled={applyingGroup}
                      >
                        {applyingGroup
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={s.applyBtnText}>Apply →</Text>}
                      </Pressable>
                    </View>
                  </View>
                )}

                <Pressable style={s.skipBtn} onPress={skipGroup}>
                  <Text style={s.skipBtnText}>Skip group</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      )}

      {/* ── Individual Review ── */}
      {phase === 'individual-review' && (
        <View style={s.flex}>
          <ProgressBar reviewed={reviewedCount} total={totalCount} />
          <ScrollView
            style={s.scroll}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.queueIntro}>
              <Text style={s.queueTitle}>Individual Review Queue</Text>
              <Text style={s.hint}>Tap a transaction, choose its type, then pick a category.</Text>
            </View>
            {groupedIndividuals.map(({ month, txs: monthTxs }) => (
              <View key={month} style={s.monthGroup}>
                <View style={s.monthRow}>
                  <Text style={s.monthLabel}>{formatMonthLabel(month)}</Text>
                  <View style={s.monthCountBadge}>
                    <Text style={s.monthCountText}>{monthTxs.length}</Text>
                  </View>
                </View>
                <View style={s.monthCard}>
                  {monthTxs.map((tx, i) => {
                    const tColor = TYPE_COLOR[tx.type]
                    const accountName = accounts.find((a) => a.id === tx.account_id)?.name
                    return (
                      <Pressable key={tx.id} style={[s.row, i > 0 && s.rowBorder]} onPress={() => openSheet(tx)}>
                        <View style={s.rowBody}>
                          <Text style={s.rowMerchant} numberOfLines={1}>{tx.merchant || tx.description || '—'}</Text>
                          <View style={s.rowChips}>
                            <View style={[s.rowInfoChip, !tx.category && s.rowInfoChipMissing]}>
                              {!!tx.category && <View style={[s.rowInfoDot, { backgroundColor: categoryColor(tx.category, catColors) }]} />}
                              <Text style={[s.rowInfoText, !tx.category && s.rowInfoTextMissing]} numberOfLines={1}>
                                {tx.category || 'Category needed'}
                              </Text>
                            </View>
                            <View style={[s.rowInfoChip, !accountName && s.rowInfoChipMissing]}>
                              <Text style={[s.rowInfoText, !accountName && s.rowInfoTextMissing]} numberOfLines={1}>
                                {accountName || 'Account needed'}
                              </Text>
                            </View>
                          </View>
                          <Text style={s.rowDate}>{formatDateLabel(tx.date)}</Text>
                        </View>
                        <View style={[s.typeBadge, { backgroundColor: tColor + '20' }]}>
                          <Text style={[s.typeBadgeText, { color: tColor }]}>{tx.type}</Text>
                        </View>
                        <Text style={[s.rowAmount, { color: tColor }]}>{TYPE_PREFIX[tx.type]}{formatAmount(tx.amount)}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Done ── */}
      {phase === 'done' && (
        <ScrollView
          contentContainerStyle={[s.doneContent, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.doneCircle}>
            <CheckIcon color="#fff" size={36} />
          </View>
          <Text style={s.doneTitle}>All Done!</Text>
          <Text style={s.doneSub}>{totalCount} Transaction{totalCount !== 1 ? 's' : ''} Reviewed</Text>

          {(completionStats.groupCount > 0 || completionStats.individualCount > 0) && (
            <View style={s.doneStats}>
              {completionStats.groupCount > 0 && (
                <>
                  <View style={s.doneStatRow}>
                    <Text style={s.doneStatLabel}>Groups reviewed</Text>
                    <Text style={s.doneStatVal}>{completionStats.groupCount}</Text>
                  </View>
                  <View style={[s.doneStatRow, s.doneStatBorder]}>
                    <Text style={s.doneStatLabel}>Transactions in groups</Text>
                    <Text style={s.doneStatVal}>{completionStats.groupTxCount}</Text>
                  </View>
                </>
              )}
              {completionStats.individualCount > 0 && (
                <View style={[s.doneStatRow, completionStats.groupCount > 0 && s.doneStatBorder]}>
                  <Text style={s.doneStatLabel}>Individual reviews</Text>
                  <Text style={s.doneStatVal}>{completionStats.individualCount}</Text>
                </View>
              )}
            </View>
          )}

          <Pressable style={s.doneCta} onPress={() => navigation.goBack()}>
            <Text style={s.doneCtaText}>Return Home</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── Individual review sheet ── */}
      {form && (
        <Sheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          heightFraction={0.88}
          header={(
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>What type of transaction is this?</Text>
              <Pressable onPress={() => setSheetOpen(false)} style={s.sheetCancelBtn} hitSlop={8}>
                <Text style={s.sheetCancelText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        >
          <ScrollView
            style={s.sheetScroll}
            contentContainerStyle={s.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TypePicker types={TYPES} active={form.type} onChange={(v) => setForm({ ...form, type: v })} />

            <View style={s.amountRow}>
              <Text style={[s.rupeeSign, { color: activeType.color }]}>₹</Text>
              <TextInput
                style={[s.amountInput, { color: activeType.color }]}
                value={formatDisplayAmount(form.amountStr)}
                onChangeText={(v) => setForm({ ...form, amountStr: sanitizeAmountInput(v.replace(/,/g, '')) })}
                placeholder="0"
                placeholderTextColor={activeType.color + '60'}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>

            {form.type !== 'transfer' && (
              <View style={s.field}>
                <Text style={s.label}>{form.type === 'credit' ? 'SENDER' : 'RECIPIENT'}</Text>
                <TextInput
                  style={s.textInput}
                  value={form.merchant}
                  onChangeText={(v) => setForm({ ...form, merchant: v })}
                  placeholder="Who was this with?"
                  placeholderTextColor={C.ink3}
                  returnKeyType="next"
                />
              </View>
            )}

            <View style={s.field}>
              <Text style={s.label}>NOTES · OPTIONAL</Text>
              <TextInput
                style={s.textInput}
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                placeholder="Add context if useful"
                placeholderTextColor={C.ink3}
                returnKeyType="next"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>CATEGORY <Text style={{ color: C.neg }}>*</Text></Text>
              <Pressable style={s.selectField} onPress={() => setCatPickerOpen(true)}>
                <View style={s.selectInner}>
                  {!!form.category && (
                    <View style={[s.catDot, { backgroundColor: categoryColor(form.category, catColors) }]} />
                  )}
                  <Text style={[s.selectText, !form.category && s.selectPlaceholder]} numberOfLines={1}>
                    {form.category || 'Select category'}
                  </Text>
                </View>
                <ChevronDown />
              </Pressable>
            </View>

            <View style={s.field}>
              <Text style={s.label}>
                {form.type === 'transfer' ? 'FROM ACCOUNT' : 'ACCOUNT'} <Text style={{ color: C.neg }}>*</Text>
              </Text>
              <Pressable style={s.selectField} onPress={() => setAccPickerOpen(true)}>
                <Text style={[s.selectText, !form.accountId && s.selectPlaceholder]} numberOfLines={1}>
                  {selectedAccountName || 'Select account'}
                </Text>
                <ChevronDown />
              </Pressable>
            </View>

            {form.type === 'transfer' && (
              <View style={s.field}>
                <Text style={s.label}>TO ACCOUNT <Text style={{ color: C.neg }}>*</Text></Text>
                <Pressable style={s.selectField} onPress={() => setToAccPickerOpen(true)}>
                  <Text style={[s.selectText, !form.toAccountId && s.selectPlaceholder]} numberOfLines={1}>
                    {selectedToAccountName || 'Select account'}
                  </Text>
                  <ChevronDown />
                </Pressable>
              </View>
            )}

            <View style={s.twoCol}>
              <View style={s.colField}>
                <Text style={s.label}>DATE</Text>
                <Pressable
                  style={s.textInput}
                  onPress={() => {
                    if (Platform.OS === 'android') {
                      DateTimePickerAndroid.open({
                        value: formDate,
                        mode: 'date',
                        maximumDate: new Date(),
                        onChange: (_, selected) => {
                          if (selected && form) setForm({ ...form, date: selected.toISOString().slice(0, 10) })
                        },
                      })
                    } else {
                      setPendingDate(formDate)
                      setShowDatePicker(true)
                    }
                  }}
                >
                  <Text style={s.dateText}>
                    {formDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </Pressable>
              </View>
              <View style={s.colField}>
                <Text style={s.label}>TIME</Text>
                <Pressable
                  style={s.textInput}
                  onPress={() => {
                    const value = form.time ? timeToDate(form.time) : new Date()
                    if (Platform.OS === 'android') {
                      DateTimePickerAndroid.open({
                        value,
                        mode: 'time',
                        is24Hour: false,
                        onChange: (_, selected) => {
                          if (selected && form) setForm({ ...form, time: formatTime(selected) })
                        },
                      })
                    } else {
                      setPendingTime(value)
                      setShowTimePicker(true)
                    }
                  }}
                >
                  <Text style={[s.dateText, !form.time && s.selectPlaceholder]}>
                    {form.time ? formatTimeLabel(form.time) : 'Not set'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={s.actionRow}>
              <Pressable
                style={[s.rejectBtn, rejecting && s.btnDisabled]}
                onPress={handleReject}
                disabled={rejecting || confirming}
              >
                {rejecting
                  ? <ActivityIndicator size="small" color={C.neg} />
                  : <Text style={s.rejectBtnText}>Reject</Text>}
              </Pressable>
              <Pressable
                style={[s.confirmBtn, (!canConfirm || confirming) && s.btnDisabled]}
                onPress={handleConfirm}
                disabled={!canConfirm || confirming || rejecting}
              >
                {confirming
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.confirmBtnText}>Confirm →</Text>}
              </Pressable>
            </View>
          </ScrollView>

          {/* Category picker */}
          <Sheet
            visible={catPickerOpen}
            onClose={() => { setCatPickerOpen(false); setCategorySearch('') }}
            heightFraction={0.6}
            header={(
              <View style={s.pickerHeader}>
                <Text style={s.pickerTitle}>Category</Text>
                <Pressable onPress={() => { setCatPickerOpen(false); setCategorySearch('') }} hitSlop={8}>
                  <Text style={s.pickerDone}>Done</Text>
                </Pressable>
              </View>
            )}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.pickerScroll}>
              <View style={s.searchWrap}>
                <TextInput
                  style={s.searchInput}
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                  placeholder="Search categories"
                  placeholderTextColor={C.ink3}
                  returnKeyType="search"
                />
              </View>
              {shownRecentCats.length > 0 && (
                <>
                  <Text style={s.pickerSectionLabel}>RECENT</Text>
                  {shownRecentCats.map((cat) => (
                    <Pressable key={`r-${cat}`} style={s.pickerRow} onPress={() => { setForm({ ...form, category: cat }); setCatPickerOpen(false); setCategorySearch('') }}>
                      <View style={[s.catDot, { backgroundColor: categoryColor(cat, catColors) }]} />
                      <Text style={[s.pickerRowText, form.category === cat && { color: activeType.color, fontFamily: F.semibold }]}>{cat}</Text>
                      {form.category === cat && <CheckIcon color={activeType.color} />}
                    </Pressable>
                  ))}
                </>
              )}
              <Text style={s.pickerSectionLabel}>{shownRecentCats.length > 0 ? 'ALL' : 'CATEGORIES'}</Text>
              {shownRestCats.map((cat) => (
                <Pressable key={cat} style={s.pickerRow} onPress={() => { setForm({ ...form, category: cat }); setCatPickerOpen(false); setCategorySearch('') }}>
                  <View style={[s.catDot, { backgroundColor: categoryColor(cat, catColors) }]} />
                  <Text style={[s.pickerRowText, form.category === cat && { color: activeType.color, fontFamily: F.semibold }]}>{cat}</Text>
                  {form.category === cat && <CheckIcon color={activeType.color} />}
                </Pressable>
              ))}
              {shownRecentCats.length === 0 && shownRestCats.length === 0 && (
                <Text style={s.pickerEmptyText}>No matching categories</Text>
              )}
            </ScrollView>
          </Sheet>

          {/* Account picker */}
          <Sheet
            visible={accPickerOpen}
            onClose={() => setAccPickerOpen(false)}
            heightFraction={0.5}
            header={(
              <View style={s.pickerHeader}>
                <Text style={s.pickerTitle}>{form.type === 'transfer' ? 'From Account' : 'Account'}</Text>
                <Pressable onPress={() => setAccPickerOpen(false)} hitSlop={8}><Text style={s.pickerDone}>Done</Text></Pressable>
              </View>
            )}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.pickerScroll}>
              {accounts.length === 0 && <Text style={s.pickerEmptyText}>No accounts yet</Text>}
              {accounts.map((acc) => (
                <Pressable key={acc.id} style={s.pickerRow} onPress={() => { setForm({ ...form, accountId: acc.id }); setAccPickerOpen(false) }}>
                  <Text style={[s.pickerRowText, form.accountId === acc.id && { color: activeType.color, fontFamily: F.semibold }]}>{acc.name}</Text>
                  {form.accountId === acc.id && <CheckIcon color={activeType.color} />}
                </Pressable>
              ))}
            </ScrollView>
          </Sheet>

          {/* To Account picker */}
          <Sheet
            visible={toAccPickerOpen}
            onClose={() => setToAccPickerOpen(false)}
            heightFraction={0.5}
            header={(
              <View style={s.pickerHeader}>
                <Text style={s.pickerTitle}>To Account</Text>
                <Pressable onPress={() => setToAccPickerOpen(false)} hitSlop={8}><Text style={s.pickerDone}>Done</Text></Pressable>
              </View>
            )}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.pickerScroll}>
              {toAccounts.map((acc) => (
                <Pressable key={acc.id} style={s.pickerRow} onPress={() => { setForm({ ...form, toAccountId: acc.id, merchant: acc.name }); setToAccPickerOpen(false) }}>
                  <Text style={[s.pickerRowText, form.toAccountId === acc.id && { color: activeType.color, fontFamily: F.semibold }]}>{acc.name}</Text>
                  {form.toAccountId === acc.id && <CheckIcon color={activeType.color} />}
                </Pressable>
              ))}
            </ScrollView>
          </Sheet>

          {/* iOS date picker */}
          {Platform.OS === 'ios' && (
            <Modal visible={showDatePicker} transparent animationType="fade">
              <Pressable style={s.modalOverlay} onPress={() => setShowDatePicker(false)}>
                <View style={s.modalCard}>
                  <View style={s.pickerWrapper}>
                    <DateTimePicker
                      value={pendingDate}
                      mode="date"
                      display="spinner"
                      onChange={(_, selected) => { if (selected) setPendingDate(selected) }}
                      maximumDate={new Date()}
                      textColor={C.ink}
                    />
                  </View>
                  <Pressable
                    style={s.modalDoneBtn}
                    onPress={() => {
                      const y = pendingDate.getFullYear()
                      const m = String(pendingDate.getMonth() + 1).padStart(2, '0')
                      const d = String(pendingDate.getDate()).padStart(2, '0')
                      setForm((prev) => prev ? { ...prev, date: `${y}-${m}-${d}` } : prev)
                      setShowDatePicker(false)
                    }}
                  >
                    <Text style={s.modalDoneText}>Done</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>
          )}

          {/* iOS time picker */}
          {Platform.OS === 'ios' && (
            <Modal visible={showTimePicker} transparent animationType="fade">
              <Pressable style={s.modalOverlay} onPress={() => setShowTimePicker(false)}>
                <View style={s.modalCard}>
                  <View style={s.pickerWrapper}>
                    <DateTimePicker
                      value={pendingTime}
                      mode="time"
                      display="spinner"
                      is24Hour={false}
                      onChange={(_, selected) => { if (selected) setPendingTime(selected) }}
                      textColor={C.ink}
                    />
                  </View>
                  <Pressable
                    style={s.modalDoneBtn}
                    onPress={() => {
                      setForm((prev) => prev ? { ...prev, time: formatTime(pendingTime) } : prev)
                      setShowTimePicker(false)
                    }}
                  >
                    <Text style={s.modalDoneText}>Done</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>
          )}
        <Dialog
          visible={rejectDialogOpen}
          onClose={() => { if (!rejecting) setRejectDialogOpen(false) }}
          title="Reject transaction?"
          message="This will permanently delete the transaction."
          actions={[
            { label: 'Cancel', variant: 'secondary', onPress: () => setRejectDialogOpen(false), disabled: rejecting },
            { label: 'Reject', variant: 'destructive', onPress: confirmReject, loading: rejecting },
          ]}
        />
        </Sheet>
      )}

      <MessageDialog
        dialog={messageDialog}
        onClose={() => setMessageDialog(null)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backBtn: { padding: 2 },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: F.extrabold, color: C.ink },
  headerGroupBadge: {
    backgroundColor: C.brandPale,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  headerGroupBadgeText: { fontSize: 12, fontFamily: F.bold, color: C.brand },

  // Center (loading / empty / done)
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  processingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  processingMascot: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.brandPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingTitle: { fontSize: 18, fontFamily: F.extrabold, color: C.ink },
  processingSub: { fontSize: 13, fontFamily: F.regular, color: C.ink3, textAlign: 'center', lineHeight: 19 },
  processingSteps: {
    width: '100%',
    marginTop: 8,
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    gap: 10,
  },
  processingStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  processingCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  processingDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.line },
  processingStepText: { fontSize: 13, fontFamily: F.medium, color: C.ink2 },

  // Empty
  checkCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontFamily: F.extrabold, color: C.ink },
  emptySub: { fontSize: 14, fontFamily: F.regular, color: C.ink3, textAlign: 'center' },

  // Summary
  summaryContent: { paddingHorizontal: 16, paddingTop: 24, gap: 20 },
  summaryHero: { alignItems: 'center', gap: 4 },
  summaryCount: { fontSize: 64, fontFamily: F.extrabold, color: C.ink, lineHeight: 72 },
  summaryCountLabel: { fontSize: 16, fontFamily: F.extrabold, color: C.ink },
  summaryPrivacy: { fontSize: 13, fontFamily: F.regular, color: C.brand, marginTop: 4 },
  summaryCards: { gap: 10 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
  },
  summaryCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  summaryCardBody: { flex: 1, gap: 2 },
  summaryCardNum: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  summaryCardSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  summaryCardBadge: {
    backgroundColor: C.brandPale,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  summaryCardBadgeText: { fontSize: 11, fontFamily: F.bold, color: C.brand },
  summaryHint: { fontSize: 13.5, fontFamily: F.regular, color: C.ink3, lineHeight: 20, textAlign: 'center' },
  startBtn: {
    backgroundColor: C.brand,
    borderRadius: RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  startBtnText: { fontSize: 16, fontFamily: F.semibold, color: '#fff' },

  // Group review
  groupProgressArea: { paddingTop: 4 },
  reviewStageText: { paddingHorizontal: 16, paddingBottom: 6, fontSize: 12, fontFamily: F.semibold, color: C.ink2 },
  groupContent: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
  groupCard: {
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
  groupCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  groupCardInfo: { flex: 1, gap: 6 },
  groupName: { fontSize: 18, fontFamily: F.extrabold, color: C.ink, lineHeight: 24 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  suggestionChip: {
    alignSelf: 'flex-start',
    backgroundColor: C.brandPale,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  suggestionText: { fontSize: 12, fontFamily: F.semibold, color: C.brand },
  suggestionConfirm: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.brand },
  suggestionConfirmText: { fontSize: 12, fontFamily: F.semibold, color: C.brand },
  groupCountBadge: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
  },
  groupCountNum: { fontSize: 20, fontFamily: F.extrabold, color: C.ink },
  groupCountSub: { fontSize: 10, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  amountPillText: { fontSize: 13, fontFamily: F.monoBold },
  amountPillMore: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  amountPillMoreText: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  groupDonePanel: { gap: 14 },
  groupDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupDoneCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  groupDoneCopy: { flex: 1, gap: 2 },
  groupDoneText: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  groupDoneSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  nextGroupBtn: { backgroundColor: C.brand, borderRadius: RADIUS, paddingVertical: 13, alignItems: 'center' },
  nextGroupBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },

  // Category pills
  catQuestion: { fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  catPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: C.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.surface,
  },
  catPillSuggested: { borderColor: C.brand + '60', backgroundColor: C.brandPale + '60' },
  accountPillSelected: { borderColor: C.brand },
  catPillDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  catPillText: { fontSize: 14, fontFamily: F.medium, color: C.ink },
  suggestedTag: { fontSize: 10, color: C.brand },
  inlineEmptyText: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 19 },

  // Apply bar
  applyBar: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    gap: 12,
  },
  applyBarText: { fontSize: 14, fontFamily: F.medium, color: C.ink, lineHeight: 20 },
  applyBarBtns: { flexDirection: 'row', gap: 10 },
  changeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: C.line,
    alignItems: 'center',
  },
  changeBtnText: { fontSize: 14, fontFamily: F.semibold, color: C.ink2 },
  applyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS,
    alignItems: 'center',
    backgroundColor: C.brand,
  },
  applyBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
  skipBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  skipBtnText: { fontSize: 13, fontFamily: F.medium, color: C.ink3 },

  // Individual review list
  queueIntro: { marginHorizontal: 18, marginTop: 4, marginBottom: 4, gap: 3 },
  queueTitle: { fontSize: 16, fontFamily: F.extrabold, color: C.ink },
  hint: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  monthGroup: { marginHorizontal: 16, marginTop: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  monthLabel: { fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.6 },
  monthCountBadge: {
    backgroundColor: C.neg + '18',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCountText: { fontSize: 11, fontFamily: F.semibold, color: C.neg },
  monthCard: { backgroundColor: C.surface, borderRadius: RADIUS, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowMerchant: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  rowCat: { fontSize: 12, fontFamily: F.bold, color: C.ink3 },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  rowInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '48%',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rowInfoChipMissing: { borderColor: C.neg + '55', backgroundColor: C.neg + '10' },
  rowInfoDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  rowInfoText: { flexShrink: 1, fontSize: 10.5, fontFamily: F.semibold, color: C.ink2 },
  rowInfoTextMissing: { color: C.neg },
  rowDate: { fontSize: 11, fontFamily: F.regular, color: C.ink3 },
  typeBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontSize: 9, fontFamily: F.extrabold, letterSpacing: 0.4, textTransform: 'uppercase' },
  rowAmount: { fontSize: 14, fontFamily: F.monoBold, flexShrink: 0 },

  // Done
  doneContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  doneCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 18, fontFamily: F.extrabold, color: C.ink },
  doneSub: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  doneStats: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    marginTop: 8,
    overflow: 'hidden',
  },
  doneStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  doneStatBorder: { borderTopWidth: 1, borderTopColor: C.line },
  doneStatLabel: { fontSize: 14, fontFamily: F.regular, color: C.ink2 },
  doneStatVal: { fontSize: 14, fontFamily: F.bold, color: C.ink },
  doneCta: {
    marginTop: 12,
    width: '100%',
    backgroundColor: C.brand,
    borderRadius: RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneCtaText: { fontSize: 16, fontFamily: F.semibold, color: '#fff' },

  // Sheet
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  sheetTitle: { flex: 1, marginRight: 12, fontSize: 17, fontFamily: F.extrabold, color: C.ink },
  sheetCancelBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  sheetCancelText: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 20 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  rupeeSign: { fontSize: 40, fontFamily: F.regular, lineHeight: 56 },
  amountInput: { fontSize: 52, fontFamily: F.semibold, textAlign: 'center', minWidth: 120, padding: 0 },
  field: { gap: 8 },
  twoCol: { flexDirection: 'row', gap: 16 },
  colField: { flex: 1, gap: 8 },
  label: { fontSize: 11, fontFamily: F.bold, color: C.ink3, letterSpacing: 0.4 },
  textInput: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    fontSize: 14,
    fontFamily: F.regular,
    color: C.ink,
  },
  dateText: { fontSize: 14, fontFamily: F.regular, color: C.ink },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  selectInner: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  selectText: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.ink },
  selectPlaceholder: { color: C.ink3 },
  catDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: RADIUS, alignItems: 'center', borderWidth: 1.5, borderColor: C.neg },
  rejectBtnText: { fontSize: 15, fontFamily: F.semibold, color: C.neg },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS, alignItems: 'center', backgroundColor: C.brand },
  confirmBtnText: { fontSize: 15, fontFamily: F.semibold, color: '#fff' },
  btnDisabled: { opacity: 0.4 },

  // Picker sheet
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  pickerTitle: { fontSize: 16, fontFamily: F.semibold, color: C.ink },
  pickerDone: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },
  searchInput: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    fontSize: 14,
    fontFamily: F.regular,
    color: C.ink,
  },
  pickerSectionLabel: { fontSize: 11, fontFamily: F.medium, color: C.ink3, letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  pickerRowText: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.ink },
  pickerScroll: { paddingBottom: 32 },
  pickerEmptyText: { fontSize: 14, fontFamily: F.regular, color: C.ink3, paddingHorizontal: 16, paddingVertical: 20, textAlign: 'center' },

  // iOS date picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, overflow: 'hidden' },
  pickerWrapper: { alignItems: 'center', backgroundColor: C.surface },
  modalDoneBtn: { marginHorizontal: 16, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: C.brand },
  modalDoneText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
})
