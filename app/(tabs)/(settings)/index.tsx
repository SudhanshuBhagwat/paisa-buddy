import { View, Text, TextInput, Pressable, Switch, Animated, Keyboard, ScrollView, Alert } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/utils/colors';
import { useUserName } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { TAB_BAR_HEIGHT } from '@/components/tab-bar';
import { seedTestData, clearAllTransactions } from '@/db/seed';

function Toast({ toastKey, message }: { toastKey: number; message: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (toastKey === 0) return;
    opacity.setValue(0);
    translateY.setValue(10);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
      Animated.delay(1400),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -6, duration: 250, useNativeDriver: true }),
      ]),
    ]).start();
  }, [toastKey]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 120,
        alignSelf: 'center',
        opacity,
        transform: [{ translateY }],
        backgroundColor: '#1C1C2E',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
      }}
      pointerEvents="none"
    >
      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>{message}</Text>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { name, setName } = useUserName();
  const { isDark, setMode } = useTheme();
  const [nameInput, setNameInput] = useState(name);
  const [toastKey, setToastKey] = useState(0);
  const [toastMessage, setToastMessage] = useState('');

  function showToast(msg: string) {
    setToastMessage(msg);
    setToastKey((k) => k + 1);
  }

  function handleSaveName() {
    if (!nameInput.trim()) return;
    setName(nameInput);
    Keyboard.dismiss();
    setTimeout(() => showToast('✓  Name saved'), 350);
  }

  async function handleSeed() {
    const { skipped } = await seedTestData();
    showToast(skipped ? 'Already has data' : '✓  Test data seeded');
  }

  function handleClear() {
    Alert.alert(
      'Clear All Transactions',
      'This will delete every transaction permanently. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllTransactions();
            showToast('✓  All transactions cleared');
          },
        },
      ]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 10, backgroundColor: Colors.background }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.text }}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 24, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '700' }}>PROFILE</Text>
          <View style={{ backgroundColor: Colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 14, gap: 10 }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>Your name</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Enter your name"
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                style={{
                  flex: 1,
                  color: Colors.text,
                  fontSize: 16,
                  backgroundColor: Colors.surfaceRaised,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              />
              <Pressable
                onPress={handleSaveName}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? `${Colors.accent}CC` : Colors.accent,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                })}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Theme */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '700' }}>APPEARANCE</Text>
          <View style={{ backgroundColor: Colors.surface, borderRadius: 14, borderCurve: 'continuous', padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: Colors.text, fontSize: 16 }}>Dark mode</Text>
              <Switch
                value={isDark}
                onValueChange={(val) => setMode(val ? 'dark' : 'light')}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Developer */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '700' }}>DEVELOPER</Text>
          <View style={{ backgroundColor: Colors.surface, borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden' }}>
            <Pressable
              onPress={handleSeed}
              style={({ pressed }) => ({
                padding: 16,
                backgroundColor: pressed ? Colors.surfaceRaised : 'transparent',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderColor: Colors.border,
              })}
            >
              <Text style={{ color: Colors.text, fontSize: 15 }}>Seed test data</Text>
              <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>7 months</Text>
            </Pressable>
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => ({
                padding: 16,
                backgroundColor: pressed ? Colors.surfaceRaised : 'transparent',
              })}
            >
              <Text style={{ color: Colors.destructive, fontSize: 15 }}>Clear all transactions</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Toast toastKey={toastKey} message={toastMessage} />
    </View>
  );
}
