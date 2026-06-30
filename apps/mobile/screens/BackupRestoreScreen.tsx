import React, { useState } from 'react'
import {
  ActivityIndicator,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
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
import {
  BackScreenHeader,
  Divider,
  InfoRow,
  ScreenBody,
  ScreenRoot,
  ScreenScroll,
  SurfaceCard,
} from '../components/ScreenPrimitives'

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

export function BackupRestoreScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const queryClient = useQueryClient()
  const onSetupReset = useSetupReset()
  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: getSettingsData })
  const data = settingsQuery.data?.settings ?? null

  const [exportingBackup, setExportingBackup] = useState(false)
  const [exportWarningOpen, setExportWarningOpen] = useState(false)
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
    <ScreenRoot>
      <ScreenScroll>
        <BackScreenHeader title="Backup & Restore" topInset={insets.top} onBack={() => navigation.goBack()} />

        {settingsQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <ScreenBody>
            <SurfaceCard>
              <InfoRow label="Last backup" value={formatDateTime(backupAt)} valueLines={2} />
              <Divider />
              <InfoRow label="Backup size" value={backupSize > 0 ? formatBytes(backupSize) : 'Not available'} valueLines={2} />
              <Divider />
              <InfoRow label="Schema version" value={BACKUP_SCHEMA_VERSION} valueLines={2} />
            </SurfaceCard>

            <Text style={s.hint}>
              Backups include all transactions, accounts, categories, and settings. Store the backup file safely — it can be used to restore Paisa Buddy on any device.
            </Text>

            <PressableScale
              style={[s.actionBtn, exportingBackup && s.disabled]}
              onPress={() => setExportWarningOpen(true)}
              disabled={exportingBackup}
              scale={0.97}
              accessibilityLabel="Backup Data"
            >
              <Text style={s.actionText}>{exportingBackup ? 'Backing up…' : 'Backup Data'}</Text>
            </PressableScale>

            <PressableScale
              style={[s.actionBtn, restoringBackup && s.disabled]}
              onPress={handleRestoreBackup}
              disabled={restoringBackup}
              scale={0.97}
              accessibilityLabel="Restore Backup"
            >
              <Text style={s.actionText}>{restoringBackup ? 'Restoring…' : 'Restore Backup'}</Text>
            </PressableScale>
          </ScreenBody>
        )}
      </ScreenScroll>

      <Dialog
        visible={exportWarningOpen}
        onClose={() => setExportWarningOpen(false)}
        title="Export backup?"
        message="This backup contains your full financial data. Store it somewhere safe and do not share it publicly."
        actions={[
          {
            label: 'Cancel',
            variant: 'secondary',
            onPress: () => setExportWarningOpen(false),
          },
          {
            label: 'Export Backup',
            onPress: () => { setExportWarningOpen(false); void handleBackupExport() },
          },
        ]}
      />
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
    </ScreenRoot>
  )
}

const s = StyleSheet.create({
  loading: { paddingTop: 80, alignItems: 'center' },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, lineHeight: 18 },
  actionBtn: {
    alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS,
    borderWidth: 1, borderColor: C.brand, backgroundColor: C.surface, paddingVertical: 13,
  },
  disabled: { opacity: 0.5 },
  actionText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
})
