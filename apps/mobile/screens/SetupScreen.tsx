import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

export function SetupScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Setup</Text>
      <Text style={styles.subtitle}>Phase 25 — coming next</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF7' },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 8 },
})
