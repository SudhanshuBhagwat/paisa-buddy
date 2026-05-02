import { Stack } from 'expo-router';
import { useColors } from '@/utils/colors';

export default function RootLayout() {
  const Colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding/index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="transaction/new"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.78, 1.0],
          headerShown: false,
          contentStyle: { backgroundColor: Colors.surface },
        }}
      />
      <Stack.Screen
        name="transaction/[id]"
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Transaction',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
        }}
      />
    </Stack>
  );
}
