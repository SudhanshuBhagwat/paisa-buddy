import type { Category, TransactionType } from '@/types/transaction';
import { getDb } from './index';

const DEFAULT_CATEGORIES: Omit<Category, 'isDefault'>[] = [
  { id: 'food', name: 'Food', type: 'expense', emoji: '🍔' },
  { id: 'transport', name: 'Transport', type: 'expense', emoji: '🚗' },
  { id: 'shopping', name: 'Shopping', type: 'expense', emoji: '🛍️' },
  { id: 'bills', name: 'Bills', type: 'expense', emoji: '💡' },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', emoji: '🎬' },
  { id: 'expense-other', name: 'Other', type: 'expense', emoji: '📦' },
  { id: 'received', name: 'Received', type: 'income', emoji: '💸' },
  { id: 'salary', name: 'Salary', type: 'income', emoji: '💼' },
  { id: 'freelance', name: 'Freelance', type: 'income', emoji: '💻' },
  { id: 'income-other', name: 'Other', type: 'income', emoji: '📥' },
];

export async function seedDefaultCategories(): Promise<void> {
  const db = await getDb();
  for (const cat of DEFAULT_CATEGORIES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, name, type, emoji, is_default) VALUES (?, ?, ?, ?, 1)`,
      [cat.id, cat.name, cat.type, cat.emoji]
    );
  }
}

export async function getCategories(type?: TransactionType): Promise<Category[]> {
  const db = await getDb();
  const rows = type
    ? await db.getAllAsync<any>('SELECT * FROM categories WHERE type = ? ORDER BY is_default DESC, name ASC', [type])
    : await db.getAllAsync<any>('SELECT * FROM categories ORDER BY type, is_default DESC, name ASC');
  return rows.map(rowToCategory);
}

export async function addCategory(category: Omit<Category, 'isDefault'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO categories (id, name, type, emoji, is_default) VALUES (?, ?, ?, ?, 0)`,
    [category.id, category.name, category.type, category.emoji]
  );
}

export async function updateCategory(id: string, name: string, emoji: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET name = ?, emoji = ? WHERE id = ?', [name, emoji, id]);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ? AND is_default = 0', [id]);
}

function rowToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type as TransactionType,
    emoji: row.emoji,
    isDefault: row.is_default === 1,
  };
}
