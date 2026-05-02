import { View, Text } from 'react-native';
import type { MonthSummary } from '@/types/transaction';
import { useColors } from '@/utils/colors';
import { formatCurrency } from '@/utils/currency';

type Props = {
  summary: MonthSummary;
};

export function SummaryCard({ summary }: Props) {
  const Colors = useColors();
  const netColor = summary.net >= 0 ? Colors.income : Colors.expense;

  return (
    <View
      style={{
        backgroundColor: Colors.surface,
        borderRadius: 20,
        borderCurve: 'continuous',
        padding: 24,
        gap: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '500' }}>
        NET BALANCE
      </Text>
      <Text
        selectable
        style={{
          color: netColor,
          fontSize: 36,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
          letterSpacing: -1,
        }}
      >
        {formatCurrency(Math.abs(summary.net))}
        {summary.net < 0 ? ' ↓' : summary.net > 0 ? ' ↑' : ''}
      </Text>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <MetricChip label="Income" value={summary.income} color={Colors.income} />
        <MetricChip label="Expense" value={summary.expense} color={Colors.expense} />
      </View>
    </View>
  );
}

function MetricChip({ label, value, color }: { label: string; value: number; color: string }) {
  const Colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.surfaceRaised,
        borderRadius: 12,
        borderCurve: 'continuous',
        padding: 12,
        gap: 4,
      }}
    >
      <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '500' }}>
        {label.toUpperCase()}
      </Text>
      <Text
        selectable
        style={{ color, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }}
      >
        {formatCurrency(value)}
      </Text>
    </View>
  );
}
