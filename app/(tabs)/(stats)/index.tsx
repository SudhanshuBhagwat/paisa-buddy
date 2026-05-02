import { View, Text, ScrollView, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PieChart } from 'react-native-gifted-charts';
import { useColors } from '@/utils/colors';
import { useTransactionsByMonth } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';
import { useMonthSummary } from '@/hooks/use-month-summary';
import { MonthHeader } from '@/components/month-header';
import { TAB_BAR_HEIGHT } from '@/components/tab-bar';
import { currentMonthKey, dateLabel } from '@/utils/dates';
import { formatCurrency } from '@/utils/currency';
import type { Transaction, TransactionType } from '@/types/transaction';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CHART_COLORS = [
  '#7C71F5', '#00C896', '#FF6B6B', '#FFB830',
  '#4ECDC4', '#FF8ED4', '#85C1E9', '#F7DC6F',
  '#A9DFBF', '#F1948A',
];

export default function StatsScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [activeType, setActiveType] = useState<TransactionType>('expense');
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);

  const { transactions, refresh } = useTransactionsByMonth(monthKey);
  const { categories } = useCategories();
  const { summary, refresh: refreshSummary } = useMonthSummary(monthKey);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshSummary();
    }, [refresh, refreshSummary])
  );

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const filtered = transactions.filter((t) => t.type === activeType);
  const typeTotal = filtered.reduce((s, t) => s + t.amount, 0);

  const grouped: Record<string, number> = {};
  for (const t of filtered) {
    grouped[t.categoryId] = (grouped[t.categoryId] ?? 0) + t.amount;
  }

  const segments = Object.entries(grouped)
    .map(([catId, amount], i) => ({
      categoryId: catId,
      category: categoryMap[catId],
      amount,
      percentage: typeTotal > 0 ? (amount / typeTotal) * 100 : 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
      txns: filtered.filter((t) => t.categoryId === catId).sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.amount - a.amount);

  const pieData = segments.length > 0
    ? segments.map((s) => ({ value: s.amount, color: s.color }))
    : [{ value: 1, color: Colors.surfaceRaised }];

  function toggleCategory(catId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCatId((prev) => (prev === catId ? null : catId));
  }

  function switchType(t: TransactionType) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveType(t);
    setExpandedCatId(null);
  }

  const netColor = summary.net >= 0 ? Colors.income : Colors.expense;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 10, backgroundColor: Colors.background }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.text }}>Stats</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 20, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <MonthHeader monthKey={monthKey} onChange={(k) => { setExpandedCatId(null); setMonthKey(k); }} />

        {/* Summary row */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SummaryChip label="Income" value={summary.income} color={Colors.income} />
          <SummaryChip label="Expense" value={summary.expense} color={Colors.expense} />
          <SummaryChip label="Net" value={summary.net} color={netColor} showSign />
        </View>

        {/* Type toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: Colors.surfaceRaised, borderRadius: 12, borderCurve: 'continuous', padding: 3 }}>
          {(['expense', 'income'] as TransactionType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => switchType(t)}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 10,
                borderCurve: 'continuous',
                alignItems: 'center',
                backgroundColor: activeType === t ? Colors.surface : 'transparent',
              }}
            >
              <Text style={{ color: activeType === t ? Colors.text : Colors.textTertiary, fontWeight: '600', fontSize: 14 }}>
                {t === 'expense' ? 'Expenses' : 'Income'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Pie chart card */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 20, alignItems: 'center', gap: 20 }}>
          <PieChart
            data={pieData}
            donut
            radius={100}
            innerRadius={64}
            innerCircleColor={Colors.surface}
            backgroundColor={Colors.surface}
            strokeWidth={2}
            strokeColor={Colors.surface}
            centerLabelComponent={() => (
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text, fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}>
                  {typeTotal > 0 ? formatCurrency(typeTotal) : '—'}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textSecondary, fontWeight: '500' }}>
                  {activeType === 'expense' ? 'total spent' : 'total earned'}
                </Text>
              </View>
            )}
          />

          {/* Legend */}
          {segments.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {segments.map((s) => (
                <View key={s.categoryId} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                  <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                    {s.category?.name ?? 'Other'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Category accordion */}
        {segments.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
            <Text style={{ fontSize: 36 }}>{activeType === 'expense' ? '📭' : '💸'}</Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 15, textAlign: 'center' }}>
              No {activeType === 'expense' ? 'expenses' : 'income'} this month.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '700' }}>BY CATEGORY</Text>
            {segments.map((seg) => {
              const isOpen = expandedCatId === seg.categoryId;
              return (
                <View
                  key={seg.categoryId}
                  style={{ backgroundColor: Colors.surface, borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden' }}
                >
                  <Pressable
                    onPress={() => toggleCategory(seg.categoryId)}
                    style={({ pressed }) => ({
                      padding: 14,
                      gap: 10,
                      backgroundColor: pressed ? Colors.surfaceRaised : 'transparent',
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: seg.color }} />
                      <Text style={{ fontSize: 18 }}>{seg.category?.emoji ?? '📦'}</Text>
                      <Text style={{ flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' }}>
                        {seg.category?.name ?? 'Unknown'}
                      </Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
                        {seg.percentage.toFixed(1)}%
                      </Text>
                      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], marginLeft: 6 }}>
                        {formatCurrency(seg.amount)}
                      </Text>
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={Colors.textTertiary}
                        style={{ marginLeft: 4 }}
                      />
                    </View>

                    <View style={{ height: 4, backgroundColor: Colors.surfaceRaised, borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: 4, width: `${seg.percentage}%`, backgroundColor: seg.color, borderRadius: 2 }} />
                    </View>
                  </Pressable>

                  {isOpen && (
                    <View style={{ borderTopWidth: 1, borderTopColor: Colors.border }}>
                      {seg.txns.map((tx, i) => (
                        <TxRow
                          key={tx.id}
                          tx={tx}
                          isLast={i === seg.txns.length - 1}
                          color={seg.color}
                          type={activeType}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TxRow({ tx, isLast, color, type }: { tx: Transaction; isLast: boolean; color: string; type: TransactionType }) {
  const Colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 11,
        gap: 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: Colors.border,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: 0.7 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
          {tx.note || (type === 'expense' ? 'Expense' : 'Income')}
        </Text>
        <Text style={{ color: Colors.textTertiary, fontSize: 11, marginTop: 1 }}>
          {dateLabel(tx.date)}
        </Text>
      </View>
      <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {formatCurrency(tx.amount)}
      </Text>
    </View>
  );
}

function SummaryChip({ label, value, color, showSign }: {
  label: string; value: number; color: string; showSign?: boolean;
}) {
  const Colors = useColors();
  const sign = showSign && value > 0 ? '+' : '';
  return (
    <View style={{ flex: 1, backgroundColor: Colors.surface, borderRadius: 12, borderCurve: 'continuous', padding: 12, gap: 4 }}>
      <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '600' }}>{label.toUpperCase()}</Text>
      <Text style={{ color, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {sign}{formatCurrency(Math.abs(value))}
      </Text>
    </View>
  );
}
