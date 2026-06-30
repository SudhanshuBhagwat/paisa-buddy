import React, { useState } from 'react'
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
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

const APP_VERSION = '1.0.0'
const DATABASE_VERSION = DB_VERSION
const PARSER_VERSION = 'description-parser-v1'

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
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
    <ScreenRoot>
      <ScreenScroll>
        <BackScreenHeader title="Developer Mode" topInset={insets.top} onBack={() => navigation.goBack()} />

        {settingsQuery.isLoading || perfQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <ScreenBody>
            <SurfaceCard>
              <InfoRow label="Home Load Time" value={perf ? `${perf.homeLoadMs} ms` : 'Not available'} />
              <Divider />
              <InfoRow label="Month Load Time" value={perf ? `${perf.monthLoadMs} ms` : 'Not available'} />
              <Divider />
              <InfoRow label="Settings Load Time" value={perf ? `${perf.settingsLoadMs} ms` : 'Not available'} />
              <Divider />
              <InfoRow label="Transaction Count" value={perf?.transactionCount ?? data?.txCount ?? 0} />
              <Divider />
              <InfoRow label="Database Size Estimate" value={perf ? formatBytes(perf.databaseSizeEstimate) : 'Not available'} />
              <Divider />
              <InfoRow label="Backup Size Estimate" value={perf ? formatBytes(perf.backupSizeEstimate) : 'Not available'} />
              <Divider />
              <InfoRow label="Latest Import Count" value={perf?.latestImportCount ?? 0} />
              <Divider />
              <InfoRow label="Review Session Count" value={perf?.reviewSessionCount ?? data?.reviewSessionCount ?? 0} />
            </SurfaceCard>

            <SurfaceCard>
              <InfoRow label="Database Version" value={DATABASE_VERSION} />
              <Divider />
              <InfoRow label="Parser Version" value={PARSER_VERSION} />
              <Divider />
              <InfoRow label="Schema Version" value={BACKUP_SCHEMA_VERSION} />
              <Divider />
              <InfoRow label="Import Count" value={data?.importCount ?? 0} />
              <Divider />
              <InfoRow label="Backup Date" value={data?.lastBackupAt ? new Date(data.lastBackupAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not available'} />
            </SurfaceCard>

            <SurfaceCard>
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
            </SurfaceCard>

            <Pressable style={s.refreshButton} onPress={refreshDeveloperData} disabled={perfQuery.isFetching || settingsQuery.isFetching}>
              <Text style={s.refreshText}>{perfQuery.isFetching || settingsQuery.isFetching ? 'Refreshing...' : 'Refresh Metrics'}</Text>
            </Pressable>
            <Pressable style={s.exportButton} onPress={handleExportDiagnostics} disabled={!data || exporting}>
              <Text style={s.exportText}>{exporting ? 'Exporting...' : 'Export Diagnostics'}</Text>
            </Pressable>
            <Text style={s.hint}>Diagnostics export includes metadata only. It does not include transactions, accounts, merchants, or balances.</Text>
          </ScreenBody>
        )}
      </ScreenScroll>
    </ScreenRoot>
  )
}

const s = StyleSheet.create({
  loading: { paddingTop: 80, alignItems: 'center' },
  actionRow: { paddingHorizontal: 16, paddingVertical: 14 },
  actionText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  dangerText: { color: C.neg },
  refreshButton: { alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, paddingVertical: 13 },
  refreshText: { fontSize: 14, fontFamily: F.semibold, color: C.ink2 },
  exportButton: { alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS, borderWidth: 1, borderColor: C.brand, backgroundColor: C.surface, paddingVertical: 13 },
  exportText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, lineHeight: 18 },
})
