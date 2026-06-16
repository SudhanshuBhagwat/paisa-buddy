import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import { LoginScreen } from '../screens/LoginScreen'
import { SetupScreen } from '../screens/SetupScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { StatsScreen } from '../screens/StatsScreen'
import { AccountsScreen } from '../screens/AccountsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'

export type RootStackParamList = {
  Login: undefined
  Setup: undefined
  Main: undefined
}

export type MainTabParamList = {
  Home: undefined
  Stats: undefined
  Accounts: undefined
  Settings: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1A936F',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E5E7EB' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}

export function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // setupCompleted will be fetched from DB once auth is confirmed; default false
  const [setupCompleted, setSetupCompleted] = useState(false)

  useEffect(() => {
    // Restore session from SecureStore on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s) loadSetupStatus(s.user.id)
      else setLoading(false)
    })

    // Listen for future auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) loadSetupStatus(s.user.id)
      else { setSetupCompleted(false); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadSetupStatus(userId: string) {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('setup_completed')
        .eq('user_id', userId)
        .maybeSingle()
      setSetupCompleted(data?.setup_completed ?? false)
    } catch {
      setSetupCompleted(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF7' }}>
        <ActivityIndicator size="large" color="#1A936F" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !setupCompleted ? (
          <Stack.Screen name="Setup" component={SetupScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
