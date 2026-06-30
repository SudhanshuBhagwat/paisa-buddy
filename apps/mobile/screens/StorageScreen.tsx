import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getSettingsData } from '../lib/data'
import { queryKeys } from '../lib/query'
import { getDb } from '../db/database'
import type { RootStackParamList } from '../navigation/types'
import { C, F } from '../lib/tokens'
import {
  BackScreenHeader,
  Divider,
  InfoRow,
  ScreenBody,
  ScreenRoot,
  ScreenScroll,
  SurfaceCard,
} from '../components/ScreenPrimitives'

async function getDbSize(): Promise<number | null> {
  try {
    const db = getDb()
    const [pcRow, psRow] = await Promise.all([
      db.getFirstAsync<{ page_count: number }>('PRAGMA page_count'),
      db.getFirstAsync<{ page_size: number }>('PRAGMA page_size'),
    ])
    if (pcRow && psRow) return pcRow.page_count * psRow.page_size
    return null
  } catch {
    return null
  }
}

type Nav = NativeStackNavigationProp<RootStackParamList>

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function StorageScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: getSettingsData })
  const dbSizeQuery = useQuery({ queryKey: ['dbSize'], queryFn: getDbSize })
  const data = settingsQuery.data?.settings ?? null
  const dbSizeBytes = dbSizeQuery.data ?? null
  const dbSizeLabel = dbSizeBytes !== null ? 'Database size' : 'Estimated database size'
  const dbSizeValue = dbSizeBytes !== null
    ? formatBytes(dbSizeBytes)
    : formatBytes(Math.max(8192, (data?.txCount ?? 0) * 512))

  return (
    <ScreenRoot>
      <ScreenScroll>
        <BackScreenHeader title="Storage" topInset={insets.top} onBack={() => navigation.goBack()} />

        {settingsQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <ScreenBody>
            <SurfaceCard>
              <InfoRow label="Transactions" value={data?.txCount ?? 0} />
              <Divider />
              <InfoRow label="Accounts" value={data?.accountCount ?? 0} />
              <Divider />
              <InfoRow label="Categories" value={data?.categoryCount ?? 0} />
              <Divider />
              <InfoRow label={dbSizeLabel} value={dbSizeValue} />
            </SurfaceCard>
            <Text style={s.hint}>
              Your data is stored entirely on this device. Nothing is sent to any server.
            </Text>
          </ScreenBody>
        )}
      </ScreenScroll>
    </ScreenRoot>
  )
}

const s = StyleSheet.create({
  loading: { paddingTop: 80, alignItems: 'center' },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, lineHeight: 18 },
})
