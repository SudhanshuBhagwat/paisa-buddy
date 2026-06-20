import React, { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import * as XLSX from 'xlsx'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Path, Polyline } from 'react-native-svg'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { C, F, RADIUS } from '../lib/tokens'
import { createTransaction, fetchTransactionMonthData } from '../lib/api'
import { getAccounts } from '../lib/data'
import { buildExistingImportFingerprints, dedupeImportRows } from '../lib/importDedup'
import { invalidateTransactionData, queryKeys } from '../lib/query'
import { decryptAgileExcel, isAgileEncryptedExcel, WrongExcelPasswordError } from '../lib/decryptExcel'
import { parseSpreadsheetRows, parseStatementText, type ParsedImport } from '../lib/importParser'
import type { RootStackParamList } from '../navigation'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ImportStatement'>
}

type Phase = 'pick' | 'processing' | 'password' | 'summary' | 'done'

const ACCEPTED_TYPES = [
  'text/csv',
  'text/plain',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/x-ofx',
  'application/qif',
  '*/*',
]

function CheckIcon({ color = '#fff', size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  )
}

function UploadIcon() {
  return (
    <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5" />
      <Path d="M12 3v12" />
    </Svg>
  )
}

export function ImportStatementScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts })
  const accounts = accountsQuery.data ?? []
  const [phase, setPhase] = useState<Phase>('pick')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [skippedDuplicateCount, setSkippedDuplicateCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [pendingExcel, setPendingExcel] = useState<{ name: string; uri: string } | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const unlockingRef = useRef(false)

  const selectedAccountName = accounts.find((account) => account.id === selectedAccountId)?.name

  async function pickStatement() {
    if (!selectedAccountId) {
      Alert.alert('Account required', 'Choose the account this statement belongs to first.')
      return
    }

    try {
      setPhase('processing')
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      })

      if (result.canceled) {
        setPhase('pick')
        return
      }

      const asset = result.assets[0]
      setFileName(asset.name)
      if (isPdf(asset.name)) {
        parseStatementText(asset.name, '')
      }
      const file = new File(asset.uri)
      if (isExcel(asset.name) && isEncryptedExcel(file)) {
        setPendingExcel({ name: asset.name, uri: asset.uri })
        setPassword('')
        setPasswordError('')
        setPhase('password')
        return
      }

      let nextParsed: ParsedImport
      if (isExcel(asset.name)) {
        try {
          nextParsed = await parseExcelFile(file)
        } catch (error) {
          if (isExcelPasswordError(error)) {
            setPendingExcel({ name: asset.name, uri: asset.uri })
            setPassword('')
            setPasswordError('')
            setPhase('password')
            return
          }
          throw error
        }
      } else {
        nextParsed = parseStatementText(asset.name, file.textSync())
      }

      if (nextParsed.rows.length === 0) {
        throw new Error('No transactions could be read from this statement.')
      }

      setParsed(nextParsed)
      setPhase('summary')
    } catch (error) {
      setPhase('pick')
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not read this statement.')
    }
  }

  async function unlockPendingExcel() {
    if (!pendingExcel || !password.trim() || unlockingRef.current) return
    unlockingRef.current = true
    setUnlocking(true)
    setPasswordError('')

    try {
      setPhase('processing')
      await waitForUiFrame()
      const nextParsed = await parseExcelFile(new File(pendingExcel.uri), password)
      if (nextParsed.rows.length === 0) {
        throw new Error('No transactions could be read from this statement.')
      }

      setParsed(nextParsed)
      setPendingExcel(null)
      setPassword('')
      setPhase('summary')
    } catch (error) {
      setPhase('password')
      setPasswordError(error instanceof Error ? friendlyExcelPasswordError(error) : 'Could not unlock this Excel file.')
    } finally {
      unlockingRef.current = false
      setUnlocking(false)
    }
  }

  function cancelPasswordPrompt() {
    if (unlockingRef.current) return
    setPendingExcel(null)
    setPassword('')
    setPasswordError('')
    setPhase('pick')
  }

  async function importRows() {
    if (!parsed || !selectedAccountId) return
    setImporting(true)
    let count = 0

    try {
      const months = [...new Set(parsed.rows.map((row) => row.date.slice(0, 7)))]
      const monthData = await Promise.all(months.map((month) => fetchTransactionMonthData(month)))
      const existingTransactions = monthData.flatMap((data) => data.transactions)
      const existing = buildExistingImportFingerprints(existingTransactions, selectedAccountId)
      const deduped = dedupeImportRows(parsed.rows, existing)

      for (const row of deduped.rows) {
        await createTransaction({
          type: row.type,
          amount: row.amount,
          date: row.date,
          description: row.description,
          account_id: selectedAccountId,
          category: null,
          reviewed: false,
          source: 'bank_import',
          upi_ref: row.upi_ref,
        })
        count++
      }

      setImportedCount(count)
      setSkippedDuplicateCount(deduped.skipped)
      invalidateTransactionData(queryClient)
      void queryClient.invalidateQueries({ queryKey: queryKeys.review })
      setPhase('done')
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not save imported transactions.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <Polyline points="15 18 9 12 15 6" />
          </Svg>
        </Pressable>
        <Text style={s.headerTitle}>Import Statement</Text>
      </View>

      {(phase === 'processing' || phase === 'password') ? (
        <View style={s.processing}>
          <View style={s.mascotBubble}>
            {phase === 'password' && !unlocking ? <UploadIcon /> : <ActivityIndicator size="large" color={C.brand} />}
          </View>
          <Text style={s.processingTitle}>{phase === 'password' && !unlocking ? 'Unlock statement' : 'Processing statement'}</Text>
          <Text style={s.processingSub}>
            {phase === 'password' && !unlocking ? 'Enter the file password to continue locally.' : 'Parsing happens locally on this device.'}
          </Text>
          <View style={s.stepsCard}>
            {['File uploaded', 'Reading statement', 'Extracting transactions'].map((step) => (
              <View key={step} style={s.stepRow}>
                <View style={s.stepCheck}><CheckIcon size={12} /></View>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
            <View style={s.stepRow}>
              <View style={s.stepDot} />
              <Text style={s.stepText}>Preparing review</Text>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {phase === 'pick' && (
            <>
              <View style={s.uploadCard}>
                <View style={s.mascotBubble}>
                  <UploadIcon />
                </View>
                <Text style={s.uploadTitle}>Import your statement</Text>
                <Text style={s.uploadSub}>CSV, XLSX, OFX, and QIF are parsed on-device. PDF is not uploaded.</Text>
                <Text style={s.privacyText}>Your statement stays on your device.</Text>
              </View>

              <View style={s.section}>
                <Text style={s.sectionLabel}>ACCOUNT</Text>
                <View style={s.accountPills}>
                  {accountsQuery.isLoading && <ActivityIndicator color={C.brand} />}
                  {!accountsQuery.isLoading && accounts.length === 0 && (
                    <Text style={s.emptyText}>Add an account before importing a statement.</Text>
                  )}
                  {accounts.map((account) => {
                    const selected = selectedAccountId === account.id
                    return (
                      <Pressable
                        key={account.id}
                        style={[s.accountPill, selected && s.accountPillSelected]}
                        onPress={() => setSelectedAccountId(account.id)}
                      >
                        <Text style={[s.accountPillText, selected && s.accountPillTextSelected]}>{account.name}</Text>
                        {selected && <CheckIcon color={C.brand} size={14} />}
                      </Pressable>
                    )
                  })}
                </View>
              </View>

              <Pressable
                style={[s.primaryBtn, (!selectedAccountId || accounts.length === 0) && s.btnDisabled]}
                onPress={pickStatement}
                disabled={!selectedAccountId || accounts.length === 0}
              >
                <Text style={s.primaryBtnText}>Import Statement</Text>
              </Pressable>
            </>
          )}

          {phase === 'summary' && parsed && (
            <>
              <View style={s.summaryHero}>
                <Text style={s.summaryCount}>{parsed.rows.length}</Text>
                <Text style={s.summaryLabel}>Transactions Imported</Text>
                <Text style={s.summarySub}>{fileName} · {selectedAccountName}</Text>
              </View>

              <View style={s.summaryCards}>
                <View style={s.summaryCard}>
                  <Text style={s.summaryCardLabel}>Format</Text>
                  <Text style={s.summaryCardValue}>{parsed.format.toUpperCase()}</Text>
                </View>
                <View style={s.summaryCard}>
                  <Text style={s.summaryCardLabel}>Skipped rows</Text>
                  <Text style={s.summaryCardValue}>{parsed.skipped}</Text>
                </View>
              </View>

              <Text style={s.summaryHint}>
                These transactions will be saved as unreviewed so you can group and categorize them next.
              </Text>

              <Pressable style={[s.primaryBtn, importing && s.btnDisabled]} onPress={importRows} disabled={importing}>
                {importing ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Prepare Review</Text>}
              </Pressable>
              <Pressable style={s.secondaryBtn} onPress={() => { setParsed(null); setFileName(''); setPhase('pick') }} disabled={importing}>
                <Text style={s.secondaryBtnText}>Choose another file</Text>
              </Pressable>
            </>
          )}

          {phase === 'done' && (
            <View style={s.doneWrap}>
              <View style={s.doneCircle}>
                <CheckIcon size={34} />
              </View>
              <Text style={s.doneTitle}>Ready to Review</Text>
              <Text style={s.doneSub}>
                {importedCount} transaction{importedCount !== 1 ? 's' : ''} imported for {selectedAccountName}.
                {skippedDuplicateCount > 0 ? ` ${skippedDuplicateCount} duplicate${skippedDuplicateCount !== 1 ? 's' : ''} skipped.` : ''}
              </Text>
              <Pressable style={s.primaryBtn} onPress={() => navigation.replace('Review')}>
                <Text style={s.primaryBtnText}>Start Review</Text>
              </Pressable>
              <Pressable style={s.secondaryBtn} onPress={() => navigation.goBack()}>
                <Text style={s.secondaryBtnText}>Return Home</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={!!pendingExcel} transparent animationType="fade" onRequestClose={cancelPasswordPrompt}>
        <View style={s.modalOverlay}>
          <View style={s.passwordCard}>
            <Text style={s.passwordTitle}>Password protected file</Text>
            <Text style={s.passwordSub}>{pendingExcel?.name} needs a password. The password stays on this device.</Text>
            <TextInput
              style={s.passwordInput}
              value={password}
              onChangeText={(value) => { setPassword(value); setPasswordError('') }}
              placeholder="Enter password"
              placeholderTextColor={C.ink3}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!unlocking}
              returnKeyType="done"
              onSubmitEditing={unlockPendingExcel}
            />
            {!!passwordError && <Text style={s.passwordError}>{passwordError}</Text>}
            <View style={s.passwordActions}>
              <Pressable
                style={s.passwordCancel}
                onPress={cancelPasswordPrompt}
                disabled={unlocking}
              >
                <Text style={s.passwordCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.passwordUnlock, (!password.trim() || unlocking) && s.btnDisabled]}
                onPress={unlockPendingExcel}
                disabled={!password.trim() || unlocking}
              >
                {unlocking ? <ActivityIndicator color="#fff" /> : <Text style={s.passwordUnlockText}>Unlock</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function isPdf(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('.pdf')
}

function isExcel(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('.xlsx') || lower.endsWith('.xls')
}

function waitForUiFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0)
    })
  })
}

async function parseExcelFile(file: File, password?: string): Promise<ParsedImport> {
  const bytes = file.bytesSync()
  const workbookBytes = password && isAgileEncryptedExcel(bytes)
    ? await decryptAgileExcel(bytes, password)
    : null
  const workbook = workbookBytes
    ? XLSX.read(workbookBytes, { type: 'array', cellDates: false, raw: false })
    : XLSX.read(file.base64Sync(), { type: 'base64', cellDates: false, raw: false, password })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('No worksheet found in this Excel file.')

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  return parseSpreadsheetRows(rows, 'xlsx')
}

function isEncryptedExcel(file: File): boolean {
  return isAgileEncryptedExcel(file.bytesSync())
}

function friendlyExcelPasswordError(error: Error): string {
  if (isExcelPasswordError(error)) {
    return 'Could not unlock this file. Check the password, or export it as an unprotected XLSX/CSV.'
  }
  return error.message
}

function isExcelPasswordError(error: unknown): boolean {
  return error instanceof WrongExcelPasswordError ||
    (error instanceof Error && /password|decrypt|unsupported|encrypt|protected/i.test(error.message))
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  backBtn: { padding: 2 },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: F.extrabold, color: C.ink },
  content: { paddingHorizontal: 16, paddingTop: 18, gap: 18 },
  uploadCard: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 22,
    gap: 9,
  },
  mascotBubble: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: C.brandPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: 22, fontFamily: F.extrabold, color: C.ink, textAlign: 'center' },
  uploadSub: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 19, textAlign: 'center' },
  privacyText: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
  section: { gap: 9 },
  sectionLabel: { fontSize: 11, fontFamily: F.bold, color: C.ink3, letterSpacing: 0.5 },
  accountPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  accountPillSelected: { borderColor: C.brand },
  accountPillText: { fontSize: 13.5, fontFamily: F.medium, color: C.ink },
  accountPillTextSelected: { color: C.brand, fontFamily: F.semibold },
  emptyText: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 19 },
  primaryBtn: { backgroundColor: C.brand, borderRadius: RADIUS, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 16, fontFamily: F.semibold, color: '#fff' },
  secondaryBtn: { paddingVertical: 13, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontFamily: F.semibold, color: C.ink2 },
  btnDisabled: { opacity: 0.45 },
  processing: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  processingTitle: { fontSize: 22, fontFamily: F.extrabold, color: C.ink },
  processingSub: { fontSize: 13, fontFamily: F.regular, color: C.ink3, textAlign: 'center' },
  stepsCard: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  stepDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.line },
  stepText: { fontSize: 13, fontFamily: F.medium, color: C.ink2 },
  summaryHero: { alignItems: 'center', gap: 4, paddingTop: 18 },
  summaryCount: { fontSize: 64, fontFamily: F.extrabold, color: C.ink, lineHeight: 72 },
  summaryLabel: { fontSize: 16, fontFamily: F.medium, color: C.ink2 },
  summarySub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, textAlign: 'center' },
  summaryCards: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    gap: 4,
  },
  summaryCardLabel: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  summaryCardValue: { fontSize: 18, fontFamily: F.extrabold, color: C.ink },
  summaryHint: { fontSize: 13.5, fontFamily: F.regular, color: C.ink3, lineHeight: 20, textAlign: 'center' },
  doneWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  doneCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 26, fontFamily: F.extrabold, color: C.ink },
  doneSub: { fontSize: 14, fontFamily: F.regular, color: C.ink3, textAlign: 'center', lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(22,32,26,0.34)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  passwordCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    gap: 12,
  },
  passwordTitle: { fontSize: 19, fontFamily: F.extrabold, color: C.ink },
  passwordSub: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 19 },
  passwordInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    fontSize: 15,
    fontFamily: F.regular,
    color: C.ink,
  },
  passwordError: { fontSize: 12, fontFamily: F.medium, color: C.neg, lineHeight: 18 },
  passwordActions: { flexDirection: 'row', gap: 10 },
  passwordCancel: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: C.line,
    alignItems: 'center',
  },
  passwordCancelText: { fontSize: 14, fontFamily: F.semibold, color: C.ink2 },
  passwordUnlock: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: RADIUS,
    backgroundColor: C.brand,
    alignItems: 'center',
  },
  passwordUnlockText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
})
