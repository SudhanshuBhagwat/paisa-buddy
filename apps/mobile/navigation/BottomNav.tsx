import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'

const BRAND = '#1A936F'
const INK3 = '#94A199'
const LINE = '#E7ECE5'

function HomeIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={active ? BRAND : INK3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {active && (
        <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 12h6v10H9z" fill={BRAND} stroke="none" />
      )}
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  )
}

function StatsIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={active ? BRAND : INK3} strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
    </Svg>
  )
}

function AccountsIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={active ? BRAND : INK3} strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="5" width="20" height="14" rx="2" />
      <Line x1="2" y1="10" x2="22" y2="10" />
    </Svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={active ? BRAND : INK3} strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  )
}

const ICONS: Record<string, (active: boolean) => React.JSX.Element> = {
  Home: (a) => <HomeIcon active={a} />,
  Stats: (a) => <StatsIcon active={a} />,
  Accounts: (a) => <AccountsIcon active={a} />,
  Settings: (a) => <SettingsIcon active={a} />,
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
          <Pressable
            key={route.key}
            style={s.tab}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {icon && icon(active)}
            <Text style={[s.label, active ? s.labelActive : s.labelInactive]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    gap: 4,
  },
  label: { fontSize: 10 },
  labelActive: { color: BRAND, fontWeight: '700' },
  labelInactive: { color: INK3, fontWeight: '500' },
})
