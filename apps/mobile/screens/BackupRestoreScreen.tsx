import React, { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { setLastBackupMetadata } from '../repositories/settingsRepository'
import {
  BACKUP_SCHEMA_VERSION,
  generateBackupJson,
  restoreBackupJson,
  validateBackupJson,
} from '../repositories/backupRepository'
import { getSettingsData } from '../lib/data'
import { invalidateSettingsData, queryKeys } from '../lib/query'
import { Dialog, MessageDialog, type MessageDialogState } from '../components/Dialog'
import { useSetupReset } from '../navigation/setupContext'
import type { RootStackParamList } from '../navigation/types'
import { C, F, RADIUS } from '../lib/tokens'
import { haptics } from '../lib/haptics'
import { PressableScale } from '../components/PressableScale'

type Nav = NativeStackNavigationProp<RootStackParamList>

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value} numberOfLines={2}>{value}</Text>
    </View>
  )
}

function Divider() { return <View style={s.divider} /> }

export function BackupRestoreScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const queryClient = useQueryClient()
  const onSetupReset = useSetupReset()
  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: getSettingsData })
  const data = settingsQuery.data?.settings ?? null

  const [exportingBackup, setExportingBackup] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [pendingRestoreJson, setPendingRestoreJson] = useState<string | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [lastBackupSize, setLastBackupSize] = useState(0)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)

  const backupAt = lastBackupAt ?? data?.lastBackupAt ?? null
  const backupSize = lastBackupSize || data?.lastBackupSize || 0

  async function handleBackupExport() {
    setExportingBackup(true)
    try {
      const backup = await generateBackupJson()
      const createdAt = new Date().toISOString()
      await setLastBackupMetadata({ createdAt, sizeBytes: backup.length })
      setLastBackupAt(createdAt)
      setLastBackupSize(backup.length)
      invalidateSettingsData(queryClient)
      haptics.success()
      await Share.share({ message: backup, title: 'Paisa Buddy Backup' })
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not export backup.' })
    } finally {
      setExportingBackup(false)
    }
  }

  async function handleRestoreBackup() {
    setRestoringBackup(true)
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (result.canceled) return
      const json = new File(result.assets[0].uri).textSync()
      validateBackupJson(json)
      setPendingRestoreJson(json)
      haptics.warning()
      setRestoreDialogOpen(true)
    } catch (error) {
      setMessageDialog({
        title: 'Restore failed',
        message: error instanceof Error ? error.message : 'Could not read this backup file.',
      })
    } finally {
      setRestoringBackup(false)
    }
  }

  async function confirmRestoreBackup() {
    if (!pendingRestoreJson) return
    setRestoringBackup(true)
    try {
      await restoreBackupJson(pendingRestoreJson)
      queryClient.clear()
      setRestoreDialogOpen(false)
      setPendingRestoreJson(null)
      haptics.success()
      onSetupReset()
    } catch (error) {
      setRestoreDialogOpen(false)
      haptics.error()
      setMessageDialog({
        title: 'Restore failed',
        message: error instanceof Error ? error.message : 'Could not restore this backup.',
      })
    } finally {
      setRestoringBackup(false)
    }
  }

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.header, { paddingTop: insets.top + 14 }]}>
          <Pressable style={s.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18 9 12l6-6" />
            </Svg>
          </Pressable>
          <Text style={s.title}>Backup & Restore</Text>
        </View>

        {settingsQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <View style={s.body}>
            <View style={s.card}>
              <Row label="Last backup" value={formatDateTime(backupAt)} />
              <Divider />
              <Row label="Backup size" value={backupSize > 0 ? formatBytes(backupSize) : 'Not available'} />
              <Divider />
              <Row label="Schema version" value={BACKUP_SCHEMA_VERSION} />
            </View>

            <Text style={s.hint}>
              Backups include all transactions, accounts, categories, and settings. Store the backup file safely — it can be used to restore Paisa Buddy on any device.
            </Text>

            <PressableScale
              style={[s.actionBtn, exportingBackup && s.disabled]}
              onPress={handleBackupExport}
              disabled={exportingBackup}
              scale={0.97}
            >
              <Text style={s.actionText}>{exportingBackup ? 'Backing up…' : 'Backup Data'}</Text>
            </PressableScale>

            <PressableScale
              style={[s.actionBtn, restoringBackup && s.disabled]}
              onPress={handleRestoreBackup}
              disabled={restoringBackup}
              scale={0.97}
            >
              <Text style={s.actionText}>{restoringBackup ? 'Restoring…' : 'Restore Backup'}</Text>
            </PressableScale>
          </View>
        )}
      </ScrollView>

      <Dialog
        visible={restoreDialogOpen}
        onClose={() => { if (!restoringBackup) setRestoreDialogOpen(false) }}
        title="Restore backup?"
        message="This will replace current app data with the selected backup. This cannot be undone."
        actions={[
          {
            label: 'Cancel',
            variant: 'secondary',
            onPress: () => { setRestoreDialogOpen(false); setPendingRestoreJson(null) },
            disabled: restoringBackup,
          },
          {
            label: 'Restore Backup',
            variant: 'destructive',
            onPress: confirmRestoreBackup,
            loading: restoringBackup,
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
  row: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 14,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  label: { flex: 1, fontSize: 13, fontFamily: F.regular, color: C.ink3 },
  value: {
    maxWidth: '54%', textAlign: 'right',
    fontSize: 13, fontFamily: F.semibold, color: C.ink,
  },
  divider: { height: 1, backgroundColor: C.line },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, lineHeight: 18 },
  actionBtn: {
    alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS,
    borderWidth: 1, borderColor: C.brand, backgroundColor: C.surface, paddingVertical: 13,
  },
  disabled: { opacity: 0.5 },
  actionText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
})
