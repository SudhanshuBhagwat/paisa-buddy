import React, { useRef, useState } from 'react'
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Path, Polyline } from 'react-native-svg'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, MessageDialog, type MessageDialogState } from '../components/Dialog'
import { C, F, RADIUS } from '../lib/tokens'
import { createTransaction, getByMonth } from '../repositories/transactionRepository'
import { completeImportSession, createImportSession, findImportSessionByHash, type ImportSession } from '../repositories/importRepository'
import { getAccounts } from '../lib/data'
import { detectDuplicate } from '../lib/importDedup'
import { invalidateTransactionData, queryKeys } from '../lib/query'
import { decryptAgileExcel, isAgileEncryptedExcel, WrongExcelPasswordError } from '../lib/decryptExcel'
import { parseSpreadsheetRows, parseStatementText, type ImportRow, type ParsedImport } from '../lib/importParser'
import { buildTransactionDedupeKey, parseTransactionDescription } from '../lib/descriptionParser'
import { groupImportRows, type ImportGroupPreview } from '../lib/grouping'
import { suggestForImportRows } from '../lib/suggestions'
import type { RootStackParamList } from '../navigation/types'
import type { TxInput } from '../repositories/transactionRepository'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ImportStatement'>
}

type Phase = 'pick' | 'processing' | 'password' | 'summary' | 'done'

const ACCEPTED_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

