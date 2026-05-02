import { Stack } from 'expo-router';
import { useColors } from '@/utils/colors';

export default function StatsStack() {
  const Colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
