import React from 'react'
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'

const splashLogo = require('../assets/splash-logo.png')

export function LaunchSplash() {
  const { width } = useWindowDimensions()
  const logoSize = Math.min(240, Math.max(180, width * 0.5))

  return (
    <View style={styles.root}>
      <StatusBar style="light" backgroundColor={styles.root.backgroundColor} />
      <Image source={splashLogo} style={{ width: logoSize, height: logoSize }} resizeMode="contain" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B8D68',
  },
})
