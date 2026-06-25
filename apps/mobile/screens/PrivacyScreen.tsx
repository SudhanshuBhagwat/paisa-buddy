import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { RootStackParamList } from '../navigation/types'
import { C, F, RADIUS } from '../lib/tokens'

type Nav = NativeStackNavigationProp<RootStackParamList>

function Divider() { return <View style={s.divider} /> }

export function PrivacyScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.header, { paddingTop: insets.top + 14 }]}>
          <Pressable style={s.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18 9 12l6-6" />
            </Svg>
          </Pressable>
          <Text style={s.title}>Privacy</Text>
        </View>

        <View style={s.body}>
          <View style={s.card}>
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
          </View>
        </View>
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
  body: { paddingHorizontal: 18, gap: 12, paddingBottom: 34 },
  card: {
    backgroundColor: C.surface, borderRadius: RADIUS,
    borderWidth: 1, borderColor: C.line, overflow: 'hidden',
  },
  block: { paddingHorizontal: 16, paddingVertical: 16, gap: 6 },
  blockTitle: { fontSize: 14, fontFamily: F.bold, color: C.ink },
  blockText: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 20 },
  divider: { height: 1, backgroundColor: C.line },
})
