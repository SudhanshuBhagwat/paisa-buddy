// Shared TypeScript types for paisa-buddy

export interface User {
  id: string;
  name: string;
  email: string;
  currency: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  category: TransactionCategory;
  description: string;
  date: string;
  type: 'income' | 'expense';
}

export type TransactionCategory =
  | 'food'
  | 'transport'
  | 'housing'
  | 'entertainment'
  | 'healthcare'
  | 'education'
  | 'shopping'
  | 'utilities'
  | 'salary'
  | 'investment'
  | 'other';

export interface Budget {
  id: string;
  userId: string;
  category: TransactionCategory;
  limit: number;
  currency: string;
  period: 'monthly' | 'weekly' | 'yearly';
}
