import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { getAccounts, getHomeData, getReviewData, getSettingsData, getStatsData } from '../lib/data'
import { queryKeys } from '../lib/query'
import { CustomBottomNav } from './BottomNav'
import { LoginScreen } from '../screens/LoginScreen'
import { SetupScreen } from '../screens/SetupScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { TransactionsScreen } from '../screens/TransactionsScreen'
import { StatsScreen } from '../screens/StatsScreen'
import { AccountsScreen } from '../screens/AccountsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { ReviewScreen } from '../screens/ReviewScreen'
import { ImportStatementScreen } from '../screens/ImportStatementScreen'
import { toYearMonth } from '@paisa-buddy/shared/logic/date'

export type RootStackParamList = {
  Login: undefined
  Setup: undefined
  Main: undefined
  ImportStatement: undefined
  Review: undefined
}

export type MainTabParamList = {
  Home: undefined
  Transactions: undefined
  Month: undefined
  Accounts: undefined
  Settings: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomBottomNav {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Month" component={StatsScreen} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}

function MainDataPrefetcher() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const month = toYearMonth(new Date())

    void Promise.allSettled([
      queryClient.prefetchQuery({ queryKey: queryKeys.home, queryFn: getHomeData }),
      queryClient.prefetchQuery({ queryKey: queryKeys.review, queryFn: getReviewData }),
      queryClient.prefetchQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts }),
      queryClient.prefetchQuery({ queryKey: queryKeys.settings, queryFn: getSettingsData }),
      queryClient.prefetchQuery({ queryKey: queryKeys.stats(month), queryFn: () => getStatsData(month) }),
    ])
  }, [queryClient])

  return null
}

export function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // setupCompleted will be fetched from DB once auth is confirmed; default false
  const [setupCompleted, setSetupCompleted] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s) setSetupCompleted(true)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) setSetupCompleted(true)
      else setSetupCompleted(false)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF7' }}>
        <ActivityIndicator size="large" color="#1A936F" />
      </View>
    )
  }

  const shouldPrefetchMainData = !!session && setupCompleted

  return (
    <>
      {shouldPrefetchMainData && <MainDataPrefetcher />}
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!session ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : !setupCompleted ? (
            <Stack.Screen name="Setup" component={SetupScreen} />
          ) : (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="ImportStatement" component={ImportStatementScreen} options={{ headerShown: false, animation: 'slide_from_right' }} />
              <Stack.Screen name="Review" component={ReviewScreen} options={{ headerShown: false, animation: 'slide_from_right' }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  )
}
