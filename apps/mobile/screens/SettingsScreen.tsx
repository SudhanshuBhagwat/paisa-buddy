import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import Svg, { Path, Polyline } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  setDisplayName,
  setExpectedMonthlyIncome,
  addUpiId,
  removeUpiId,
  clearAllData,
  setLastBackupMetadata,
} from '../repositories/settingsRepository'
import { createCategory, deleteCategory } from '../repositories/categoryRepository'
import { updateLearnedMapping, forgetLearnedMapping, type LearnedMapping } from '../repositories/learnedMappingRepository'
import {
  countTransactionsForImportSession,
  getLatestCompletedImportSession,
  undoLatestCompletedImport,
  type ImportSession,
} from '../repositories/importRepository'
import { BACKUP_SCHEMA_VERSION, generateBackupJson, restoreBackupJson, validateBackupJson } from '../repositories/backupRepository'
import {
  generateExportCsv,
  getSettingsData,
  type SettingsData,
  type CategoryWithCount,
  type SettingsQueryData,
} from '../lib/data'
import { invalidateCategoryData, invalidateSettingsData, invalidateTransactionData, queryKeys } from '../lib/query'
import { normalizeUpiId } from '@paisa-buddy/shared/logic/upi'
import { C, F, RADIUS } from '../lib/tokens'
import { Dialog, MessageDialog, type MessageDialogState } from '../components/Dialog'
import { Sheet } from '../components/Sheet'
import { useSetupReset } from '../navigation/setupContext'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={sl.text}>{children}</Text>
}
const sl = StyleSheet.create({
  text: { fontSize: 10.5, fontFamily: F.bold, letterSpacing: 0.07 * 10, color: C.ink3, textTransform: 'uppercase', marginBottom: 8 },
})

function Card({ children }: { children: React.ReactNode }) {
  return <View style={card.wrap}>{children}</View>
}
const card = StyleSheet.create({
  wrap: { backgroundColor: C.surface, borderRadius: RADIUS, borderWidth: 1, borderColor: C.line, overflow: 'hidden', shadowColor: '#14281E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
})

function RowDivider() { return <View style={{ height: 1, backgroundColor: C.line }} /> }

const APP_VERSION = '1.0.0'
const DATABASE_VERSION = 7
const PARSER_VERSION = 'description-parser-v1'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  )
}

