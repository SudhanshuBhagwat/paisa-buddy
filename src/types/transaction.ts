export type TransactionType = 'expense' | 'income';

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number; // stored as paise (₹10.50 = 1050)
  categoryId: string;
  note?: string;
  imageUri?: string; // local file path
  date: string; // ISO 8601 date
  createdAt: string; // ISO 8601 timestamp
};

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  emoji: string;
  isDefault: boolean;
};

export type MonthSummary = {
  income: number;
  expense: number;
  net: number;
};

export type OcrResult = {
  type: TransactionType | null;
  amountRupees: number | null;
  vendor: string | null;
  date: string | null; // YYYY-MM-DD
};
