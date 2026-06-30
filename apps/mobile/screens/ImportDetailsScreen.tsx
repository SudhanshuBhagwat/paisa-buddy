import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getImportDetails } from '../repositories/importRepository'
import type { RootStackParamList } from '../navigation/types'
import { C, F } from '../lib/tokens'
import {
  BackScreenHeader,
  Divider,
  EmptyState,
  InfoRow,
  ScreenBody,
  ScreenRoot,
  ScreenScroll,
  SurfaceCard,
} from '../components/ScreenPrimitives'

type Route = RouteProp<RootStackParamList, 'ImportDetails'>
type Nav = NativeStackNavigationProp<RootStackParamList>

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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
    <ScreenRoot>
      <ScreenScroll>
        <BackScreenHeader title="Import Details" topInset={insets.top} onBack={() => navigation.goBack()} />

        {detailsQuery.isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.brand} /></View>
        ) : !details || !session ? (
          <EmptyState
            style={s.emptyCard}
            title="Import not found"
            message="This import may have been removed or undone."
          />
        ) : (
          <ScreenBody>
            <SurfaceCard>
              <Text style={s.fileName} numberOfLines={2}>{session.file_name || session.filename || 'Imported statement'}</Text>
              <Text style={s.fileMeta}>Imported {formatDate(session.updated_at ?? session.created_at)}</Text>
            </SurfaceCard>

            <SurfaceCard>
              <InfoRow label="Statement period" value={period} />
              <Divider />
              <InfoRow label="Transactions imported" value={details.transactionsImported} />
              <Divider />
              <InfoRow label="Duplicates" value={details.duplicateCount} />
              <Divider />
              <InfoRow label="Groups" value={details.groupCount} />
            </SurfaceCard>

            <SurfaceCard>
              <InfoRow label="New merchants" value={details.newMerchantCount} />
              <Divider />
              <InfoRow label="Learned mappings used" value={details.learnedMappingsUsed} />
              <Divider />
              <InfoRow label="Unknown merchants" value={details.unknownMerchantCount} />
              <Divider />
              <InfoRow label="Review completion" value={reviewCompletion} />
            </SurfaceCard>

            <SurfaceCard>
              <InfoRow label="Import status" value={session.status} />
              <Divider />
              <InfoRow label="Review status" value={details.reviewStatus} />
            </SurfaceCard>
          </ScreenBody>
        )}
      </ScreenScroll>
    </ScreenRoot>
  )
}

const s = StyleSheet.create({
  loading: { paddingTop: 80, alignItems: 'center' },
  fileName: { paddingHorizontal: 16, paddingTop: 15, fontSize: 15, fontFamily: F.extrabold, color: C.ink },
  fileMeta: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 15, fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  emptyCard: { margin: 18, paddingHorizontal: 18 },
})
