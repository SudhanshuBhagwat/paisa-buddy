import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Image } from 'expo-image';
import { useColors } from '@/utils/colors';
import { formatCurrency } from '@/utils/currency';
import { dateLabel } from '@/utils/dates';
import { getTransactionById } from '@/db/transactions';
import { getCategories } from '@/db/categories';
import { removeTransaction } from '@/hooks/use-transactions';
import type { Transaction } from '@/types/transaction';
import type { Category } from '@/types/transaction';

export default function TransactionDetail() {
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [category, setCategory] = useState<Category | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      async function load() {
        const tx = await getTransactionById(id);
        setTransaction(tx);
        if (tx) {
          const cats = await getCategories();
          setCategory(cats.find((c) => c.id === tx.categoryId) ?? null);
        }
      }
      load();
    }, [id])
  );

  function handleEdit() {
    if (!transaction) return;
    router.push({ pathname: '/transaction/new', params: { editId: transaction.id } });
  }

  function handleDelete() {
    if (!transaction) return;
    Alert.alert(
      'Delete Transaction',
      'This will permanently delete this transaction. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeTransaction(transaction);
            router.back();
          },
        },
      ]
    );
  }

  if (!transaction) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  const isExpense = transaction.type === 'expense';
  const amountColor = isExpense ? Colors.expense : Colors.income;
  const prefix = isExpense ? '-' : '+';

  return (
    <>
      <Stack.Screen options={{ headerTitle: 'Transaction' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}
      >
        {/* Amount hero */}
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 16 }}>
          <Text style={{ fontSize: 48 }}>{category?.emoji ?? '📦'}</Text>
          <Text
            style={{
              color: amountColor,
              fontSize: 42,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
              letterSpacing: -1,
            }}
          >
            {prefix}{formatCurrency(transaction.amount)}
          </Text>
          <Text style={{ color: Colors.textSecondary, fontSize: 15 }}>
            {category?.name ?? 'Unknown'} · {dateLabel(transaction.date)}
          </Text>
        </View>

        {/* Details card */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' }}>
          <DetailRow label="Type" value={transaction.type === 'expense' ? 'Expense' : 'Income'} />
          <DetailRow label="Category" value={`${category?.emoji ?? ''} ${category?.name ?? '—'}`} />
          <DetailRow label="Date" value={dateLabel(transaction.date)} />
          {transaction.note && <DetailRow label="Note" value={transaction.note} />}
        </View>

        {/* Receipt image */}
        {transaction.imageUri && (
          <View style={{ gap: 8 }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '600' }}>RECEIPT</Text>
            <View style={{ borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden' }}>
              <Image source={{ uri: transaction.imageUri }} style={{ width: '100%', height: 220 }} contentFit="cover" />
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => ({
              padding: 16,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: pressed ? `${Colors.accent}18` : 'transparent',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: `${Colors.accent}44`,
            })}
          >
            <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 16 }}>
              Edit Transaction
            </Text>
          </Pressable>

          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => ({
              padding: 16,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: pressed ? `${Colors.destructive}22` : `${Colors.destructive}11`,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: `${Colors.destructive}33`,
            })}
          >
            <Text style={{ color: Colors.destructive, fontWeight: '700', fontSize: 16 }}>
              Delete Transaction
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const Colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}
