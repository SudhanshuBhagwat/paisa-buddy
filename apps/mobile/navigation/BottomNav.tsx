import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { C, F } from '../lib/tokens'

function HomeIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={active ? C.brand : C.ink3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {active && (
        <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 12h6v10H9z" fill={C.brand} stroke="none" />
      )}
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  )
}

function StatsIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={active ? C.brand : C.ink3} strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
    </Svg>
  )
}

function TransactionsIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={active ? C.brand : C.ink3} strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 2h12a2 2 0 0 1 2 2v18l-3-2-3 2-3-2-3 2-3-2-3 2V4a2 2 0 0 1 2-2z" />
      <Line x1="8" y1="8" x2="16" y2="8" />
      <Line x1="8" y1="12" x2="16" y2="12" />
      <Line x1="8" y1="16" x2="13" y2="16" />
    </Svg>
  )
}

function AccountsIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={active ? C.brand : C.ink3} strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 21h18" />
      <Path d="M5 21V10" />
      <Path d="M19 21V10" />
      <Path d="M9 21V10" />
      <Path d="M15 21V10" />
      <Path d="M3 10h18" />
      <Path d="M12 3 3 8h18z" />
    </Svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={active ? C.brand : C.ink3} strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  )
}

const ICONS: Record<string, (active: boolean) => React.JSX.Element> = {
  Home: (a) => <HomeIcon active={a} />,
  Transactions: (a) => <TransactionsIcon active={a} />,
  Stats: (a) => <StatsIcon active={a} />,
  Accounts: (a) => <AccountsIcon active={a} />,
  Settings: (a) => <SettingsIcon active={a} />,
}

type TabItemProps = {
  routeKey: string
  active: boolean
  label: string
  icon: ((active: boolean) => React.JSX.Element) | undefined
  onPress: () => void
}

function TabItem({ routeKey, active, label, icon, onPress }: TabItemProps) {
  const scale = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      key={routeKey}
      style={s.tab}
      onPressIn={() => { scale.value = withSpring(0.88, { damping: 15, stiffness: 300 }) }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }) }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[s.tabContent, animStyle]}>
        {icon && icon(active)}
        <Text style={[s.label, active ? s.labelActive : s.labelInactive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  )
}

export function CustomBottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[s.nav, { paddingBottom: Math.max(insets.bottom, 4) }]}>
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key]
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : (options.title ?? route.name)
        const active = state.index === i
        const icon = ICONS[route.name]

        function onPress() {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!active && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        return (
          <TabItem
            key={route.key}
            routeKey={route.key}
            active={active}
            label={label}
            icon={icon}
            onPress={onPress}
          />
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  tabContent: {
    alignItems: 'center',
    gap: 4,
  },
  label: { fontSize: 10 },
  labelActive: { fontFamily: F.bold, color: C.brand },
  labelInactive: { fontFamily: F.medium, color: C.ink3 },
})