type ImportSummaryCounts = {
  total: number
  newCount: number
  alreadyImportedCount: number
  possibleDuplicateCount: number
  needReviewCount: number
}

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
  const [possibleDuplicateCount, setPossibleDuplicateCount] = useState(0)
  const [confirmedDuplicateCount, setConfirmedDuplicateCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportGroupPreview | null>(null)
  const [summaryCounts, setSummaryCounts] = useState<ImportSummaryCounts | null>(null)
  const [fileHash, setFileHash] = useState<string | null>(null)
  const [duplicateImport, setDuplicateImport] = useState<{
    name: string
    uri: string
    fileHash: string
    session: ImportSession
  } | null>(null)
  const [pendingExcel, setPendingExcel] = useState<{ name: string; uri: string } | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)
  const unlockingRef = useRef(false)

  const selectedAccountName = accounts.find((account) => account.id === selectedAccountId)?.name

  async function pickStatement() {
    if (!selectedAccountId) {
      setMessageDialog({ title: 'Account required', message: 'Choose the account this statement belongs to first.' })
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
      await processPickedFile(asset.name, asset.uri)
    } catch (error) {
      setPhase('pick')
      setMessageDialog({ title: 'Import failed', message: error instanceof Error ? error.message : 'Could not read this statement.' })
    }
  }

  async function processPickedFile(name: string, uri: string, skipHashWarning = false) {
    setFileName(name)
    if (!isSupportedSpreadsheet(name)) {
      setPhase('pick')
      setMessageDialog(unsupportedFileDialog(name))
      return
    }

    const file = new File(uri)
    const nextHash = await hashFile(file)
    setFileHash(nextHash)
    if (!skipHashWarning) {
      const existingImport = await findImportSessionByHash(nextHash)
      if (existingImport) {
        setDuplicateImport({ name, uri, fileHash: nextHash, session: existingImport })
        setPhase('pick')
        return
      }
    }

    try {
      if (isExcel(name) && await isEncryptedExcel(file)) {
        setPendingExcel({ name, uri })
        setPassword('')
        setPasswordError('')
        setPhase('password')
        return
      }

      let nextParsed: ParsedImport
      if (isExcel(name)) {
        try {
          nextParsed = await parseExcelFile(file)
        } catch (error) {
          if (isExcelPasswordError(error)) {
            setPendingExcel({ name, uri })
            setPassword('')
            setPasswordError('')
            setPhase('password')
            return
          }
          throw error
        }
      } else {
        nextParsed = parseStatementText(name, file.textSync())
      }

      if (nextParsed.rows.length === 0) {
        throw new Error("We couldn't understand this spreadsheet format.")
      }

      setParsed(nextParsed)
      setImportPreview(groupImportRows(nextParsed.rows.map((row) => normalizeImportRowForPreview(row))))
      setSummaryCounts(await buildImportSummary(nextParsed.rows, selectedAccountId!))
      setPhase('summary')
    } catch (error) {
      setPhase('pick')
      setMessageDialog({ title: 'Import failed', message: error instanceof Error ? error.message : 'Could not read this statement.' })
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
        throw new Error("We couldn't understand this spreadsheet format.")
      }

      setParsed(nextParsed)
      setImportPreview(groupImportRows(nextParsed.rows.map((row) => normalizeImportRowForPreview(row))))
      if (selectedAccountId) {
        setSummaryCounts(await buildImportSummary(nextParsed.rows, selectedAccountId))
      }
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

  function reviewDuplicateImportAnyway() {
    if (!duplicateImport) return
    const pending = duplicateImport
    setDuplicateImport(null)
    setPhase('processing')
    void processPickedFile(pending.name, pending.uri, true)
  }

  async function importRows() {
    if (!parsed || !selectedAccountId) return
    setImporting(true)
    let count = 0

    try {
      const dates = parsed.rows.map((row) => row.date).sort()
      const importSessionId = await createImportSession({
        fileName: fileName || null,
        fileHash,
        transactionCount: parsed.rows.length,
        statementStartDate: dates[0] ?? null,
        statementEndDate: dates[dates.length - 1] ?? null,
      })
      const prepared = await prepareRowsForImport(parsed.rows, selectedAccountId, importSessionId)
      const months = [...new Set(prepared.map((row) => row.date.slice(0, 7)))]
      const monthData = await Promise.all(months.map((month) => getByMonth(month)))
      const existingTransactions = monthData.flat()
      let possibleDuplicates = 0
      let confirmedDuplicates = 0

      for (const row of prepared) {
        const duplicate = detectDuplicate(row, existingTransactions)
        if (duplicate.status === 'possible_duplicate') possibleDuplicates++
        if (duplicate.status === 'confirmed_duplicate') confirmedDuplicates++
        const created = await createTransaction({
          ...row,
          duplicate_status: duplicate.status,
          duplicate_of_transaction_id: duplicate.duplicateOfTransactionId,
        })
        existingTransactions.push(created)
        count++
      }
      await completeImportSession(importSessionId)

      setImportedCount(count)
      setSkippedDuplicateCount(0)
      setPossibleDuplicateCount(possibleDuplicates)
      setConfirmedDuplicateCount(confirmedDuplicates)
      invalidateTransactionData(queryClient)
      void queryClient.invalidateQueries({ queryKey: queryKeys.review })
      navigation.replace('Review')
    } catch (error) {
      setMessageDialog({ title: 'Import failed', message: error instanceof Error ? error.message : 'Could not save imported transactions.' })
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
                <Text style={s.uploadSub}>Excel and CSV statements are parsed on-device.</Text>
                <Text style={s.privacyText}>Your statement is processed locally on this device.</Text>
              </View>

              <View style={s.formatCard}>
                <Text style={s.sectionLabel}>SUPPORTED FORMATS</Text>
                <Text style={s.formatLine}>✓ Excel (.xlsx)</Text>
                <Text style={s.formatLine}>✓ Excel (.xls)</Text>
                <Text style={s.formatLine}>✓ CSV</Text>
                <Text style={[s.sectionLabel, s.comingSoonLabel]}>COMING SOON</Text>
                <Text style={s.comingSoonLine}>• PDF Statements</Text>
                <Text style={s.comingSoonLine}>• OCR Imports</Text>
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

          {phase === 'summary' && parsed && importPreview && (
            <>
              <View style={s.summaryHero}>
                <Text style={s.summaryCount}>{parsed.rows.length}</Text>
                <Text style={s.summaryLabel}>Transactions Found</Text>
                <Text style={s.summarySub}>{fileName} · {selectedAccountName}</Text>
              </View>

              <View style={s.summaryBreakdown}>
                {summaryCounts && (
                  <>
                    <View style={s.breakdownRow}>
                      <View style={[s.breakdownDot, { backgroundColor: C.brand }]} />
                      <View style={s.breakdownBody}>
                        <Text style={s.breakdownNum}>{summaryCounts.newCount} New</Text>
                        <Text style={s.breakdownSub}>not seen in saved transactions</Text>
                      </View>
                    </View>
                    <View style={[s.breakdownRow, s.breakdownRowBorder]}>
                      <View style={[s.breakdownDot, { backgroundColor: C.ink3 }]} />
                      <View style={s.breakdownBody}>
                        <Text style={s.breakdownNum}>{summaryCounts.alreadyImportedCount} Already Imported</Text>
                        <Text style={s.breakdownSub}>matched by exact duplicate rules</Text>
                      </View>
                    </View>
                    <View style={[s.breakdownRow, s.breakdownRowBorder]}>
                      <View style={[s.breakdownDot, { backgroundColor: C.gold }]} />
                      <View style={s.breakdownBody}>
                        <Text style={s.breakdownNum}>{summaryCounts.possibleDuplicateCount} Possible Duplicate</Text>
                        <Text style={s.breakdownSub}>will be shown in review</Text>
                      </View>
                    </View>
                    <View style={[s.breakdownRow, s.breakdownRowBorder]}>
                      <View style={[s.breakdownDot, { backgroundColor: C.neg }]} />
                      <View style={s.breakdownBody}>
                        <Text style={s.breakdownNum}>{summaryCounts.needReviewCount} Need Review</Text>
                        <Text style={s.breakdownSub}>missing category or duplicate warning</Text>
                      </View>
                    </View>
                  </>
                )}
                {importPreview.groupCount > 0 && (
                  <View style={[s.breakdownRow, summaryCounts && s.breakdownRowBorder]}>
                    <View style={[s.breakdownDot, { backgroundColor: C.brand }]} />
                    <View style={s.breakdownBody}>
                      <Text style={s.breakdownNum}>{importPreview.groupedTxCount} transactions grouped</Text>
                      <Text style={s.breakdownSub}>{importPreview.groupCount} group{importPreview.groupCount !== 1 ? 's' : ''} for batch review</Text>
                    </View>
                  </View>
                )}
                {importPreview.singleCount > 0 && (
                  <View style={[s.breakdownRow, importPreview.groupCount > 0 && s.breakdownRowBorder]}>
                    <View style={[s.breakdownDot, { backgroundColor: C.ink3 }]} />
                    <View style={s.breakdownBody}>
                      <Text style={s.breakdownNum}>{importPreview.singleCount} need individual review</Text>
                      <Text style={s.breakdownSub}>reviewed one by one in a queue</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={s.summaryMeta}>
                <Text style={s.summaryMetaText}>{parsed.format.toUpperCase()}</Text>
                {parsed.skipped > 0 && (
                  <Text style={s.summaryMetaText}>{parsed.skipped} row{parsed.skipped !== 1 ? 's' : ''} skipped</Text>
                )}
              </View>

              <Text style={s.summaryHint}>
                {importPreview.groupCount > 0
                  ? `Review ${importPreview.groupCount} group${importPreview.groupCount !== 1 ? 's' : ''} first, then ${importPreview.singleCount} individual transaction${importPreview.singleCount !== 1 ? 's' : ''}.`
                  : `${parsed.rows.length} transactions will be reviewed one by one.`}
              </Text>

              {summaryCounts?.newCount === 0 ? (
                <>
                  <Text style={s.fullyImportedText}>This statement appears to be fully imported already.{'\n'}No new transactions found.</Text>
                  <Pressable style={s.primaryBtn} onPress={() => navigation.goBack()}>
                    <Text style={s.primaryBtnText}>Done</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={[s.primaryBtn, importing && s.btnDisabled]} onPress={importRows} disabled={importing}>
                  {importing ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Review</Text>}
                </Pressable>
              )}
              <Pressable style={s.secondaryBtn} onPress={() => { setParsed(null); setImportPreview(null); setFileName(''); setPhase('pick') }} disabled={importing}>
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
                {possibleDuplicateCount + confirmedDuplicateCount > 0
                  ? ` ${possibleDuplicateCount + confirmedDuplicateCount} duplicate warning${possibleDuplicateCount + confirmedDuplicateCount !== 1 ? 's' : ''} will be shown in review.`
                  : ''}
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
            <Text style={s.passwordSub}>{pendingExcel?.name} needs a password. The password is used locally on this device.</Text>
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
      <MessageDialog
        dialog={messageDialog}
        onClose={() => setMessageDialog(null)}
      />
      <Dialog
        visible={!!duplicateImport}
        onClose={() => setDuplicateImport(null)}
        title="This statement appears to have been imported already."
        message={duplicateImport
          ? `Imported On:\n${formatImportDate(duplicateImport.session.created_at)}\n\nTransactions:\n${duplicateImport.session.transaction_count}`
          : undefined}
        actions={[
          { label: 'Review Anyway', onPress: reviewDuplicateImportAnyway },
          { label: 'Cancel', variant: 'secondary', onPress: () => setDuplicateImport(null) },
        ]}
      />
    </View>
  )
}

function normalizeImportRowForPreview(row: ImportRow): ImportRow & { normalized_lookup_key: string } {
  const parsed = parseTransactionDescription(row.description)
  return {
    ...row,
    normalized_lookup_key: parsed.normalizedLookupKey,
  }
}

async function prepareRowsForImport(
  rows: ImportRow[],
  accountId: string,
  importSessionId: string,
): Promise<TxInput[]> {
  const parsedRows = rows.map((row) => {
    const parsed = parseTransactionDescription(row.description)
    const upiRef = row.upi_ref || parsed.referenceNumber || null
    return {
      row,
      parsed,
      tx: {
        type: row.type,
        amount: row.amount,
        date: row.date,
        description: parsed.cleanedDescription,
        merchant: parsed.parsedDisplayName ?? null,
        account_id: accountId,
        category: null,
        reviewed: false,
        source: 'bank_import' as const,
        upi_ref: upiRef,
        bank: parsed.bankCode ?? null,
        raw_description: parsed.rawDescription,
        parsed_display_name: parsed.parsedDisplayName ?? null,
        normalized_lookup_key: parsed.normalizedLookupKey,
        parser_version: parsed.parserVersion,
        dedupe_key: buildTransactionDedupeKey({
          accountId,
          date: row.date,
          amount: row.amount,
          direction: row.type,
          normalizedLookupKey: parsed.normalizedLookupKey,
          referenceNumber: upiRef,
        }),
        import_session_id: importSessionId,
        duplicate_status: 'none' as const,
      } satisfies TxInput,
    }
  })

  const withSuggestions = await suggestForImportRows(parsedRows.map(({ tx }) => tx))
  return parsedRows.map(({ tx }, idx) => {
    const suggestion = withSuggestions[idx].suggestion
    return {
      ...tx,
      merchant: suggestion.displayName || tx.merchant,
      user_display_name: suggestion.source === 'learned' ? suggestion.displayName : null,
      category: suggestion.category,
      type: suggestion.transactionType || tx.type,
      category_source: suggestion.source,
    }
  })
}

function isPdf(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('.pdf')
}

function isSupportedSpreadsheet(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')
}

function isExcel(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('.xlsx') || lower.endsWith('.xls')
}

async function hashFile(file: File): Promise<string> {
  const cryptoModule = await import('crypto-js')
  const CryptoJS = cryptoModule.default ?? cryptoModule
  return CryptoJS.SHA256(file.base64Sync()).toString(CryptoJS.enc.Hex)
}

function unsupportedFileDialog(fileName: string): MessageDialogState {
  if (isPdf(fileName)) {
    return {
      title: 'PDF import coming soon',
      message: 'PDF import is coming soon. Please export Excel or CSV for now.',
    }
  }
  if (/\.(jpg|jpeg|png|heic|webp|tiff?)$/i.test(fileName)) {
    return {
      title: 'Scanned document not supported',
      message: 'Scanned document imports are not supported yet.',
    }
  }
  return {
    title: 'Unsupported file',
    message: 'We couldn\'t understand this spreadsheet format.',
  }
}

async function buildImportSummary(rows: ImportRow[], accountId: string): Promise<ImportSummaryCounts> {
  const prepared = await prepareRowsForImport(rows, accountId, 'preview')
  const months = [...new Set(prepared.map((row) => row.date.slice(0, 7)))]
  const monthData = await Promise.all(months.map((month) => getByMonth(month)))
  const existingTransactions = monthData.flat()
  let alreadyImportedCount = 0
  let possibleDuplicateCount = 0
  let needReviewCount = 0

  for (const row of prepared) {
    const duplicate = detectDuplicate(row, existingTransactions)
    if (duplicate.status === 'confirmed_duplicate') alreadyImportedCount++
    if (duplicate.status === 'possible_duplicate') possibleDuplicateCount++
    if (!row.category || row.category_source === 'unknown' || duplicate.status !== 'none') needReviewCount++
  }

  return {
    total: rows.length,
    alreadyImportedCount,
    possibleDuplicateCount,
    needReviewCount,
    newCount: Math.max(rows.length - alreadyImportedCount - possibleDuplicateCount, 0),
  }
}

function formatImportDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function waitForUiFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0)
    })
  })
}

