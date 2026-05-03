import { getDb } from './index';
import { upsertTransaction } from './transactions';
import type { Transaction } from '@/types/transaction';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const EXPENSES = [
  { categoryId: 'food',          notes: ['Lunch', 'Dinner', 'Groceries', 'Zomato', 'Swiggy', 'Coffee', 'Breakfast', 'D-Mart run'],    min: 12000,  max: 90000  },
  { categoryId: 'transport',     notes: ['Uber', 'Ola', 'Auto', 'Metro card', 'Petrol', 'Rapido', 'Bus pass'],                         min: 4000,   max: 40000  },
  { categoryId: 'shopping',      notes: ['Amazon order', 'Clothes', 'Flipkart', 'New shoes', 'Accessories', 'Home stuff'],              min: 50000,  max: 500000 },
  { categoryId: 'bills',         notes: ['Electricity', 'Internet bill', 'Phone recharge', 'Gym membership', 'OTT subscriptions'],     min: 29900,  max: 600000 },
  { categoryId: 'entertainment', notes: ['Movie tickets', 'Night out', 'Gaming', 'Concert', 'Weekend trip', 'Bowling'],                 min: 20000,  max: 200000 },
  { categoryId: 'expense-other', notes: ['Medicine', 'Haircut', 'Miscellaneous', 'Stationery', 'Gift', 'Parking'],                     min: 8000,   max: 100000 },
];

const INCOMES = [
  { categoryId: 'salary',    notes: ['Monthly salary', 'Salary credit'],                         min: 5500000, max: 7500000, weight: 10 },
  { categoryId: 'freelance', notes: ['Freelance project', 'Client payment', 'Consulting gig'],    min: 400000,  max: 2500000, weight: 3  },
  { categoryId: 'received',  notes: ['From friend', 'Reimbursement', 'Refund', 'Cashback'],       min: 50000,   max: 400000,  weight: 2  },
];

export async function seedTestData(): Promise<{ skipped: boolean }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM transactions');
  if (row && row.count > 0) return { skipped: true };

  const now = new Date();
  const txns: Transaction[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    // Salary on 1st
    txns.push({
      id: uid(),
      type: 'income',
      amount: randInt(INCOMES[0].min, INCOMES[0].max),
      categoryId: 'salary',
      note: pick(INCOMES[0].notes),
      date: isoDate(year, month, 1),
      createdAt: new Date(year, month - 1, 1).toISOString(),
    });

    // 1–2 extra income some months
    const extraIncome = randInt(0, 2);
    for (let j = 0; j < extraIncome; j++) {
      const t = INCOMES[randInt(1, 2)];
      const day = randInt(4, 28);
      txns.push({
        id: uid(),
        type: 'income',
        amount: randInt(t.min, t.max),
        categoryId: t.categoryId,
        note: pick(t.notes),
        date: isoDate(year, month, Math.min(day, daysInMonth)),
        createdAt: new Date(year, month - 1, day).toISOString(),
      });
    }

    // 9–16 expenses spread across the month
    const expenseCount = randInt(9, 16);
    for (let j = 0; j < expenseCount; j++) {
      const t = EXPENSES[randInt(0, EXPENSES.length - 1)];
      const day = randInt(1, daysInMonth);
      txns.push({
        id: uid(),
        type: 'expense',
        amount: randInt(t.min, t.max),
        categoryId: t.categoryId,
        note: pick(t.notes),
        date: isoDate(year, month, day),
        createdAt: new Date(year, month - 1, day).toISOString(),
      });
    }
  }

  for (const tx of txns) {
    await upsertTransaction(tx);
  }

  return { skipped: false };
}

export async function clearAllTransactions(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions');
}
