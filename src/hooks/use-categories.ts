import { useState, useEffect, useCallback } from 'react';
import type { Category, TransactionType } from '@/types/transaction';
import { getCategories, addCategory, updateCategory, deleteCategory } from '@/db/categories';
import { generateId } from '@/utils/dates';

export function useCategories(type?: TransactionType) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getCategories(type);
    setCategories(data);
    setLoading(false);
  }, [type]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (name: string, emoji: string, catType: TransactionType) => {
      await addCategory({ id: generateId(), name, emoji, type: catType });
      await refresh();
    },
    [refresh]
  );

  const update = useCallback(
    async (id: string, name: string, emoji: string) => {
      await updateCategory(id, name, emoji);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteCategory(id);
      await refresh();
    },
    [refresh]
  );

  return { categories, loading, refresh, add, update, remove };
}
