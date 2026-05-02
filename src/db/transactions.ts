import type { Transaction, TransactionType, MonthSummary } from '@/types/transaction';
import { getDb } from './index';

export async function getTransactionsByMonth(monthKey: string): Promise<Transaction[]> {
  const db = await getDb();
  const [year, month] = monthKey.split('-');
  const start = `${year}-${month}-01`;
  const end = `${year}-${month}-31`;
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY date DESC, created_at DESC',
    [start, end]
  );
  return rows.map(rowToTransaction);
}

export async function getRecentTransactions(limit = 5): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT ?',
    [limit]
  );
  return rows.map(rowToTransaction);
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?', [id]);
  return row ? rowToTransaction(row) : null;
}

export async function getMonthSummary(monthKey: string): Promise<MonthSummary> {
  const db = await getDb();
  const [year, month] = monthKey.split('-');
  const start = `${year}-${month}-01`;
  const end = `${year}-${month}-31`;

  const rows = await db.getAllAsync<any>(
    `SELECT type, SUM(amount) as total FROM transactions WHERE date >= ? AND date <= ? GROUP BY type`,
    [start, end]
  );

  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.type === 'income') income = row.total ?? 0;
    else expense = row.total ?? 0;
  }
  return { income, expense, net: income - expense };
}

export async function upsertTransaction(tx: Transaction): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO transactions (id, type, amount, category_id, note, image_uri, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tx.id, tx.type, tx.amount, tx.categoryId, tx.note ?? null, tx.imageUri ?? null, tx.date, tx.createdAt]
  );
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

function rowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    type: row.type as TransactionType,
    amount: row.amount,
    categoryId: row.category_id,
    note: row.note ?? undefined,
    imageUri: row.image_uri ?? undefined,
    date: row.date,
    createdAt: row.created_at,
  };
}
