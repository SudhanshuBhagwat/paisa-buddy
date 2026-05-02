import { View, Text, Pressable } from 'react-native';
import { useColors } from '@/utils/colors';
import { monthLabel, prevMonth, nextMonth, isFutureMonth, currentMonthKey } from '@/utils/dates';

type Props = {
  monthKey: string;
  onChange: (key: string) => void;
  onTap?: () => void;
};

export function MonthHeader({ monthKey, onChange, onTap }: Props) {
  const Colors = useColors();
  const canGoNext = !isFutureMonth(nextMonth(monthKey));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        onPress={() => onChange(prevMonth(monthKey))}
        style={{ padding: 8 }}
        hitSlop={8}
      >
        <Text style={{ color: Colors.textSecondary, fontSize: 20 }}>‹</Text>
      </Pressable>

      <Pressable
        onPress={onTap}
        style={{
          flex: 1,
          alignItems: 'center',
          paddingVertical: 6,
          paddingHorizontal: 12,
          backgroundColor: Colors.surface,
          borderRadius: 10,
          borderCurve: 'continuous',
        }}
      >
        <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '600' }}>
          {monthLabel(monthKey)}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => canGoNext && onChange(nextMonth(monthKey))}
        style={{ padding: 8 }}
        hitSlop={8}
      >
        <Text style={{ color: canGoNext ? Colors.textSecondary : Colors.border, fontSize: 20 }}>
          ›
        </Text>
      </Pressable>
    </View>
  );
}
