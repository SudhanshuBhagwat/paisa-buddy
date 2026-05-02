import { useState, useEffect, useCallback } from 'react';
import type { MonthSummary } from '@/types/transaction';
import { getMonthSummary } from '@/db/transactions';

export function useMonthSummary(monthKey: string) {
  const [summary, setSummary] = useState<MonthSummary>({ income: 0, expense: 0, net: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getMonthSummary(monthKey);
    setSummary(data);
    setLoading(false);
  }, [monthKey]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  return { summary, loading, refresh };
}
