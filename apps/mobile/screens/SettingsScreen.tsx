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
} from '../repositories/settingsRepository'
import { createCategory, deleteCategory, updateCategoryIcon } from '../repositories/categoryRepository'
import { updateLearnedMapping, forgetLearnedMapping, type LearnedMapping } from '../repositories/learnedMappingRepository'
import {
  generateExportCsv,
  getSettingsData,
  type CategoryWithCount,
  type SettingsQueryData,
} from '../lib/data'
import { invalidateCategoryData, invalidateSettingsData, queryKeys } from '../lib/query'
import { normalizeUpiId } from '@paisa-buddy/shared/logic/upi'
import { C, F, RADIUS } from '../lib/tokens'
import { haptics } from '../lib/haptics'
import { CategoryIcon } from '../components/CategoryIcon'
import { CATEGORY_METADATA, DEFAULT_CATEGORY_ICON, DEFAULT_CATEGORY_COLOR, getCategoryIcon } from '../lib/categoryMetadata'
import { Dialog, MessageDialog, type MessageDialogState } from '../components/Dialog'
import { Sheet } from '../components/Sheet'
import { Divider, SectionLabel, SurfaceCard } from '../components/ScreenPrimitives'
import { useSetupReset } from '../navigation/setupContext'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

function Card({ children }: { children: React.ReactNode }) {
  return <SurfaceCard>{children}</SurfaceCard>
}

function RowDivider() { return <Divider /> }

function Chevron() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  )
}

