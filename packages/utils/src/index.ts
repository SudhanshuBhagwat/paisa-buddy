import type { Transaction, TransactionCategory } from '@paisa-buddy/types';

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function groupTransactionsByCategory(
  transactions: Transaction[]
): Record<TransactionCategory, number> {
  return transactions.reduce(
    (acc, tx) => {
      acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
      return acc;
    },
    {} as Record<TransactionCategory, number>
  );
}

export function sumTransactions(transactions: Transaction[]): number {
  return transactions.reduce((sum, tx) => {
    return tx.type === 'income' ? sum + tx.amount : sum - tx.amount;
  }, 0);
}
