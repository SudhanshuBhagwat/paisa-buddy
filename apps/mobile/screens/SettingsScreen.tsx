import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

export function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF7' },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A1A' },
})