export function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const queryClient = useQueryClient()
  const onSetupReset = useSetupReset()
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: getSettingsData,
  })
  const data = settingsQuery.data?.settings ?? null

  // Profile
  const [nameInput, setNameInput] = useState('')
  const [nameSaved, setNameSaved] = useState(false)
  const [incomeInput, setIncomeInput] = useState('')
  const [incomeSaved, setIncomeSaved] = useState(false)

  // UPI
  const [newUpi, setNewUpi] = useState('')
  const [addingUpi, setAddingUpi] = useState(false)

  // Categories
  const [newCat, setNewCat] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [catSheetOpen, setCatSheetOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryWithCount | null>(null)
  const [deletingCategory, setDeletingCategory] = useState(false)
  const [merchantSheetOpen, setMerchantSheetOpen] = useState(false)
  const [editingMapping, setEditingMapping] = useState<LearnedMapping | null>(null)
  const [mappingNameInput, setMappingNameInput] = useState('')
  const [mappingCategoryInput, setMappingCategoryInput] = useState('')
  const [savingMapping, setSavingMapping] = useState(false)
  const [developerTapCount, setDeveloperTapCount] = useState(0)

  // Misc
  const [exporting, setExporting] = useState(false)
  const [exportingBackup, setExportingBackup] = useState(false)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [lastBackupSize, setLastBackupSize] = useState(0)
  const [restoringBackup, setRestoringBackup] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [pendingRestoreJson, setPendingRestoreJson] = useState<string | null>(null)
  const [undoingImport, setUndoingImport] = useState(false)
  const [undoImportDialogOpen, setUndoImportDialogOpen] = useState(false)
  const [latestCompletedImport, setLatestCompletedImport] = useState<ImportSession | null>(null)
  const [latestCompletedImportCount, setLatestCompletedImportCount] = useState(0)
  const [clearing, setClearing] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)

  useEffect(() => {
    if (!data) return
    setNameInput(data.displayName ?? '')
    setIncomeInput(data.expectedMonthlyIncome > 0 ? String(Math.round(data.expectedMonthlyIncome / 100)) : '')
  }, [data])

  async function handleSaveName() {
    const name = nameInput.trim()
    try {
      await setDisplayName(name || null)
      queryClient.setQueryData<SettingsQueryData>(queryKeys.settings, (prev) => (
        prev ? { ...prev, settings: { ...prev.settings, displayName: name || null } } : prev
      ))
      invalidateSettingsData(queryClient)
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 1500)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not save name.' })
    }
  }

  async function handleSaveIncome() {
    const rupees = parseInt(incomeInput.replace(/,/g, ''), 10)
    const paise = isNaN(rupees) || rupees < 0 ? 0 : rupees * 100
    try {
      await setExpectedMonthlyIncome(paise)
      queryClient.setQueryData<SettingsQueryData>(queryKeys.settings, (prev) => (
        prev ? { ...prev, settings: { ...prev.settings, expectedMonthlyIncome: paise } } : prev
      ))
      invalidateSettingsData(queryClient)
      setIncomeInput(paise > 0 ? String(rupees) : '')
      setIncomeSaved(true)
      setTimeout(() => setIncomeSaved(false), 1500)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not save income.' })
    }
  }

  async function handleAddUpi() {
    const id = normalizeUpiId(newUpi)
    if (!id) return
    setAddingUpi(true)
    try {
      await addUpiId(id)
      queryClient.setQueryData<SettingsQueryData>(queryKeys.settings, (prev) => (
        prev ? {
          ...prev,
          settings: {
            ...prev.settings,
            upiIds: prev.settings.upiIds.includes(id) ? prev.settings.upiIds : [...prev.settings.upiIds, id],
          },
        } : prev
      ))
      invalidateSettingsData(queryClient)
      setNewUpi('')
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not add UPI ID.' })
    } finally {
      setAddingUpi(false)
    }
  }

  async function handleRemoveUpi(id: string) {
    try {
      await removeUpiId(id)
      queryClient.setQueryData<SettingsQueryData>(queryKeys.settings, (prev) => (
        prev ? { ...prev, settings: { ...prev.settings, upiIds: prev.settings.upiIds.filter((u) => u !== id) } } : prev
      ))
      invalidateSettingsData(queryClient)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not remove UPI ID.' })
    }
  }

  function handleEditMapping(mapping: LearnedMapping) {
    setEditingMapping(mapping)
    setMappingNameInput(mapping.display_name ?? '')
    setMappingCategoryInput(mapping.category_id ?? '')
    setMerchantSheetOpen(true)
  }

  async function handleSaveMapping() {
    if (!editingMapping) return
    setSavingMapping(true)
    try {
      await updateLearnedMapping({
        id: editingMapping.id,
        displayName: mappingNameInput,
        categoryId: mappingCategoryInput,
      })
      invalidateSettingsData(queryClient)
      setMerchantSheetOpen(false)
      setEditingMapping(null)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not update this merchant.' })
    } finally {
      setSavingMapping(false)
    }
  }

  async function handleForgetMapping() {
    if (!editingMapping) return
    setSavingMapping(true)
    try {
      await forgetLearnedMapping(editingMapping.id)
      invalidateSettingsData(queryClient)
      setMerchantSheetOpen(false)
      setEditingMapping(null)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not forget this merchant.' })
    } finally {
      setSavingMapping(false)
    }
  }

  async function handleAddCategory() {
    const name = newCat.trim()
    if (!name) return
    setAddingCat(true)
    try {
      const { name: n, color } = await createCategory(name)
      queryClient.setQueryData<SettingsQueryData>(queryKeys.settings, (prev) => (
        prev ? {
          ...prev,
          settings: {
            ...prev.settings,
            customCategories: [...prev.settings.customCategories, { name: n, color, transactionCount: 0 }],
          },
        } : prev
      ))
      invalidateCategoryData(queryClient)
      setNewCat('')
    } catch {
      setCatSheetOpen(false)
      setMessageDialog({ title: 'Error', message: 'Could not add category.' })
    } finally {
      setAddingCat(false)
    }
  }

  function handleRemoveCategory(cat: CategoryWithCount) {
    setCategoryToDelete(cat)
  }

  async function confirmRemoveCategory() {
    if (!categoryToDelete) return
    setDeletingCategory(true)
    try {
      await deleteCategory(categoryToDelete.name, categoryToDelete.transactionCount > 0)
      queryClient.setQueryData<SettingsQueryData>(queryKeys.settings, (prev) => (
        prev ? {
          ...prev,
          settings: {
            ...prev.settings,
            customCategories: prev.settings.customCategories.filter((c) => c.name !== categoryToDelete.name),
          },
        } : prev
      ))
      invalidateCategoryData(queryClient)
      setCatSheetOpen(false)
      setNewCat('')
      setCategoryToDelete(null)
    } catch {
      setCategoryToDelete(null)
      setMessageDialog({ title: 'Error', message: 'Could not remove category.' })
    } finally {
      setDeletingCategory(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const csv = await generateExportCsv()
      await Share.share({ message: csv, title: 'Paisa Buddy Export' })
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not export data.' })
    } finally {
      setExporting(false)
    }
  }

  async function handleDownloadCsvTemplate() {
    const template = 'Date,Description,Amount,Type,Account\n2026-06-01,Example merchant,250.00,debit,HDFC Bank'
    await Share.share({ title: 'Paisa Buddy CSV Import Template', message: template })
  }

  async function handleDownloadExcelTemplate() {
    const template = [
      '<?xml version="1.0"?>',
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet">',
      '<Worksheet ss:Name="Import Template" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
      '<Table>',
      '<Row><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Description</Data></Cell><Cell><Data ss:Type="String">Amount</Data></Cell><Cell><Data ss:Type="String">Type</Data></Cell><Cell><Data ss:Type="String">Account</Data></Cell></Row>',
      '<Row><Cell><Data ss:Type="String">2026-06-01</Data></Cell><Cell><Data ss:Type="String">Example merchant</Data></Cell><Cell><Data ss:Type="Number">250.00</Data></Cell><Cell><Data ss:Type="String">debit</Data></Cell><Cell><Data ss:Type="String">HDFC Bank</Data></Cell></Row>',
      '</Table></Worksheet></Workbook>',
    ].join('')
    await Share.share({ title: 'Paisa Buddy Excel Import Template', message: template })
  }

  function handleDeveloperTap() {
    const next = developerTapCount + 1
    if (next >= 5) {
      setDeveloperTapCount(0)
      navigation.navigate('DeveloperMode')
      return
    }
    setDeveloperTapCount(next)
  }

  async function handleBackupExport() {
    setExportingBackup(true)
    try {
      const backup = await generateBackupJson()
      const createdAt = new Date().toISOString()
      await setLastBackupMetadata({ createdAt, sizeBytes: backup.length })
      setLastBackupAt(createdAt)
      setLastBackupSize(backup.length)
      invalidateSettingsData(queryClient)
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
      onSetupReset()
    } catch (error) {
      setRestoreDialogOpen(false)
      setMessageDialog({
        title: 'Restore failed',
        message: error instanceof Error ? error.message : 'Could not restore this backup.',
      })
    } finally {
      setRestoringBackup(false)
    }
  }

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

  function handleClearAll() {
    setClearDialogOpen(true)
  }

  async function confirmClearAll() {
    setClearing(true)
    try {
      await clearAllData()
      queryClient.clear()
      setClearDialogOpen(false)
      onSetupReset()
    } catch {
      setClearDialogOpen(false)
      setMessageDialog({ title: 'Error', message: 'Could not reset data.' })
      setClearing(false)
    }
  }

  const initials = nameInput.trim()
    ? nameInput.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    : '?'

  const incomeDisplay = incomeInput
    ? Number(incomeInput.replace(/,/g, '')).toLocaleString('en-IN')
    : ''

  const totalCatCount = (data?.predefinedCategories ?? []).length + (data?.customCategories ?? []).length
  const customCats = data?.customCategories ?? []
  const predefinedCats = data?.predefinedCategories ?? []
  const learnedMappings = data?.learnedMappings ?? []
  const estimatedBackupSize = formatBytes(JSON.stringify(data ?? {}).length)
  const latestImport = data?.latestImport ?? null
  const backupAt = lastBackupAt ?? data?.lastBackupAt ?? null
  const backupSize = lastBackupSize || data?.lastBackupSize || 0

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={s.title}>Settings</Text>
        </View>

        {settingsQuery.isLoading ? (
          <View style={s.loadingWrap}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <View style={s.body}>

            {/* ── Profile ── */}
            <View style={s.section}>
              <SectionLabel>Profile</SectionLabel>
              <Card>
                <View style={s.profileRow}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.nameRow}>
                      <TextInput
                        style={s.nameInput}
                        value={nameInput}
                        onChangeText={setNameInput}
                        onBlur={handleSaveName}
                        placeholder="Your name"
                        placeholderTextColor={C.ink3}
                        returnKeyType="done"
                        onSubmitEditing={handleSaveName}
                      />
                      {nameSaved && <Text style={s.savedBadge}>Saved</Text>}
                    </View>
                  </View>
                </View>
              </Card>
              <Text style={s.hint}>Your name helps identify you as sender or receiver in uploaded receipts.</Text>
            </View>

            {/* ── Recognition ── */}
            <View style={s.section}>
              <SectionLabel>Recognition</SectionLabel>

              {/* UPI IDs */}
              <Card>
                {(data?.upiIds ?? []).length === 0 ? (
                  <View style={s.emptyRow}><Text style={s.emptyRowText}>No UPI IDs added yet</Text></View>
                ) : (
                  (data?.upiIds ?? []).map((id, idx) => (
                    <View key={id}>
                      <View style={s.upiRow}>
                        <Text style={s.upiId} numberOfLines={1}>{id}</Text>
                        <Pressable onPress={() => handleRemoveUpi(id)} hitSlop={8}>
                          <Text style={s.removeText}>Remove</Text>
                        </Pressable>
                      </View>
                      {idx < (data?.upiIds ?? []).length - 1 && <RowDivider />}
                    </View>
                  ))
                )}
                <RowDivider />
                <View style={[s.addRow, { paddingVertical: 14 }]}>
                  <TextInput
                    style={s.addInput}
                    value={newUpi}
                    onChangeText={setNewUpi}
                    placeholder="yourname@upi"
                    placeholderTextColor={C.ink3}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onSubmitEditing={handleAddUpi}
                    returnKeyType="done"
                  />
                  <Pressable onPress={handleAddUpi} disabled={!newUpi.trim() || addingUpi} hitSlop={8}>
                    {addingUpi
                      ? <ActivityIndicator size="small" color={C.brand} />
                      : <Text style={[s.addActionText, !newUpi.trim() && { opacity: 0.35 }]}>Add</Text>}
                  </Pressable>
                </View>
              </Card>
              <Text style={s.hint}>Your UPI IDs help identify debit vs credit direction in uploaded receipts.</Text>

              {/* Known Merchants */}
              <Text style={[s.subLabel, { marginTop: 14 }]}>Known Merchants</Text>
              <Card>
                {learnedMappings.length === 0 ? (
                  <View style={s.emptyRow}>
                    <Text style={s.emptyRowText}>No known merchants yet</Text>
                    <Text style={s.emptyRowSub}>Merchants appear here after you confirm or edit imported transactions.</Text>
                  </View>
                ) : (
                  learnedMappings.map((mapping, idx) => (
                    <View key={mapping.id}>
                      {idx > 0 && <RowDivider />}
                      <Pressable style={s.mappingRow} onPress={() => handleEditMapping(mapping)}>
                        <View style={s.mappingBody}>
                          <Text style={s.mappingName} numberOfLines={1}>
                            {mapping.display_name || mapping.normalized_lookup_key}
                          </Text>
                          <Text style={s.mappingMeta} numberOfLines={1}>
                            Parsed: {mapping.normalized_lookup_key}
                          </Text>
                        </View>
                        <View style={s.mappingRight}>
                          <Text style={s.mappingCategory} numberOfLines={1}>{mapping.category_id || 'Uncategorized'}</Text>
                          <Text style={s.mappingCount}>{mapping.usage_count} use{mapping.usage_count !== 1 ? 's' : ''}</Text>
                        </View>
                      </Pressable>
                    </View>
                  ))
                )}
              </Card>
            </View>

            {/* ── Income ── */}
            <View style={s.section}>
              <SectionLabel>Income</SectionLabel>
              <Card>
                <View style={[s.addRow, { paddingVertical: 14 }]}>
                  <Text style={s.rupeeLabel}>₹</Text>
                  <TextInput
                    style={[s.addInput, { fontFamily: F.regular }]}
                    value={incomeDisplay}
                    onChangeText={(t) => setIncomeInput(t.replace(/[^0-9]/g, ''))}
                    onBlur={handleSaveIncome}
                    onSubmitEditing={handleSaveIncome}
                    placeholder="Monthly salary (e.g. 85,000)"
                    placeholderTextColor={C.ink3}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                  {incomeSaved && <Text style={s.savedBadge}>Saved</Text>}
                </View>
              </Card>
              <Text style={s.hint}>Your expected monthly income. Used to track how much of your salary has been spent.</Text>
            </View>

            {/* ── Categories ── */}
            <View style={s.section}>
              <SectionLabel>Categories</SectionLabel>
              <Card>
                <Pressable style={s.summaryRow} onPress={() => setCatSheetOpen(true)}>
                  <View style={s.summaryRowBody}>
                    <Text style={s.summaryRowTitle}>
                      {totalCatCount} Categor{totalCatCount !== 1 ? 'ies' : 'y'}
                    </Text>
                    {customCats.length > 0 && (
                      <Text style={s.summaryRowSub}>{customCats.length} custom</Text>
                    )}
                  </View>
                  <Text style={s.summaryRowCta}>Manage</Text>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <Polyline points="9 18 15 12 9 6" />
                  </Svg>
                </Pressable>
              </Card>
            </View>

            {/* ── Data & Privacy ── */}
            <View style={s.section}>
              <SectionLabel>Data & Privacy</SectionLabel>

              {/* Transaction count */}
              <Card>
                <InfoRow label="Storage Used" value={estimatedBackupSize} />
                <RowDivider />
                <InfoRow label="Database Size" value={estimatedBackupSize} />
                <RowDivider />
                <InfoRow label="Transaction Count" value={data?.txCount ?? 0} />
                <RowDivider />
                <InfoRow label="Account Count" value={data?.accountCount ?? 0} />
                <RowDivider />
                <InfoRow label="Category Count" value={data?.categoryCount ?? 0} />
              </Card>
              <Text style={s.hint}>Your financial data is stored locally on this device.</Text>

              {/* Actions */}
              <View style={[s.dataActions, { marginTop: 10 }]}>
                <Pressable style={s.exportBtn} onPress={handleExport} disabled={exporting}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <Polyline points="7 10 12 15 17 10" />
                    <Path d="M12 15V3" />
                  </Svg>
                  <Text style={s.exportText}>{exporting ? 'Exporting…' : 'Export to CSV'}</Text>
                </Pressable>
              </View>
            </View>

            {/* ── Danger Zone ── */}
              <View style={s.section}>
                <SectionLabel>Backup</SectionLabel>
                <Card>
                  <InfoRow label="Last Backup" value={formatDateTime(backupAt)} />
                  <RowDivider />
                  <InfoRow label="Backup Size" value={backupSize > 0 ? formatBytes(backupSize) : 'Not available'} />
                  <RowDivider />
                  <InfoRow label="Schema Version" value={BACKUP_SCHEMA_VERSION} />
                </Card>
                <View style={[s.dataActions, { marginTop: 10 }]}>
                  <Pressable style={s.exportBtn} onPress={handleBackupExport} disabled={exportingBackup}>
                    <Text style={s.exportText}>{exportingBackup ? 'Backing up...' : 'Backup Data'}</Text>
                  </Pressable>
                  <Pressable style={s.exportBtn} onPress={handleRestoreBackup} disabled={restoringBackup}>
                    <Text style={s.exportText}>{restoringBackup ? 'Restoring...' : 'Restore Backup'}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={s.section}>
                <SectionLabel>Import</SectionLabel>
                <Card>
                  {(data?.importHistory ?? []).length === 0 ? (
                    <View style={s.emptyRow}>
                      <Text style={s.emptyRowText}>No imports yet</Text>
                      <Text style={s.emptyRowSub}>Imported statements will appear here with review and duplicate status.</Text>
                    </View>
                  ) : (
                    (data?.importHistory ?? []).map((item, idx) => (
                      <View key={item.id}>
                        {idx > 0 && <RowDivider />}
                        <Pressable style={s.importHistoryRow} onPress={() => navigation.navigate('ImportDetails', { importSessionId: item.id })}>
                          <View style={s.importHistoryBody}>
                            <Text style={s.importHistoryTitle} numberOfLines={1}>{item.file_name || item.filename || 'Imported statement'}</Text>
                            <Text style={s.importHistoryMeta}>
                              {formatDateTime(item.updated_at ?? item.created_at)} · {item.transaction_count} tx · {item.duplicate_count} dup
                            </Text>
                            <Text style={s.importHistoryMeta}>Review: {item.review_status || 'Not started'} · Import: {item.status}</Text>
                          </View>
                          <Text style={s.summaryRowCta}>Details</Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                </Card>
                <View style={[s.dataActions, { marginTop: 10 }]}>
                  <Pressable style={s.exportBtn} onPress={handleUndoLastImport} disabled={undoingImport}>
                    <Text style={s.exportText}>{undoingImport ? 'Undoing...' : 'Undo Last Import'}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={s.section}>
                <SectionLabel>Spreadsheet Template</SectionLabel>
                <Card>
                  <View style={s.templateRow}>
                    <View style={s.summaryRowBody}>
                      <Text style={s.summaryRowTitle}>Download Import Template</Text>
                      <Text style={s.summaryRowSub}>Columns: Date, Description, Amount, Type, Account</Text>
                    </View>
                  </View>
                </Card>
                <View style={[s.dataActions, { marginTop: 10 }]}>
                  <Pressable style={s.exportBtn} onPress={handleDownloadExcelTemplate}>
                    <Text style={s.exportText}>Excel Template</Text>
                  </Pressable>
                  <Pressable style={s.exportBtn} onPress={handleDownloadCsvTemplate}>
                    <Text style={s.exportText}>CSV Template</Text>
                  </Pressable>
                </View>
              </View>

              <View style={s.section}>
                <SectionLabel>About</SectionLabel>
                <Card>
                  <Pressable style={s.infoRow} onPress={handleDeveloperTap}>
                    <Text style={s.infoLabel}>App Version</Text>
                    <Text style={s.infoValue}>{APP_VERSION}</Text>
                  </Pressable>
                  <RowDivider />
                  <InfoRow label="Database Version" value={DATABASE_VERSION} />
                  <RowDivider />
                  <InfoRow label="Parser Version" value={PARSER_VERSION} />
                  <RowDivider />
                  <InfoRow label="Privacy Summary" value="Your financial data is stored locally on this device." />
                </Card>
              </View>

              <View style={s.section}>
                <SectionLabel>Danger Zone</SectionLabel>
              <View style={s.dataActions}>
                <Pressable style={s.dangerBtn} onPress={handleClearAll} disabled={clearing}>
                  <Text style={s.dangerText}>{clearing ? 'Clearing…' : 'Clear All Data'}</Text>
                </Pressable>
              </View>
            </View>

          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Dialog
        visible={clearDialogOpen}
        onClose={() => {
          if (!clearing) setClearDialogOpen(false)
        }}
        title="Reset all data?"
        message="This will permanently delete all your transactions, accounts, and settings, and restart the app setup. This cannot be undone."
        actions={[
          {
            label: 'Cancel',
            variant: 'secondary',
            onPress: () => setClearDialogOpen(false),
            disabled: clearing,
          },
          {
            label: 'Reset & Start Over',
            variant: 'destructive',
            onPress: confirmClearAll,
            loading: clearing,
          },
        ]}
      />

      <Dialog
        visible={undoImportDialogOpen}
        onClose={() => {
          if (!undoingImport) setUndoImportDialogOpen(false)
        }}
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

      <Dialog
        visible={restoreDialogOpen}
        onClose={() => {
          if (!restoringBackup) setRestoreDialogOpen(false)
        }}
        title="Restore backup?"
        message="This will replace current app data with the selected backup. This cannot be undone."
        actions={[
          {
            label: 'Cancel',
            variant: 'secondary',
            onPress: () => {
              setRestoreDialogOpen(false)
              setPendingRestoreJson(null)
            },
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

      <MessageDialog
        dialog={messageDialog}
        onClose={() => setMessageDialog(null)}
      />

      {/* ── Category Management Sheet ── */}
      <Sheet
        visible={merchantSheetOpen}
        onClose={() => {
          if (!savingMapping) {
            setMerchantSheetOpen(false)
            setEditingMapping(null)
          }
        }}
        heightFraction={0.74}
        header={(
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Known Merchant</Text>
            <Pressable onPress={() => { setMerchantSheetOpen(false); setEditingMapping(null) }} hitSlop={8}>
              <Text style={s.sheetDone}>Done</Text>
            </Pressable>
          </View>
        )}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.sheetContent}
        >
          {editingMapping ? (
            <>
              <View style={s.sheetSection}>
                <Text style={s.sheetSectionLabel}>PARSED NAME</Text>
                <Card>
                  <View style={s.emptyRow}>
                    <Text style={s.mappingMeta}>{editingMapping.normalized_lookup_key}</Text>
                  </View>
                </Card>
              </View>

              <View style={s.sheetSection}>
                <Text style={s.sheetSectionLabel}>DISPLAY NAME</Text>
                <Card>
                  <View style={[s.addRow, { paddingVertical: 14 }]}>
                    <TextInput
                      style={[s.addInput, { fontFamily: F.regular }]}
                      value={mappingNameInput}
                      onChangeText={setMappingNameInput}
                      placeholder="Merchant display name"
                      placeholderTextColor={C.ink3}
                      returnKeyType="done"
                    />
                  </View>
                </Card>
              </View>

              <View style={s.sheetSection}>
                <Text style={s.sheetSectionLabel}>DEFAULT CATEGORY</Text>
                <View style={s.predefined}>
                  {[...predefinedCats, ...customCats].map((cat) => {
                    const selected = mappingCategoryInput === cat.name
                    return (
                      <Pressable
                        key={cat.name}
                        style={[s.predChip, selected && s.predChipSelected]}
                        onPress={() => setMappingCategoryInput(cat.name)}
                      >
                        <Text style={[s.predChipText, selected && s.predChipTextSelected]}>{cat.name}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>

              <View style={s.sheetSection}>
                <Pressable style={s.exportBtn} onPress={handleSaveMapping} disabled={savingMapping}>
                  <Text style={s.exportText}>{savingMapping ? 'Saving...' : 'Save Merchant'}</Text>
                </Pressable>
                <Pressable style={[s.dangerBtn, { marginTop: 10 }]} onPress={handleForgetMapping} disabled={savingMapping}>
                  <Text style={s.dangerText}>Forget Mapping</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </Sheet>

      <Sheet
        visible={catSheetOpen}
        onClose={() => { setCatSheetOpen(false); setNewCat('') }}
        heightFraction={0.82}
        header={(
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Categories</Text>
            <Pressable onPress={() => { setCatSheetOpen(false); setNewCat('') }} hitSlop={8}>
              <Text style={s.sheetDone}>Done</Text>
            </Pressable>
          </View>
        )}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.sheetContent}
        >
          {/* Add category */}
          <View style={s.sheetSection}>
            <Text style={s.sheetSectionLabel}>ADD CATEGORY</Text>
            <Card>
              <View style={[s.addRow, { paddingVertical: 14 }]}>
                <TextInput
                  style={s.addInput}
                  value={newCat}
                  onChangeText={setNewCat}
                  placeholder="Category name..."
                  placeholderTextColor={C.ink3}
                  onSubmitEditing={handleAddCategory}
                  returnKeyType="done"
                />
                <Pressable onPress={handleAddCategory} disabled={!newCat.trim() || addingCat} hitSlop={8}>
                  {addingCat
                    ? <ActivityIndicator size="small" color={C.brand} />
                    : <Text style={[s.addActionText, !newCat.trim() && { opacity: 0.35 }]}>Add</Text>}
                </Pressable>
              </View>
            </Card>
          </View>

          {/* Custom categories */}
          {customCats.length > 0 && (
            <View style={s.sheetSection}>
              <Text style={s.sheetSectionLabel}>CUSTOM</Text>
              <Card>
                {customCats.map((cat, idx) => (
                  <View key={cat.name}>
                    {idx > 0 && <RowDivider />}
                    <View style={s.catRow}>
                      <View style={[s.catDot, { backgroundColor: cat.color }]} />
                      <View style={s.catNameGroup}>
                        <Text style={s.catName} numberOfLines={1}>{cat.name}</Text>
                        {cat.transactionCount > 0 && (
                          <View style={s.catBadge}>
                            <Text style={s.catBadgeText}>{cat.transactionCount} transaction{cat.transactionCount !== 1 ? 's' : ''}</Text>
                          </View>
                        )}
                      </View>
                      <Pressable onPress={() => handleRemoveCategory(cat)} hitSlop={8}>
                        <Text style={s.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {/* Predefined categories */}
          {predefinedCats.length > 0 && (
            <View style={s.sheetSection}>
              <Text style={s.sheetSectionLabel}>BUILT-IN</Text>
              <View style={s.predefined}>
                {predefinedCats.map(({ name, transactionCount }) => (
                  <View key={name} style={s.predChip}>
                    <Text style={s.predChipText}>{name}</Text>
                    {transactionCount > 0 && <Text style={s.predChipCount}>{transactionCount}</Text>}
                  </View>
                ))}
              </View>
              <Text style={s.hint}>Built-in categories cannot be removed.</Text>
            </View>
          )}
        </ScrollView>

        <Dialog
          visible={!!categoryToDelete}
          onClose={() => { if (!deletingCategory) setCategoryToDelete(null) }}
          title={categoryToDelete ? `Delete "${categoryToDelete.name}"?` : 'Delete category?'}
          message={categoryToDelete && categoryToDelete.transactionCount > 0
            ? `${categoryToDelete.transactionCount} transaction${categoryToDelete.transactionCount !== 1 ? 's' : ''} use this category. Their category will be cleared.`
            : 'This cannot be undone.'}
          actions={[
            { label: 'Cancel', variant: 'secondary', onPress: () => setCategoryToDelete(null), disabled: deletingCategory },
            { label: 'Delete', variant: 'destructive', onPress: confirmRemoveCategory, loading: deletingCategory },
          ]}
        />
      </Sheet>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 10 },
  title: { fontSize: 23, fontFamily: F.extrabold, color: C.ink },
  loadingWrap: { paddingTop: 80, alignItems: 'center' },
  body: { paddingHorizontal: 18, paddingTop: 4, gap: 0 },
  section: { marginBottom: 22 },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, marginTop: 6, lineHeight: 18 },
  subLabel: { fontSize: 11, fontFamily: F.bold, color: C.ink3, letterSpacing: 0.5, marginBottom: 6 },

  // Profile
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.brandPale,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontFamily: F.extrabold, color: C.brand },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameInput: { flex: 1, fontSize: 16, fontFamily: F.bold, color: C.ink, padding: 0 },
  savedBadge: { fontSize: 11.5, fontFamily: F.semibold, color: C.pos, flexShrink: 0 },

  // Recognition empty state
  emptyRow: { padding: 14, gap: 3 },
  emptyRowText: { fontSize: 13, fontFamily: F.regular, color: C.ink3 },
  emptyRowSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, lineHeight: 17 },
  mappingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  mappingBody: { flex: 1, minWidth: 0, gap: 2 },
  mappingName: { fontSize: 13.5, fontFamily: F.semibold, color: C.ink },
  mappingMeta: { fontSize: 11, fontFamily: F.mono, color: C.ink3 },
  mappingRight: { alignItems: 'flex-end', gap: 2, maxWidth: '42%' },
  mappingCategory: { fontSize: 12.5, fontFamily: F.bold, color: C.brand },
  mappingCount: { fontSize: 11, fontFamily: F.regular, color: C.ink3 },
  importHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  importHistoryBody: { flex: 1, minWidth: 0, gap: 3 },
  importHistoryTitle: { fontSize: 13.5, fontFamily: F.semibold, color: C.ink },
  importHistoryMeta: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, lineHeight: 16 },
  templateRow: { paddingHorizontal: 16, paddingVertical: 14 },

  // UPI / shared row patterns
  upiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, paddingHorizontal: 16 },
  upiId: { flex: 1, fontSize: 13, fontFamily: F.mono, color: C.ink },
  removeText: { fontSize: 12, fontFamily: F.semibold, color: C.neg },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 16 },
  addInput: { flex: 1, fontSize: 13, fontFamily: F.mono, color: C.ink, padding: 0 },
  addActionText: { fontSize: 12.5, fontFamily: F.bold, color: C.brand },
  rupeeLabel: { fontSize: 14, fontFamily: F.semibold, color: C.ink3, flexShrink: 0 },

  // Categories summary row
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  summaryRowBody: { flex: 1, gap: 2 },
  summaryRowTitle: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  summaryRowSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  summaryRowCta: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  infoLabel: { flex: 1, fontSize: 13, fontFamily: F.regular, color: C.ink3 },
  infoValue: { maxWidth: '54%', textAlign: 'right', fontSize: 13, fontFamily: F.semibold, color: C.ink },

  // Data & Privacy
  txCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, padding: 16 },
  txCountNum: { fontSize: 22, fontFamily: F.extrabold, color: C.ink },
  txCountLabel: { fontSize: 13, fontFamily: F.regular, color: C.ink3 },
  dataActions: { gap: 10 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: RADIUS,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.brand,
  },
  exportText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  disabledBtn: { borderColor: C.line, opacity: 0.5 },
  disabledBtnText: { fontSize: 14, fontFamily: F.semibold, color: C.ink3 },
  comingSoonBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  comingSoonText: { fontSize: 10, fontFamily: F.bold, color: C.ink3 },

  // Danger Zone
  dangerBtn: {
    paddingVertical: 13, borderRadius: RADIUS,
    alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.neg,
  },
  dangerText: { fontSize: 14, fontFamily: F.semibold, color: C.neg },

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, paddingHorizontal: 16 },
  catDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  catNameGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  catName: { fontSize: 14, fontFamily: F.regular, color: C.ink, flexShrink: 1 },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  catBadgeText: { fontSize: 11, fontFamily: F.regular, color: C.ink3 },
  predefined: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  predChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  predChipSelected: { borderColor: C.brand, backgroundColor: C.brandPale },
  predChipText: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  predChipTextSelected: { fontFamily: F.bold, color: C.brandDeep },
  predChipCount: { fontSize: 12, fontFamily: F.bold, color: C.ink },

  // Category sheet
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  sheetTitle: { fontSize: 17, fontFamily: F.extrabold, color: C.ink },
  sheetDone: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 0 },
  sheetSection: { marginBottom: 20 },
  sheetSectionLabel: { fontSize: 10.5, fontFamily: F.bold, letterSpacing: 0.07 * 10, color: C.ink3, textTransform: 'uppercase', marginBottom: 8 },
})
