import React, { useCallback, useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono'
import { RootNavigator } from './navigation'
import { openDatabase } from './db/database'
import { LaunchSplash } from './components/LaunchSplash'

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be hidden in development reloads.
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
})

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  })
  const [dbReady, setDbReady] = useState(false)
  const [navigatorReady, setNavigatorReady] = useState(false)

  useEffect(() => {
    openDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('[DB] init failed:', err)
        setDbReady(true)
      })
  }, [])

  const appReady = fontsLoaded && dbReady

  useEffect(() => {
    if (!appReady || !navigatorReady) {
      return
    }

    void SplashScreen.hideAsync()
  }, [appReady, navigatorReady])

  const onNavigatorReady = useCallback(() => {
    setNavigatorReady(true)
  }, [])

  if (!appReady) {
    return <LaunchSplash />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <RootNavigator onReady={onNavigatorReady} />
          <StatusBar style="dark" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}
