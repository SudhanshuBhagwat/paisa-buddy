import React, { useCallback, useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

import { isSetupComplete } from '../repositories/settingsRepository'
import { getAccounts, getHomeData, getReviewData, getSettingsData, getStatsData } from '../lib/data'
import { queryKeys } from '../lib/query'
import { CustomBottomNav } from './BottomNav'
import { SetupScreen } from '../screens/SetupScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { TransactionsScreen } from '../screens/TransactionsScreen'
import { StatsScreen } from '../screens/StatsScreen'
import { AccountsScreen } from '../screens/AccountsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { ReviewScreen } from '../screens/ReviewScreen'
import { ImportStatementScreen } from '../screens/ImportStatementScreen'
import { toYearMonth } from '@paisa-buddy/shared/logic/date'
import { SetupCompleteCtx, SetupResetCtx } from './setupContext'
import type { MainTabParamList, RootStackParamList, SetupStartAction } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()

function MainTabs({ initialAction }: { initialAction?: SetupStartAction }) {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomBottomNav {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} initialParams={initialAction ? { initialAction } : undefined} />
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
  const [setupCompleted, setSetupCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [setupStartAction, setSetupStartAction] = useState<SetupStartAction | undefined>()

  useEffect(() => {
    isSetupComplete().then((done) => {
      setSetupCompleted(done)
      setLoading(false)
    })
  }, [])

  const onSetupComplete = useCallback((action?: SetupStartAction) => {
    setSetupStartAction(action)
    setSetupCompleted(true)
  }, [])
  const onSetupReset = useCallback(() => {
    setSetupStartAction(undefined)
    setSetupCompleted(false)
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F6F2' }}>
        <ActivityIndicator size="large" color="#1A936F" />
      </View>
    )
  }

  return (
    <SetupCompleteCtx.Provider value={onSetupComplete}>
    <SetupResetCtx.Provider value={onSetupReset}>
      {setupCompleted && <MainDataPrefetcher />}
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!setupCompleted ? (
            <Stack.Screen name="Setup" component={SetupScreen} />
          ) : (
            <>
              <Stack.Screen name="Main">
                {() => <MainTabs initialAction={setupStartAction} />}
              </Stack.Screen>
              <Stack.Screen name="ImportStatement" component={ImportStatementScreen} options={{ headerShown: false, animation: 'slide_from_right' }} />
              <Stack.Screen name="Review" component={ReviewScreen} options={{ headerShown: false, animation: 'slide_from_right' }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SetupResetCtx.Provider>
    </SetupCompleteCtx.Provider>
  )
}
