import React, { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getSettingsData } from '../lib/data'
import { BACKUP_SCHEMA_VERSION } from '../repositories/backupRepository'
import type { RootStackParamList } from '../navigation/types'
import { C, F, RADIUS } from '../lib/tokens'

type Nav = NativeStackNavigationProp<RootStackParamList>

const APP_VERSION = '1.0.0'
const DATABASE_VERSION = 7
const PARSER_VERSION = 'description-parser-v1'

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  )
}

function Divider() {
  return <View style={s.divider} />
}

export function DeveloperModeScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const [exporting, setExporting] = useState(false)
  const settingsQuery = useQuery({ queryKey: ['developerMode'], queryFn: getSettingsData })
  const data = settingsQuery.data?.settings ?? null

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

        {settingsQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <View style={s.body}>
            <View style={s.card}>
              <Row label="Database Version" value={DATABASE_VERSION} />
              <Divider />
              <Row label="Parser Version" value={PARSER_VERSION} />
              <Divider />
              <Row label="Schema Version" value={BACKUP_SCHEMA_VERSION} />
              <Divider />
              <Row label="Transaction Count" value={data?.txCount ?? 0} />
              <Divider />
              <Row label="Import Count" value={data?.importCount ?? 0} />
              <Divider />
              <Row label="Review Session Count" value={data?.reviewSessionCount ?? 0} />
              <Divider />
              <Row label="Backup Date" value={data?.lastBackupAt ? new Date(data.lastBackupAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not available'} />
            </View>

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
  exportButton: { alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS, borderWidth: 1, borderColor: C.brand, backgroundColor: C.surface, paddingVertical: 13 },
  exportText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, lineHeight: 18 },
})
