import { View, Text, Pressable, TextInput, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useColors } from '@/utils/colors';
import { useOnboarding } from '@/hooks/use-onboarding';
import { seedDefaultCategories } from '@/db/categories';

const SLIDES = [
  {
    emoji: '💰',
    title: 'Welcome to\nPaisa Buddy',
    subtitle: 'Your personal money tracker.\nSimple, fast, and always on point.',
  },
  {
    emoji: '🧾',
    title: 'Log Any Transaction',
    subtitle: 'Add expenses or income manually, or attach a receipt image directly from your gallery.',
  },
  {
    emoji: '📊',
    title: 'See Where You Stand',
    subtitle: 'Monthly summaries, category breakdowns, and a clear net balance — all in one place.',
  },
];

export default function Onboarding() {
  const Colors = useColors();
  const [slide, setSlide] = useState(0);
  const [name, setName] = useState('');
  const { completeOnboarding } = useOnboarding();
  const { width } = useWindowDimensions();

  async function handleStart() {
    await seedDefaultCategories();
    completeOnboarding(name);
    router.replace('/(tabs)/(home)');
  }

  const isLast = slide === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, padding: 24 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 }}>
        <Text style={{ fontSize: 80 }}>{SLIDES[slide].emoji}</Text>
        <Text
          style={{
            color: Colors.text,
            fontSize: 32,
            fontWeight: '800',
            textAlign: 'center',
            lineHeight: 40,
            letterSpacing: -0.5,
          }}
        >
          {SLIDES[slide].title}
        </Text>
        <Text
          style={{
            color: Colors.textSecondary,
            fontSize: 16,
            textAlign: 'center',
            lineHeight: 24,
            maxWidth: width * 0.75,
          }}
        >
          {SLIDES[slide].subtitle}
        </Text>

        {isLast && (
          <View style={{ width: '100%', gap: 8 }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
              What should we call you?
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleStart}
              style={{
                backgroundColor: Colors.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 17,
                color: Colors.text,
              }}
            />
          </View>
        )}
      </View>

      <View style={{ gap: 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === slide ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === slide ? Colors.accent : Colors.border,
              }}
            />
          ))}
        </View>

        <Pressable
          onPress={() => (isLast ? handleStart() : setSlide((s) => s + 1))}
          style={({ pressed }) => ({
            backgroundColor: pressed ? `${Colors.accent}CC` : Colors.accent,
            borderRadius: 16,
            borderCurve: 'continuous',
            padding: 18,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '700' }}>
            {isLast ? 'Get Started' : 'Next'}
          </Text>
        </Pressable>

        {!isLast && (
          <Pressable onPress={handleStart} style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
