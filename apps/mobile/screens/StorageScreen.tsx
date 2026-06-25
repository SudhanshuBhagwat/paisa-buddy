import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getSettingsData } from '../lib/data'
import { queryKeys } from '../lib/query'
import type { RootStackParamList } from '../navigation/types'
import { C, F, RADIUS } from '../lib/tokens'

type Nav = NativeStackNavigationProp<RootStackParamList>

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{String(value)}</Text>
    </View>
  )
}

function Divider() { return <View style={s.divider} /> }

export function StorageScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: getSettingsData })
  const data = settingsQuery.data?.settings ?? null

  const estimatedSize = formatBytes(JSON.stringify(settingsQuery.data ?? {}).length)

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.header, { paddingTop: insets.top + 14 }]}>
          <Pressable style={s.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18 9 12l6-6" />
            </Svg>
          </Pressable>
          <Text style={s.title}>Storage</Text>
        </View>

        {settingsQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <View style={s.body}>
            <View style={s.card}>
              <Row label="Transactions" value={data?.txCount ?? 0} />
              <Divider />
              <Row label="Accounts" value={data?.accountCount ?? 0} />
              <Divider />
              <Row label="Categories" value={data?.categoryCount ?? 0} />
              <Divider />
              <Row label="Estimated size" value={estimatedSize} />
            </View>
            <Text style={s.hint}>
              Your data is stored entirely on this device. Nothing is sent to any server.
            </Text>
          </View>
        )}
      </ScrollView>
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
    maxWidth: '52%', textAlign: 'right',
    fontSize: 13, fontFamily: F.semibold, color: C.ink,
  },
  divider: { height: 1, backgroundColor: C.line },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, lineHeight: 18 },
})
