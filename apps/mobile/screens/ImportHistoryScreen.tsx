import React, { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Path, Polyline } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  countTransactionsForImportSession,
  getLatestCompletedImportSession,
  undoLatestCompletedImport,
  type ImportSession,
} from '../repositories/importRepository'
import { getSettingsData } from '../lib/data'
import { invalidateTransactionData, queryKeys } from '../lib/query'
import { Dialog, MessageDialog, type MessageDialogState } from '../components/Dialog'
import type { RootStackParamList } from '../navigation/types'
import { C, F, RADIUS } from '../lib/tokens'

type Nav = NativeStackNavigationProp<RootStackParamList>

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function RowDivider() { return <View style={{ height: 1, backgroundColor: C.line }} /> }

export function ImportHistoryScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: getSettingsData })
  const data = settingsQuery.data?.settings ?? null

  const [undoingImport, setUndoingImport] = useState(false)
  const [undoImportDialogOpen, setUndoImportDialogOpen] = useState(false)
  const [latestCompletedImport, setLatestCompletedImport] = useState<ImportSession | null>(null)
  const [latestCompletedImportCount, setLatestCompletedImportCount] = useState(0)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)

  async function handleUndoLastImport() {
    setUndoingImport(true)
    try {
      const latest = await getLatestCompletedImportSession()
      if (!latest) {
        setMessageDialog({
          title: 'No import to undo',
          message: 'There is no completed statement import available to undo.',
        })
        return
      }
      const count = await countTransactionsForImportSession(latest.id)
      setLatestCompletedImport(latest)
      setLatestCompletedImportCount(count)
      setUndoImportDialogOpen(true)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not prepare the last import for undo.' })
    } finally {
      setUndoingImport(false)
    }
  }

  async function confirmUndoLastImport() {
    setUndoingImport(true)
    try {
      const deleted = await undoLatestCompletedImport()
      invalidateTransactionData(queryClient)
      setUndoImportDialogOpen(false)
      setLatestCompletedImport(null)
      setLatestCompletedImportCount(0)
      setMessageDialog({
        title: deleted > 0 ? 'Last import undone' : 'No imported transactions found',
        message: deleted > 0
          ? `${deleted} imported transaction${deleted !== 1 ? 's' : ''} removed.`
          : 'The latest completed import had no transactions to remove.',
      })
    } catch {
      setUndoImportDialogOpen(false)
      setMessageDialog({ title: 'Error', message: 'Could not undo the last import.' })
    } finally {
      setUndoingImport(false)
    }
  }

  const importHistory = data?.importHistory ?? []

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.header, { paddingTop: insets.top + 14 }]}>
          <Pressable style={s.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18 9 12l6-6" />
            </Svg>
          </Pressable>
          <Text style={s.title}>Import History</Text>
        </View>

        {settingsQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <View style={s.body}>
            <View style={s.card}>
              {importHistory.length === 0 ? (
                <View style={s.emptyRow}>
                  <Text style={s.emptyTitle}>No imports yet</Text>
                  <Text style={s.emptyText}>Imported bank statements will appear here once you upload one.</Text>
                </View>
              ) : (
                importHistory.map((item, idx) => (
                  <View key={item.id}>
                    {idx > 0 && <RowDivider />}
                    <Pressable
                      style={s.historyRow}
                      onPress={() => navigation.navigate('ImportDetails', { importSessionId: item.id })}
                    >
                      <View style={s.historyBody}>
                        <Text style={s.historyTitle} numberOfLines={1}>
                          {item.file_name || item.filename || 'Imported statement'}
                        </Text>
                        <Text style={s.historyMeta}>
                          {formatDateTime(item.updated_at ?? item.created_at)} · {item.transaction_count} tx · {item.duplicate_count} dup
                        </Text>
                        <Text style={s.historyMeta}>
                          Review: {item.review_status || 'Not started'} · Import: {item.status}
                        </Text>
                      </View>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Polyline points="9 18 15 12 9 6" />
                      </Svg>
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            <Pressable
              style={[s.actionBtn, undoingImport && s.disabled]}
              onPress={handleUndoLastImport}
              disabled={undoingImport}
            >
              <Text style={s.actionText}>{undoingImport ? 'Undoing…' : 'Undo Last Import'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Dialog
        visible={undoImportDialogOpen}
        onClose={() => { if (!undoingImport) setUndoImportDialogOpen(false) }}
        title="Undo last import?"
        message={`This will remove ${latestCompletedImportCount} transaction${latestCompletedImportCount !== 1 ? 's' : ''} from your last import${latestCompletedImport?.file_name ? ` (${latestCompletedImport.file_name})` : ''}.`}
        actions={[
          {
            label: 'Cancel',
            variant: 'secondary',
            onPress: () => setUndoImportDialogOpen(false),
            disabled: undoingImport,
          },
          {
            label: 'Undo Import',
            variant: 'destructive',
            onPress: confirmUndoLastImport,
            loading: undoingImport,
          },
        ]}
      />
      <MessageDialog dialog={messageDialog} onClose={() => setMessageDialog(null)} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingBottom: 12,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
  },
  title: { fontSize: 21, fontFamily: F.extrabold, color: C.ink },
  loading: { paddingTop: 80, alignItems: 'center' },
  body: { paddingHorizontal: 18, gap: 12, paddingBottom: 34 },
  card: {
    backgroundColor: C.surface, borderRadius: RADIUS,
    borderWidth: 1, borderColor: C.line, overflow: 'hidden',
  },
  emptyRow: { padding: 18, gap: 6 },
  emptyTitle: { fontSize: 14, fontFamily: F.bold, color: C.ink },
  emptyText: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 19 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  historyBody: { flex: 1, minWidth: 0, gap: 3 },
  historyTitle: { fontSize: 13.5, fontFamily: F.semibold, color: C.ink },
  historyMeta: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, lineHeight: 16 },
  actionBtn: {
    alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS,
    borderWidth: 1, borderColor: C.brand, backgroundColor: C.surface, paddingVertical: 13,
  },
  disabled: { opacity: 0.5 },
  actionText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
})
