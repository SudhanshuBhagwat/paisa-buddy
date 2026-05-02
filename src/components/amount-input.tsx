import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useColors } from '@/utils/colors';
import * as Haptics from 'expo-haptics';

type Props = {
  paise: number;
  onChange: (paise: number) => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function AmountInput({ paise, onChange }: Props) {
  const Colors = useColors();
  const [displayStr, setDisplayStr] = useState('');

  useEffect(() => {
    if (paise > 0 && displayStr === '') {
      const rupees = paise / 100;
      setDisplayStr(Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2));
    }
  }, [paise]);

  function handleKey(key: string) {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (key === '⌫') {
      const next = displayStr.slice(0, -1);
      setDisplayStr(next);
      onChange(toPaise(next));
      return;
    }

    if (key === '.') {
      if (displayStr.includes('.')) return;
      const next = displayStr + '.';
      setDisplayStr(next);
      return;
    }

    const dotIndex = displayStr.indexOf('.');
    if (dotIndex !== -1 && displayStr.length - dotIndex > 2) return;

    if (displayStr === '0' && key !== '.') {
      const next = key;
      setDisplayStr(next);
      onChange(toPaise(next));
      return;
    }

    const next = displayStr + key;
    setDisplayStr(next);
    onChange(toPaise(next));
  }

  const displayAmount = formatDisplay(displayStr);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ alignItems: 'center', paddingVertical: 4 }}>
        <Text
          style={{
            color: paise === 0 ? Colors.textTertiary : Colors.text,
            fontSize: 52,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
            letterSpacing: -2,
            marginBottom: 16
          }}
        >
          ₹{displayAmount}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 36 }}>
        {KEYS.map((key) => (
          <NumKey key={key} label={key} onPress={() => handleKey(key)} />
        ))}
      </View>
    </View>
  );
}

function NumKey({ label, onPress }: { label: string; onPress: () => void }) {
  const Colors = useColors();
  const isBack = label === '⌫';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: '31%',
        paddingVertical: 16,
        backgroundColor: isBack
          ? pressed ? Colors.surfaceRaised : 'transparent'
          : Colors.surfaceRaised,
        borderRadius: 18,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text
        style={{
          color: Colors.text,
          fontSize: isBack ? 24 : 22,
          fontWeight: isBack ? '400' : '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function formatDisplay(str: string): string {
  if (!str) return '0';
  const [intPart, decPart] = str.split('.');
  const intNum = parseInt(intPart || '0', 10);
  const intFormatted = isNaN(intNum) ? (intPart || '0') : intNum.toLocaleString('en-IN');
  return decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted;
}

function toPaise(str: string): number {
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}