const APP_VERSION = '1.0.0'

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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
  const [iconPickerCat, setIconPickerCat] = useState<CategoryWithCount | null>(null)
  const [newCatPickerOpen, setNewCatPickerOpen] = useState(false)
  const [newCatIcon, setNewCatIcon] = useState<string | null>(null)

  // Known Merchants
  const [merchantSheetOpen, setMerchantSheetOpen] = useState(false)
  const [editingMapping, setEditingMapping] = useState<LearnedMapping | null>(null)
  const [mappingNameInput, setMappingNameInput] = useState('')
  const [mappingCategoryInput, setMappingCategoryInput] = useState('')
  const [savingMapping, setSavingMapping] = useState(false)

  // Misc
  const [exporting, setExporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)
  const [developerTapCount, setDeveloperTapCount] = useState(0)

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
      if (newCatIcon) await updateCategoryIcon(n, newCatIcon)
      queryClient.setQueryData<SettingsQueryData>(queryKeys.settings, (prev) => (
        prev ? {
          ...prev,
          settings: {
            ...prev.settings,
            customCategories: [...prev.settings.customCategories, { name: n, color, icon: newCatIcon, transactionCount: 0 }],
          },
        } : prev
      ))
      invalidateCategoryData(queryClient)
      setNewCat('')
      setNewCatIcon(null)
      setNewCatPickerOpen(false)
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

  async function handleSetCategoryIcon(cat: CategoryWithCount, iconName: string | null) {
    try {
      await updateCategoryIcon(cat.name, iconName)
      queryClient.setQueryData<SettingsQueryData>(queryKeys.settings, (prev) => (
        prev ? {
          ...prev,
          settings: {
            ...prev.settings,
            customCategories: prev.settings.customCategories.map((c) =>
              c.name === cat.name ? { ...c, icon: iconName } : c
            ),
          },
        } : prev
      ))
      invalidateCategoryData(queryClient)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not update icon.' })
    } finally {
      setIconPickerCat(null)
    }
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

  function handleClearAll() {
    haptics.warning()
    setClearDialogOpen(true)
  }

  async function confirmClearAll() {
    setClearing(true)
    try {
      await clearAllData()
      queryClient.clear()
      setClearDialogOpen(false)
      haptics.error()
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

            {/* ── 1. Personal ── */}
            <View style={s.section}>
              <SectionLabel>Personal</SectionLabel>
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
                      {nameSaved && <Text style={s.savedBadge} numberOfLines={1}>Saved</Text>}
                    </View>
                  </View>
                </View>
              </Card>
              <View style={s.gap10} />
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
                  {incomeSaved && <Text style={s.savedBadge} numberOfLines={1}>Saved</Text>}
                </View>
              </Card>
              <Text style={s.hint}>Your name and monthly income are used to personalise summaries and track spending against salary.</Text>
            </View>

            {/* ── 2. Finance ── */}
            <View style={s.section}>
              <SectionLabel>Finance</SectionLabel>
              <Card>
                <Pressable style={s.summaryRow} onPress={() => setCatSheetOpen(true)}>
                  <View style={s.summaryRowBody}>
                    <Text style={s.summaryRowTitle}>Categories</Text>
                    <Text style={s.summaryRowSub}>
                      {totalCatCount} categor{totalCatCount !== 1 ? 'ies' : 'y'}
                      {customCats.length > 0 ? `, ${customCats.length} custom` : ''}
                    </Text>
                  </View>
                  <Chevron />
                </Pressable>
                <RowDivider />
                <Pressable
                  style={s.summaryRow}
                  onPress={() => { setEditingMapping(null); setMerchantSheetOpen(true) }}
                >
                  <View style={s.summaryRowBody}>
                    <Text style={s.summaryRowTitle}>Known Merchants</Text>
                    <Text style={s.summaryRowSub}>
                      {learnedMappings.length === 0
                        ? 'None learned yet'
                        : `${learnedMappings.length} merchant${learnedMappings.length !== 1 ? 's' : ''}`}
                    </Text>
                  </View>
                  <Chevron />
                </Pressable>
              </Card>
            </View>

            {/* ── 3. Import & Recognition ── */}
            <View style={s.section}>
              <SectionLabel>Import & Recognition</SectionLabel>

              {/* UPI IDs */}
              <Text style={s.subLabel}>UPI IDs</Text>
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

              {/* Import History */}
              <View style={s.gap14} />
              <Card>
                <Pressable style={s.summaryRow} onPress={() => navigation.navigate('ImportHistory')}>
                  <View style={s.summaryRowBody}>
                    <Text style={s.summaryRowTitle}>Import History</Text>
                    <Text style={s.summaryRowSub}>
                      {data?.importCount ?? 0} import{data?.importCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Chevron />
                </Pressable>
              </Card>

              {/* Download Templates */}
              <View style={s.gap14} />
              <Text style={s.subLabel}>Import Template</Text>
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

            {/* ── 4. Data & Privacy ── */}
            <View style={s.section}>
              <SectionLabel>Data & Privacy</SectionLabel>
              <Card>
                <Pressable style={s.summaryRow} onPress={() => navigation.navigate('BackupRestore')}>
                  <Text style={s.summaryRowTitle}>Backup & Restore</Text>
                  <Chevron />
                </Pressable>
                <RowDivider />
                <Pressable style={s.summaryRow} onPress={handleExport} disabled={exporting}>
                  <Text style={s.summaryRowTitle}>Export Transactions</Text>
                  {exporting
                    ? <ActivityIndicator size="small" color={C.brand} />
                    : <Chevron />}
                </Pressable>
                <RowDivider />
                <Pressable style={s.summaryRow} onPress={() => navigation.navigate('Storage')}>
                  <Text style={s.summaryRowTitle}>Storage</Text>
                  <Chevron />
                </Pressable>
                <RowDivider />
                <Pressable style={s.summaryRow} onPress={() => navigation.navigate('Privacy')}>
                  <Text style={s.summaryRowTitle}>Privacy</Text>
                  <Chevron />
                </Pressable>
              </Card>
            </View>

            {/* ── 5. About ── */}
            <View style={s.section}>
              <SectionLabel>About</SectionLabel>
              <Card>
                <Pressable style={s.infoRow} onPress={handleDeveloperTap}>
                  <Text style={s.infoLabel}>App Version</Text>
                  <Text style={s.infoValue}>{APP_VERSION}</Text>
                </Pressable>
                <RowDivider />
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Paisa Buddy</Text>
                  <Text style={[s.infoValue, { maxWidth: '60%' }]}>Your finances, offline and private.</Text>
                </View>
              </Card>
            </View>

            {/* ── 6. Danger Zone ── */}
            <View style={s.section}>
              <SectionLabel>Danger Zone</SectionLabel>
              <Pressable style={s.dangerBtn} onPress={handleClearAll} disabled={clearing}>
                <Text style={s.dangerText}>{clearing ? 'Clearing…' : 'Clear All Data'}</Text>
              </Pressable>
            </View>

          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Dialogs ── */}
      <Dialog
        visible={clearDialogOpen}
        onClose={() => { if (!clearing) setClearDialogOpen(false) }}
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

      <MessageDialog
        dialog={messageDialog}
        onClose={() => setMessageDialog(null)}
      />

      {/* ── Known Merchants Sheet (list → edit) ── */}
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
            {editingMapping ? (
              <Pressable onPress={() => setEditingMapping(null)} hitSlop={8}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M15 18 9 12l6-6" />
                </Svg>
              </Pressable>
            ) : null}
            <Text style={[s.sheetTitle, { flex: 1 }]}>
              {editingMapping ? 'Edit Merchant' : 'Known Merchants'}
            </Text>
            <Pressable onPress={() => { setMerchantSheetOpen(false); setEditingMapping(null) }} hitSlop={8}>
              <Text style={s.sheetDone}>Done</Text>
            </Pressable>
          </View>
        )}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={editingMapping ? s.sheetContent : s.sheetListContent}
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
                        <Text style={[s.predChipText, selected && s.predChipTextSelected]} numberOfLines={1}>{cat.name}</Text>
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
          ) : (
            learnedMappings.length === 0 ? (
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
            )
          )}
        </ScrollView>
      </Sheet>

      {/* ── Categories Sheet ── */}
      <Sheet
        visible={catSheetOpen}
        onClose={() => { setCatSheetOpen(false); setNewCat(''); setNewCatIcon(null); setNewCatPickerOpen(false); setIconPickerCat(null) }}
        heightFraction={0.82}
        title="Categories"
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
                <Pressable
                  onPress={() => { setNewCatPickerOpen(true); setIconPickerCat(null) }}
                  hitSlop={4}
                >
                  <CategoryIcon
                    forceIconName={newCatIcon}
                    forceBgColor={DEFAULT_CATEGORY_COLOR}
                    size={14}
                    circleSize={26}
                  />
                </Pressable>
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
                      <Pressable
                        onPress={() => { setIconPickerCat(cat); setNewCatPickerOpen(false) }}
                        hitSlop={4}
                      >
                        <CategoryIcon
                          category={cat.name}
                          forceIconName={cat.icon}
                          forceBgColor={cat.color}
                          size={14}
                          circleSize={26}
                        />
                      </Pressable>
                      <View style={s.catNameGroup}>
                        <Text style={s.catName} numberOfLines={1}>{cat.name}</Text>
                        {cat.transactionCount > 0 && (
                          <View style={s.catBadge}>
                            <Text style={s.catBadgeText} numberOfLines={1}>{cat.transactionCount} transaction{cat.transactionCount !== 1 ? 's' : ''}</Text>
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
                    <Text style={s.predChipText} numberOfLines={1}>{name}</Text>
                    {transactionCount > 0 && <Text style={s.predChipCount} numberOfLines={1}>{transactionCount}</Text>}
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

        <Sheet
          visible={!!iconPickerCat || newCatPickerOpen}
          onClose={() => { setIconPickerCat(null); setNewCatPickerOpen(false) }}
          heightFraction={0.72}
          header={(
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Choose Icon</Text>
              <Pressable onPress={() => { setIconPickerCat(null); setNewCatPickerOpen(false) }} hitSlop={8}>
                <Text style={s.sheetDone}>Done</Text>
              </Pressable>
            </View>
          )}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={ip.scroll}
          >
            <View style={ip.grid}>
              {ICON_PICKER_OPTIONS.map((iconName) => {
                const pickerColor = iconPickerCat?.color ?? DEFAULT_CATEGORY_COLOR
                const currentIcon = iconPickerCat
                  ? (iconPickerCat.icon ?? getCategoryIcon(iconPickerCat.name))
                  : (newCatIcon ?? DEFAULT_CATEGORY_ICON)
                const selected = currentIcon === iconName
                const label = ICON_LABELS[iconName] ?? iconName.replace('Icon', '')
                return (
                  <Pressable
                    key={iconName}
                    style={[ip.cell, selected && ip.cellSelected]}
                    onPress={() => {
                      const picked = iconName === DEFAULT_CATEGORY_ICON ? null : iconName
                      if (iconPickerCat) {
                        handleSetCategoryIcon(iconPickerCat, picked)
                      } else {
                        setNewCatIcon(picked)
                        setNewCatPickerOpen(false)
                      }
                    }}
                  >
                    <CategoryIcon forceIconName={iconName} forceBgColor={pickerColor} size={18} circleSize={34} />
                    <Text style={[ip.cellLabel, selected && ip.cellLabelSelected]} numberOfLines={1}>{label}</Text>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>
        </Sheet>
      </Sheet>

    </View>
  )
}

const ICON_PICKER_OPTIONS: string[] = [
  'TagIcon',
  'ForkKnifeIcon', 'CarIcon', 'ShoppingBagIcon', 'FilmSlateIcon',
  'HeartbeatIcon', 'LightningIcon', 'UsersThreeIcon', 'CoinsIcon',
  'ArrowCounterClockwiseIcon', 'HouseIcon', 'TrendUpIcon', 'RepeatIcon',
  'ArrowsLeftRightIcon', 'DotsThreeIcon',
  'GiftIcon', 'AirplaneInFlightIcon', 'GraduationCapIcon', 'CoffeeIcon',
  'BarbellIcon', 'BriefcaseIcon', 'MusicNotesIcon', 'GameControllerIcon',
  'PillIcon', 'UmbrellaIcon', 'DogIcon', 'BookOpenIcon',
  'PhoneIcon', 'GlobeIcon', 'LeafIcon', 'WrenchIcon',
  'ReceiptIcon', 'TrophyIcon', 'StarIcon', 'PiggyBankIcon',
  'GasCanIcon', 'ScissorsIcon', 'StorefrontIcon', 'BabyIcon', 'TicketIcon',
]

const ICON_LABELS: Record<string, string> = {
  TagIcon: 'Default',
  ForkKnifeIcon: 'Food',
  CarIcon: 'Car',
  ShoppingBagIcon: 'Shopping',
  FilmSlateIcon: 'Movies',
  HeartbeatIcon: 'Health',
  LightningIcon: 'Bills',
  UsersThreeIcon: 'People',
  CoinsIcon: 'Money',
  ArrowCounterClockwiseIcon: 'Refund',
  HouseIcon: 'Home',
  TrendUpIcon: 'Invest',
  RepeatIcon: 'Subscrib.',
  ArrowsLeftRightIcon: 'Transfer',
  DotsThreeIcon: 'Other',
  GiftIcon: 'Gifts',
  AirplaneInFlightIcon: 'Travel',
  GraduationCapIcon: 'Education',
  CoffeeIcon: 'Cafe',
  BarbellIcon: 'Gym',
  BriefcaseIcon: 'Work',
  MusicNotesIcon: 'Music',
  GameControllerIcon: 'Gaming',
  PillIcon: 'Medicine',
  UmbrellaIcon: 'Insurance',
  DogIcon: 'Pets',
  BookOpenIcon: 'Books',
  PhoneIcon: 'Phone',
  GlobeIcon: 'Abroad',
  LeafIcon: 'Nature',
  WrenchIcon: 'Repairs',
  ReceiptIcon: 'Tax',
  TrophyIcon: 'Goals',
  StarIcon: 'Faves',
  PiggyBankIcon: 'Savings',
  GasCanIcon: 'Fuel',
  ScissorsIcon: 'Beauty',
  StorefrontIcon: 'Market',
  BabyIcon: 'Kids',
  TicketIcon: 'Events',
}

const ip = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start' },
  cell: {
    width: 60,
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cellSelected: { borderColor: C.brand, backgroundColor: C.brandPale },
  cellLabel: { fontSize: 11, fontFamily: F.medium, color: C.ink3, textAlign: 'center' },
  cellLabelSelected: { color: C.brand, fontFamily: F.semibold },
})

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
  gap10: { height: 10 },
  gap14: { height: 14 },

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

  // Merchant rows
  mappingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  mappingBody: { flex: 1, minWidth: 0, gap: 2 },
  mappingName: { fontSize: 13.5, fontFamily: F.semibold, color: C.ink },
  mappingMeta: { fontSize: 11, fontFamily: F.mono, color: C.ink3 },
  mappingRight: { alignItems: 'flex-end', gap: 2, maxWidth: '42%' },
  mappingCategory: { fontSize: 12.5, fontFamily: F.bold, color: C.brand },
  mappingCount: { fontSize: 11, fontFamily: F.regular, color: C.ink3 },
  templateRow: { paddingHorizontal: 16, paddingVertical: 14 },

  // UPI / shared row patterns
  upiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, paddingHorizontal: 16 },
  upiId: { flex: 1, fontSize: 13, fontFamily: F.mono, color: C.ink },
  removeText: { fontSize: 12, fontFamily: F.semibold, color: C.neg },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 16 },
  addInput: { flex: 1, fontSize: 13, fontFamily: F.mono, color: C.ink, padding: 0 },
  addActionText: { fontSize: 12.5, fontFamily: F.bold, color: C.brand },
  rupeeLabel: { fontSize: 14, fontFamily: F.semibold, color: C.ink3, flexShrink: 0 },

  // Nav / summary rows
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 10,
  },
  summaryRowBody: { flex: 1, gap: 2 },
  summaryRowTitle: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  summaryRowSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  infoLabel: { flex: 1, fontSize: 13, fontFamily: F.regular, color: C.ink3 },
  infoValue: { maxWidth: '54%', textAlign: 'right', fontSize: 13, fontFamily: F.semibold, color: C.ink },

  // Data & Privacy
  dataActions: { gap: 10 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: RADIUS,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.brand,
  },
  exportText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },

  // Danger Zone
  dangerBtn: {
    paddingVertical: 13, borderRadius: RADIUS,
    alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.neg,
  },
  dangerText: { fontSize: 14, fontFamily: F.semibold, color: C.neg },

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, paddingHorizontal: 16 },
  catNameGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  catName: { fontSize: 14, fontFamily: F.regular, color: C.ink, flexShrink: 1 },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  catBadgeText: { fontSize: 11, fontFamily: F.regular, color: C.ink3, flexShrink: 1 },
  predefined: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  predChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  predChipSelected: { borderColor: C.brand, backgroundColor: C.brandPale },
  predChipText: { fontSize: 12, fontFamily: F.regular, color: C.ink3, flexShrink: 1 },
  predChipTextSelected: { fontFamily: F.bold, color: C.brandDeep },
  predChipCount: { fontSize: 12, fontFamily: F.bold, color: C.ink },

  // Sheets
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  sheetTitle: { fontSize: 17, fontFamily: F.extrabold, color: C.ink },
  sheetDone: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 0 },
  sheetListContent: { paddingBottom: 40 },
  sheetSection: { marginBottom: 20 },
  sheetSectionLabel: { fontSize: 10.5, fontFamily: F.bold, letterSpacing: 0.07 * 10, color: C.ink3, textTransform: 'uppercase', marginBottom: 8 },
})
