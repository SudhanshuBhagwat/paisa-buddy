import React, { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Polyline } from 'react-native-svg'
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
import {
  BackScreenHeader,
  Divider,
  ScreenBody,
  ScreenRoot,
  ScreenScroll,
  SurfaceCard,
} from '../components/ScreenPrimitives'

type Nav = NativeStackNavigationProp<RootStackParamList>

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
    <ScreenRoot>
      <ScreenScroll>
        <BackScreenHeader title="Import History" topInset={insets.top} onBack={() => navigation.goBack()} />

        {settingsQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <ScreenBody>
            <SurfaceCard>
              {importHistory.length === 0 ? (
                <View style={s.emptyRow}>
                  <Text style={s.emptyTitle}>No imports yet</Text>
                  <Text style={s.emptyText}>Imported bank statements will appear here once you upload one.</Text>
                </View>
              ) : (
                importHistory.map((item, idx) => (
                  <View key={item.id}>
                    {idx > 0 && <Divider />}
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
            </SurfaceCard>

            <Pressable
              style={[s.actionBtn, undoingImport && s.disabled]}
              onPress={handleUndoLastImport}
              disabled={undoingImport}
            >
              <Text style={s.actionText}>{undoingImport ? 'Undoing…' : 'Undo Last Import'}</Text>
            </Pressable>
          </ScreenBody>
        )}
      </ScreenScroll>

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
    </ScreenRoot>
  )
}

const s = StyleSheet.create({
  loading: { paddingTop: 80, alignItems: 'center' },
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