async function parseExcelFile(file: File, password?: string): Promise<ParsedImport> {
  const xlsxModule = await import('xlsx')
  const XLSX = xlsxModule.default ?? xlsxModule
  const bytes = file.bytesSync()
  const workbookBytes = password && await isAgileEncryptedExcel(bytes)
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

function isEncryptedExcel(file: File): Promise<boolean> {
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
  uploadTitle: { fontSize: 18, fontFamily: F.extrabold, color: C.ink, textAlign: 'center' },
  uploadSub: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 19, textAlign: 'center' },
  privacyText: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
  formatCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    gap: 7,
  },
  formatLine: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  comingSoonLabel: { marginTop: 8 },
  comingSoonLine: { fontSize: 13, fontFamily: F.regular, color: C.ink3 },
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
  accountPillText: { fontSize: 14, fontFamily: F.medium, color: C.ink },
  accountPillTextSelected: { color: C.brand, fontFamily: F.semibold },
  emptyText: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 19 },
  primaryBtn: { backgroundColor: C.brand, borderRadius: RADIUS, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 16, fontFamily: F.semibold, color: '#fff' },
  secondaryBtn: { paddingVertical: 13, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontFamily: F.semibold, color: C.ink2 },
  btnDisabled: { opacity: 0.45 },
  processing: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  processingTitle: { fontSize: 18, fontFamily: F.extrabold, color: C.ink },
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
  summaryLabel: { fontSize: 16, fontFamily: F.extrabold, color: C.ink },
  summarySub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, textAlign: 'center' },
  summaryBreakdown: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  breakdownRowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  breakdownDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  breakdownBody: { flex: 1, gap: 2 },
  breakdownNum: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  breakdownSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  summaryMeta: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  summaryMetaText: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  summaryHint: { fontSize: 13.5, fontFamily: F.regular, color: C.ink3, lineHeight: 20, textAlign: 'center' },
  fullyImportedText: { fontSize: 14, fontFamily: F.semibold, color: C.ink2, lineHeight: 21, textAlign: 'center' },
  doneWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  doneCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 18, fontFamily: F.extrabold, color: C.ink },
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
  passwordTitle: { fontSize: 17, fontFamily: F.extrabold, color: C.ink },
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
