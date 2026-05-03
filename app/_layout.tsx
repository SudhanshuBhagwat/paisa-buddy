import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColors } from '@/utils/colors';

export default function RootLayout() {
  const Colors = useColors();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          presentation: 'transparentModal',
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
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
    </GestureHandlerRootView>
  );
}
