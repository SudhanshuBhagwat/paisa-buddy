import { View, Text, Pressable } from 'react-native';
import type { Transaction } from '@/types/transaction';
import type { Category } from '@/types/transaction';
import { useColors } from '@/utils/colors';
import { formatCurrency } from '@/utils/currency';
import { dateLabel } from '@/utils/dates';

type Props = {
  transaction: Transaction;
  category?: Category;
  onPress?: () => void;
};

export function TransactionCard({ transaction, category, onPress }: Props) {
  const Colors = useColors();
  const isExpense = transaction.type === 'expense';
  const amountColor = isExpense ? Colors.expense : Colors.income;
  const prefix = isExpense ? '-' : '+';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: pressed ? Colors.surfaceRaised : Colors.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        gap: 12,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: Colors.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 22 }}>{category?.emoji ?? '📦'}</Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: Colors.text,
            fontSize: 15,
            fontWeight: '600',
          }}
        >
          {category?.name ?? 'Unknown'}
        </Text>
        <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
          {[transaction.note, dateLabel(transaction.date)].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <Text
        selectable
        style={{
          color: amountColor,
          fontSize: 16,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
        }}
      >
        {prefix}{formatCurrency(transaction.amount)}
      </Text>
    </Pressable>
  );
}
