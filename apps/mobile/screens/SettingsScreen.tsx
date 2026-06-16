import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Svg, { Circle, Path, Polyline } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import {
  fetchSettings,
  updateProfile,
  addUpiId,
  removeUpiId,
  addCustomCategory,
  removeCustomCategory,
  clearAllData,
  fetchExportCsv,
  type SettingsData,
  type CategoryWithCount,
} from '../lib/api'
import { normalizeUpiId } from '@paisa-buddy/shared/logic/upi'
import { supabase } from '../lib/supabase'
import { C, F, RADIUS } from '../lib/tokens'

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

export function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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

  // Misc
  const [exporting, setExporting] = useState(false)
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await fetchSettings()
      setData(d)
      setNameInput(d.displayName ?? '')
      setIncomeInput(d.expectedMonthlyIncome > 0 ? String(Math.round(d.expectedMonthlyIncome / 100)) : '')
    } catch {
      setData(null)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load]))

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    load().finally(() => setRefreshing(false))
  }, [load])

  async function handleSaveName() {
    const name = nameInput.trim()
    try {
      await updateProfile({ displayName: name || null })
      setData((d) => d ? { ...d, displayName: name || null } : d)
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 1500)
    } catch {
      Alert.alert('Error', 'Could not save name.')
    }
  }

  async function handleSaveIncome() {
    const rupees = parseInt(incomeInput.replace(/,/g, ''), 10)
    const paise = isNaN(rupees) || rupees < 0 ? 0 : rupees * 100
    try {
      await updateProfile({ expectedMonthlyIncome: paise })
      setData((d) => d ? { ...d, expectedMonthlyIncome: paise } : d)
      setIncomeInput(paise > 0 ? String(rupees) : '')
      setIncomeSaved(true)
      setTimeout(() => setIncomeSaved(false), 1500)
    } catch {
      Alert.alert('Error', 'Could not save income.')
    }
  }

  async function handleAddUpi() {
    const id = normalizeUpiId(newUpi)
    if (!id) return
    setAddingUpi(true)
    try {
      await addUpiId(id)
      setData((d) => d ? { ...d, upiIds: d.upiIds.includes(id) ? d.upiIds : [...d.upiIds, id] } : d)
      setNewUpi('')
    } catch {
      Alert.alert('Error', 'Could not add UPI ID.')
    } finally {
      setAddingUpi(false)
    }
  }

  async function handleRemoveUpi(id: string) {
    try {
      await removeUpiId(id)
      setData((d) => d ? { ...d, upiIds: d.upiIds.filter((u) => u !== id) } : d)
    } catch {
      Alert.alert('Error', 'Could not remove UPI ID.')
    }
  }

  async function handleAddCategory() {
    const name = newCat.trim()
    if (!name) return
    setAddingCat(true)
    try {
      const { name: n, color } = await addCustomCategory(name)
      setData((d) => d ? {
        ...d,
        customCategories: [...d.customCategories, { name: n, color, transactionCount: 0 }],
      } : d)
      setNewCat('')
    } catch {
      Alert.alert('Error', 'Could not add category.')
    } finally {
      setAddingCat(false)
    }
  }

  function handleRemoveCategory(cat: CategoryWithCount) {
    const msg = cat.transactionCount > 0
      ? `${cat.transactionCount} transaction${cat.transactionCount !== 1 ? 's' : ''} use this category. Their category will be cleared.`
      : 'This cannot be undone.'
    Alert.alert(`Delete "${cat.name}"?`, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await removeCustomCategory(cat.name, cat.transactionCount > 0)
            setData((d) => d ? { ...d, customCategories: d.customCategories.filter((c) => c.name !== cat.name) } : d)
          } catch {
            Alert.alert('Error', 'Could not remove category.')
          }
        },
      },
    ])
  }

  async function handleExport() {
    setExporting(true)
    try {
      const csv = await fetchExportCsv()
      await Share.share({ message: csv, title: 'Paisa Buddy Export' })
    } catch {
      Alert.alert('Error', 'Could not export data.')
    } finally {
      setExporting(false)
    }
  }

  function handleClearAll() {
    Alert.alert(
      'Clear all data?',
      'This will permanently delete all your transactions. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all data', style: 'destructive',
          onPress: async () => {
            setClearing(true)
            try {
              await clearAllData()
              setData((d) => d ? { ...d, txCount: 0 } : d)
              Alert.alert('Done', 'All transactions deleted.')
            } catch {
              Alert.alert('Error', 'Could not clear data.')
            } finally {
              setClearing(false)
            }
          },
        },
      ],
    )
  }

  async function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  const initials = nameInput.trim()
    ? nameInput.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    : '?'

  const incomeDisplay = incomeInput
    ? Number(incomeInput.replace(/,/g, '')).toLocaleString('en-IN')
    : ''

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={s.title}>Settings</Text>
        </View>

        {loading ? (
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

            {/* ── UPI IDs ── */}
            <View style={s.section}>
              <SectionLabel>UPI IDs <Text style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>(optional)</Text></SectionLabel>
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
                <View style={s.addRow}>
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
            </View>

            {/* ── Income ── */}
            <View style={s.section}>
              <SectionLabel>Income</SectionLabel>
              <Card>
                <View style={s.addRow}>
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
              <SectionLabel>Custom Categories</SectionLabel>
              <Card>
                {(data?.customCategories ?? []).length === 0 ? (
                  <View style={s.emptyRow}><Text style={s.emptyRowText}>No custom categories yet</Text></View>
                ) : (
                  (data?.customCategories ?? []).map((cat, idx) => (
                    <View key={cat.name}>
                      <View style={s.catRow}>
                        <View style={[s.catDot, { backgroundColor: cat.color }]} />
                        <Text style={s.catName} numberOfLines={1}>{cat.name}</Text>
                        {cat.transactionCount > 0 && (
                          <View style={s.catBadge}>
                            <Text style={s.catBadgeText}>{cat.transactionCount} tx</Text>
                          </View>
                        )}
                        <Pressable onPress={() => handleRemoveCategory(cat)} hitSlop={8}>
                          <Text style={s.removeText}>Remove</Text>
                        </Pressable>
                      </View>
                      {idx < (data?.customCategories ?? []).length - 1 && <RowDivider />}
                    </View>
                  ))
                )}
                <RowDivider />
                <View style={s.addRow}>
                  <TextInput
                    style={s.addInput}
                    value={newCat}
                    onChangeText={setNewCat}
                    placeholder="Add category..."
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
              {(data?.predefinedCategories ?? []).length > 0 && (
                <View style={s.predefined}>
                  {(data?.predefinedCategories ?? []).map(({ name, transactionCount }) => (
                    <View key={name} style={s.predChip}>
                      <Text style={s.predChipText}>{name}</Text>
                      {transactionCount > 0 && <Text style={s.predChipCount}>{transactionCount}</Text>}
                    </View>
                  ))}
                </View>
              )}
              <Text style={s.hint}>Built-in categories (shown above) cannot be removed.</Text>
            </View>

            {/* ── Data ── */}
            <View style={s.section}>
              <SectionLabel>Data</SectionLabel>
              <Text style={s.txCount}>{data?.txCount ?? 0} transaction{data?.txCount !== 1 ? 's' : ''} stored</Text>
              <View style={s.dataActions}>
                <Pressable
                  style={s.exportBtn}
                  onPress={handleExport}
                  disabled={exporting}
                >
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <Polyline points="7 10 12 15 17 10" />
                    <Path d="M12 15V3" />
                  </Svg>
                  <Text style={s.exportText}>{exporting ? 'Exporting…' : 'Export to CSV'}</Text>
                </Pressable>
                <Pressable
                  style={s.clearBtn}
                  onPress={handleClearAll}
                  disabled={clearing}
                >
                  <Text style={s.clearText}>{clearing ? 'Clearing…' : 'Clear all data'}</Text>
                </Pressable>
                <Pressable style={s.logoutBtn} onPress={handleLogout}>
                  <Text style={s.logoutText}>Sign out</Text>
                </Pressable>
              </View>
            </View>

          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
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

  // UPI / shared row patterns
  emptyRow: { padding: 14 },
  emptyRowText: { fontSize: 13, fontFamily: F.regular, color: C.ink3 },
  upiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, paddingHorizontal: 16 },
  upiId: { flex: 1, fontSize: 13, fontFamily: F.mono, color: C.ink },
  removeText: { fontSize: 12, fontFamily: F.semibold, color: C.neg },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 16 },
  addInput: { flex: 1, fontSize: 13, fontFamily: F.mono, color: C.ink, padding: 0 },
  addActionText: { fontSize: 12.5, fontFamily: F.bold, color: C.brand },
  rupeeLabel: { fontSize: 14, fontFamily: F.semibold, color: C.ink3, flexShrink: 0 },

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, paddingHorizontal: 16 },
  catDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  catName: { flex: 1, fontSize: 13.5, fontFamily: F.regular, color: C.ink },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  catBadgeText: { fontSize: 11, fontFamily: F.regular, color: C.ink3 },
  predefined: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  predChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  predChipText: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  predChipCount: { fontSize: 12, fontFamily: F.bold, color: C.ink },

  // Data
  txCount: { fontSize: 13, fontFamily: F.regular, color: C.ink3, marginBottom: 10 },
  dataActions: { gap: 10 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: RADIUS,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.brand,
  },
  exportText: { fontSize: 13.5, fontFamily: F.semibold, color: C.brand },
  clearBtn: {
    paddingVertical: 13, borderRadius: RADIUS,
    alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
  },
  clearText: { fontSize: 13.5, fontFamily: F.semibold, color: C.ink2 },
  logoutBtn: {
    paddingVertical: 13, borderRadius: RADIUS,
    alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
  },
  logoutText: { fontSize: 13.5, fontFamily: F.semibold, color: C.neg },
})
