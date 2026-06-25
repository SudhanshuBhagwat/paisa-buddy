import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getImportDetails } from '../repositories/importRepository'
import type { RootStackParamList } from '../navigation/types'
import { C, F, RADIUS } from '../lib/tokens'

type Route = RouteProp<RootStackParamList, 'ImportDetails'>
type Nav = NativeStackNavigationProp<RootStackParamList>

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.metricRow}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  )
}

function Divider() {
  return <View style={s.divider} />
}

export function ImportDetailsScreen() {
  const insets = useSafeAreaInsets()
  const route = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const detailsQuery = useQuery({
    queryKey: ['importDetails', route.params.importSessionId],
    queryFn: () => getImportDetails(route.params.importSessionId),
  })
  const details = detailsQuery.data ?? null
  const session = details?.session ?? null
  const period = session?.statement_start_date || session?.statement_end_date
    ? `${formatDate(session?.statement_start_date)} - ${formatDate(session?.statement_end_date)}`
    : 'Not available'
  const reviewCompletion = details
    ? `${details.reviewedCount} / ${details.totalReviewCount} reviewed`
    : 'Not available'

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.header, { paddingTop: insets.top + 14 }]}>
          <Pressable style={s.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18 9 12l6-6" />
            </Svg>
          </Pressable>
          <Text style={s.title}>Import Details</Text>
        </View>

        {detailsQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : !details || !session ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>Import not found</Text>
            <Text style={s.emptyText}>This import may have been removed or undone.</Text>
          </View>
        ) : (
          <View style={s.body}>
            <View style={s.card}>
              <Text style={s.fileName} numberOfLines={2}>{session.file_name || session.filename || 'Imported statement'}</Text>
              <Text style={s.fileMeta}>Imported {formatDate(session.updated_at ?? session.created_at)}</Text>
            </View>

            <View style={s.card}>
              <MetricRow label="Statement period" value={period} />
              <Divider />
              <MetricRow label="Transactions imported" value={details.transactionsImported} />
              <Divider />
              <MetricRow label="Duplicates" value={details.duplicateCount} />
              <Divider />
              <MetricRow label="Groups" value={details.groupCount} />
            </View>

            <View style={s.card}>
              <MetricRow label="New merchants" value={details.newMerchantCount} />
              <Divider />
              <MetricRow label="Learned mappings used" value={details.learnedMappingsUsed} />
              <Divider />
              <MetricRow label="Unknown merchants" value={details.unknownMerchantCount} />
              <Divider />
              <MetricRow label="Review completion" value={reviewCompletion} />
            </View>

            <View style={s.card}>
              <MetricRow label="Import status" value={session.status} />
              <Divider />
              <MetricRow label="Review status" value={details.reviewStatus} />
            </View>
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
  fileName: { paddingHorizontal: 16, paddingTop: 15, fontSize: 15, fontFamily: F.extrabold, color: C.ink },
  fileMeta: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 15, fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  metricLabel: { flex: 1, fontSize: 13, fontFamily: F.regular, color: C.ink3 },
  metricValue: { maxWidth: '52%', textAlign: 'right', fontSize: 13, fontFamily: F.semibold, color: C.ink },
  divider: { height: 1, backgroundColor: C.line },
  emptyCard: { margin: 18, padding: 18, borderRadius: RADIUS, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  emptyTitle: { fontSize: 15, fontFamily: F.extrabold, color: C.ink },
  emptyText: { marginTop: 4, fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 19 },
})
