import { View, Pressable, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useColors } from '@/utils/colors';

export const TAB_BAR_HEIGHT = 60;

type TabDef = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabDef[] = [
  { name: '(home)',       label: 'Home',       icon: 'home-outline',     activeIcon: 'home' },
  { name: '(stats)',      label: 'Stats',      icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  { name: '(categories)', label: 'Categories', icon: 'grid-outline',     activeIcon: 'grid' },
  { name: '(settings)',   label: 'Settings',   icon: 'settings-outline', activeIcon: 'settings' },
];

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const Colors = useColors();
  const insets = useSafeAreaInsets();

  function handleTabPress(routeName: string, routeKey: string, isFocused: boolean) {
    if (Platform.OS === 'ios') Haptics.selectionAsync();
    if (!isFocused) {
      navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
      navigation.navigate(routeName);
    }
  }

  function handleAddPress() {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/transaction/new');
  }

  const renderTab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    const def = TABS.find((t) => t.name === route.name) ?? TABS[routeIndex];
    const isFocused = state.index === routeIndex;
    const color = isFocused ? Colors.accent : Colors.textTertiary;

    return (
      <Pressable
        key={route.key}
        onPress={() => handleTabPress(route.name, route.key, isFocused)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 6 }}
        hitSlop={4}
      >
        <Ionicons name={isFocused ? def.activeIcon : def.icon} size={22} color={color} />
        <Text style={{ fontSize: 10, color, fontWeight: isFocused ? '600' : '400' }}>
          {def.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: TAB_BAR_HEIGHT + insets.bottom,
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: insets.bottom,
      }}
    >
      {renderTab(0)}
      {renderTab(1)}

      {/* Centre Add button */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable
          onPress={handleAddPress}
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: pressed ? `${Colors.accent}CC` : Colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            boxShadow: `0 4px 14px ${Colors.accent}55`,
          })}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>

      {renderTab(2)}
      {renderTab(3)}
    </View>
  );
}
