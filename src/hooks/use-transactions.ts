import { useState, useEffect, useCallback } from 'react';
import type { Transaction } from '@/types/transaction';
import {
  getTransactionsByMonth,
  getRecentTransactions,
  upsertTransaction,
  deleteTransaction,
} from '@/db/transactions';
import * as FileSystem from 'expo-file-system/legacy';

export function useTransactionsByMonth(monthKey: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getTransactionsByMonth(monthKey);
    setTransactions(data);
    setLoading(false);
  }, [monthKey]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  return { transactions, loading, refresh };
}

export function useRecentTransactions(limit = 5) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getRecentTransactions(limit);
    setTransactions(data);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transactions, loading, refresh };
}

export async function saveTransaction(tx: Transaction): Promise<void> {
  await upsertTransaction(tx);
}

export async function removeTransaction(tx: Transaction): Promise<void> {
  await deleteTransaction(tx.id);
  if (tx.imageUri) {
    await FileSystem.deleteAsync(tx.imageUri, { idempotent: true });
  }
}
