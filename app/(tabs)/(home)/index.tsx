import { View, Text, FlatList, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/utils/colors';
import { currentMonthKey } from '@/utils/dates';
import { useUserName } from '@/hooks/use-onboarding';
import { TAB_BAR_HEIGHT } from '@/components/tab-bar';
import { SummaryCard } from '@/components/summary-card';
import { TransactionCard } from '@/components/transaction-card';
import { MonthHeader } from '@/components/month-header';
import { useMonthSummary } from '@/hooks/use-month-summary';
import { useTransactionsByMonth } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-categories';

export default function HomeScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { name } = useUserName();
  const greeting = name ? `Hello, ${name}` : 'Hello!';
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [showAll, setShowAll] = useState(false);
  const { summary, refresh: refreshSummary } = useMonthSummary(monthKey);
  const { transactions, refresh: refreshTransactions } = useTransactionsByMonth(monthKey);
  const { categories } = useCategories();

  useFocusEffect(
    useCallback(() => {
      refreshSummary();
      refreshTransactions();
    }, [refreshSummary, refreshTransactions])
  );

  function handleMonthChange(key: string) {
    setMonthKey(key);
    setShowAll(false);
  }

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const displayed = showAll ? transactions : transactions.slice(0, 5);
  const hasMore = transactions.length > 5;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 10, backgroundColor: Colors.background }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.text }}>{greeting}</Text>
      </View>
      <FlatList
        data={displayed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 12, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 }}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 8 }}>
            <MonthHeader monthKey={monthKey} onChange={handleMonthChange} />
            <SummaryCard summary={summary} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                RECENT
              </Text>
              {hasMore && (
                <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8}>
                  <Text style={{ color: Colors.accent, fontSize: 13, fontWeight: '600' }}>
                    {showAll ? 'Show Less' : 'See All'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TransactionCard
            transaction={item}
            category={categoryMap[item.categoryId]}
            onPress={() => {
              //router.push(`/transaction/${item.id}`)}
              router.push({ pathname: '/transaction/new', params: { editId: item.id } });
            }}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
            <Text style={{ fontSize: 40 }}>🪙</Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 15, textAlign: 'center' }}>
              No transactions yet.{'\n'}Tap + to add one.
            </Text>
          </View>
        }
      />
    </View>
  );
}
