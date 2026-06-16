import React from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

export function SettingsScreen() {
  const insets = useSafeAreaInsets()

  async function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
        },
      },
    ])
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 16 }]}>
      <Text style={s.heading}>Settings</Text>

      <Pressable style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Log out</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F2', paddingHorizontal: 20 },
  heading: { fontSize: 22, fontWeight: '800', color: '#16201A', marginBottom: 32 },
  logoutBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DB5A4B',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#DB5A4B' },
})
