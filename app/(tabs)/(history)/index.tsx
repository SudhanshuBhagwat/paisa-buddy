import { View, Text, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/utils/colors';
import { currentMonthKey } from '@/utils/dates';
import { TAB_BAR_HEIGHT } from '@/components/tab-bar';
import { TransactionCard } from '@/components/transaction-card';
import { MonthHeader } from '@/components/month-header';
import { useTransactionsByMonth } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';

export default function HistoryScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const { transactions, loading, refresh } = useTransactionsByMonth(monthKey);
  const { categories } = useCategories();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <View style={{ flex: 1 }}>
    <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 10, backgroundColor: Colors.background }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.text }}>History</Text>
    </View>
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 12, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 }}
      ListHeaderComponent={
        <View style={{ marginBottom: 8 }}>
          <MonthHeader monthKey={monthKey} onChange={setMonthKey} />
        </View>
      }
      renderItem={({ item }) => (
        <TransactionCard
          transaction={item}
          category={categoryMap[item.categoryId]}
          onPress={() => router.push(`/transaction/${item.id}`)}
        />
      )}
      ListEmptyComponent={
        !loading ? (
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 60 }}>
            <Text style={{ fontSize: 40 }}>📭</Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 15, textAlign: 'center' }}>
              No transactions this month.
            </Text>
          </View>
        ) : null
      }
    />
    </View>
  );
}
