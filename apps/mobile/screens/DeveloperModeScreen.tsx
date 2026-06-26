import React, { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettingsData } from '../lib/data'
import {
  clearDemoTransactions,
  generateDemoTransactions,
  getDeveloperPerformanceData,
} from '../lib/developerTools'
import { invalidateTransactionData, queryKeys } from '../lib/query'
import { BACKUP_SCHEMA_VERSION } from '../repositories/backupRepository'
import { DB_VERSION } from '../db/migrations'
import type { RootStackParamList } from '../navigation/types'
import { C, F, RADIUS } from '../lib/tokens'

type Nav = NativeStackNavigationProp<RootStackParamList>

const APP_VERSION = '1.0.0'
const DATABASE_VERSION = DB_VERSION
const PARSER_VERSION = 'description-parser-v1'

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function Divider() {
  return <View style={s.divider} />
}

export function DeveloperModeScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const queryClient = useQueryClient()
  const [exporting, setExporting] = useState(false)
  const [demoAction, setDemoAction] = useState<string | null>(null)
  const settingsQuery = useQuery({ queryKey: ['developerMode'], queryFn: getSettingsData })
  const perfQuery = useQuery({ queryKey: ['developerPerformance'], queryFn: getDeveloperPerformanceData })
  const data = settingsQuery.data?.settings ?? null
  const perf = perfQuery.data ?? null

  async function refreshDeveloperData() {
    await Promise.all([
      settingsQuery.refetch(),
      perfQuery.refetch(),
    ])
  }

  async function handleGenerateDemoTransactions(count: number) {
    setDemoAction(`generate-${count}`)
    try {
      await generateDemoTransactions(count)
      invalidateTransactionData(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.categories })
      await refreshDeveloperData()
    } finally {
      setDemoAction(null)
    }
  }

  async function handleClearDemoTransactions() {
    setDemoAction('clear')
    try {
      await clearDemoTransactions()
      invalidateTransactionData(queryClient)
      await refreshDeveloperData()
    } finally {
      setDemoAction(null)
    }
  }

  async function handleExportDiagnostics() {
    if (!data) return
    setExporting(true)
    try {
      const payload = {
        app: 'paisa-buddy',
        generatedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        databaseVersion: DATABASE_VERSION,
        parserVersion: PARSER_VERSION,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        transactionCount: data.txCount,
        importCount: data.importCount,
        reviewSessionCount: data.reviewSessionCount,
        backupDate: data.lastBackupAt ?? null,
      }
      await Share.share({
        title: 'Paisa Buddy Diagnostics',
        message: JSON.stringify(payload, null, 2),
      })
    } finally {
      setExporting(false)
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
          <Text style={s.title}>Developer Mode</Text>
        </View>

        {settingsQuery.isLoading || perfQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <View style={s.body}>
            <View style={s.card}>
              <Row label="Home Load Time" value={perf ? `${perf.homeLoadMs} ms` : 'Not available'} />
              <Divider />
              <Row label="Month Load Time" value={perf ? `${perf.monthLoadMs} ms` : 'Not available'} />
              <Divider />
              <Row label="Settings Load Time" value={perf ? `${perf.settingsLoadMs} ms` : 'Not available'} />
              <Divider />
              <Row label="Transaction Count" value={perf?.transactionCount ?? data?.txCount ?? 0} />
              <Divider />
              <Row label="Database Size Estimate" value={perf ? formatBytes(perf.databaseSizeEstimate) : 'Not available'} />
              <Divider />
              <Row label="Backup Size Estimate" value={perf ? formatBytes(perf.backupSizeEstimate) : 'Not available'} />
              <Divider />
              <Row label="Latest Import Count" value={perf?.latestImportCount ?? 0} />
              <Divider />
              <Row label="Review Session Count" value={perf?.reviewSessionCount ?? data?.reviewSessionCount ?? 0} />
            </View>

            <View style={s.card}>
              <Row label="Database Version" value={DATABASE_VERSION} />
              <Divider />
              <Row label="Parser Version" value={PARSER_VERSION} />
              <Divider />
              <Row label="Schema Version" value={BACKUP_SCHEMA_VERSION} />
              <Divider />
              <Row label="Import Count" value={data?.importCount ?? 0} />
              <Divider />
              <Row label="Backup Date" value={data?.lastBackupAt ? new Date(data.lastBackupAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not available'} />
            </View>

            <View style={s.card}>
              {[1000, 5000, 10000].map((count) => (
                <React.Fragment key={count}>
                  <Pressable
                    style={s.actionRow}
                    onPress={() => handleGenerateDemoTransactions(count)}
                    disabled={!!demoAction}
                  >
                    <Text style={s.actionText}>
                      {demoAction === `generate-${count}` ? 'Generating...' : `Generate ${count.toLocaleString('en-IN')} Demo Transactions`}
                    </Text>
                  </Pressable>
                  <Divider />
                </React.Fragment>
              ))}
              <Pressable
                style={s.actionRow}
                onPress={handleClearDemoTransactions}
                disabled={!!demoAction}
              >
                <Text style={[s.actionText, s.dangerText]}>
                  {demoAction === 'clear' ? 'Clearing...' : 'Clear Demo Transactions'}
                </Text>
              </Pressable>
            </View>

            <Pressable style={s.refreshButton} onPress={refreshDeveloperData} disabled={perfQuery.isFetching || settingsQuery.isFetching}>
              <Text style={s.refreshText}>{perfQuery.isFetching || settingsQuery.isFetching ? 'Refreshing...' : 'Refresh Metrics'}</Text>
            </Pressable>
            <Pressable style={s.exportButton} onPress={handleExportDiagnostics} disabled={!data || exporting}>
              <Text style={s.exportText}>{exporting ? 'Exporting...' : 'Export Diagnostics'}</Text>
            </Pressable>
            <Text style={s.hint}>Diagnostics export includes metadata only. It does not include transactions, accounts, merchants, or balances.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  title: { fontSize: 21, fontFamily: F.extrabold, color: C.ink },
  loading: { paddingTop: 80, alignItems: 'center' },
  body: { paddingHorizontal: 18, gap: 12, paddingBottom: 34 },
  card: { backgroundColor: C.surface, borderRadius: RADIUS, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  label: { flex: 1, fontSize: 13, fontFamily: F.regular, color: C.ink3 },
  value: { maxWidth: '52%', textAlign: 'right', fontSize: 13, fontFamily: F.semibold, color: C.ink },
  divider: { height: 1, backgroundColor: C.line },
  actionRow: { paddingHorizontal: 16, paddingVertical: 14 },
  actionText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  dangerText: { color: C.neg },
  refreshButton: { alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, paddingVertical: 13 },
  refreshText: { fontSize: 14, fontFamily: F.semibold, color: C.ink2 },
  exportButton: { alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS, borderWidth: 1, borderColor: C.brand, backgroundColor: C.surface, paddingVertical: 13 },
  exportText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, lineHeight: 18 },
})
