import { Tabs } from 'expo-router';
import { CustomTabBar } from '@/components/tab-bar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="(home)" />
      <Tabs.Screen name="(stats)" />
      <Tabs.Screen name="(categories)" />
      <Tabs.Screen name="(settings)" />
    </Tabs>
  );
}
