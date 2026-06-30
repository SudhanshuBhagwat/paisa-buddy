import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { RootStackParamList } from '../navigation/types'
import { C, F } from '../lib/tokens'
import {
  BackScreenHeader,
  Divider,
  ScreenBody,
  ScreenRoot,
  ScreenScroll,
  SurfaceCard,
} from '../components/ScreenPrimitives'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function PrivacyScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()

  return (
    <ScreenRoot>
      <ScreenScroll>
        <BackScreenHeader title="Privacy" topInset={insets.top} onBack={() => navigation.goBack()} />

        <ScreenBody>
          <SurfaceCard>
            <View style={s.block}>
              <Text style={s.blockTitle}>Offline first</Text>
              <Text style={s.blockText}>
                Paisa Buddy works entirely on your device. Your transactions, accounts, and categories are stored in a local database — nothing is uploaded to any server.
              </Text>
            </View>
            <Divider />
            <View style={s.block}>
              <Text style={s.blockTitle}>No accounts, no tracking</Text>
              <Text style={s.blockText}>
                There is no login, no user account, and no analytics. The app cannot identify you, and your financial data never leaves your phone unless you export it yourself.
              </Text>
            </View>
            <Divider />
            <View style={s.block}>
              <Text style={s.blockTitle}>Your exports</Text>
              <Text style={s.blockText}>
                When you export a backup or CSV, the data goes only where you send it — your email, cloud storage, or another device. Paisa Buddy has no visibility into where exported files go.
              </Text>
            </View>
          </SurfaceCard>
        </ScreenBody>
      </ScreenScroll>
    </ScreenRoot>
  )
}

const s = StyleSheet.create({
  block: { paddingHorizontal: 16, paddingVertical: 16, gap: 6 },
  blockTitle: { fontSize: 14, fontFamily: F.bold, color: C.ink },
  blockText: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 20 },
})
