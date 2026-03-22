import { formatCurrency } from '@paisa-buddy/utils';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-2">Paisa Buddy 💰</h1>
      <p className="text-gray-500 mb-8">Your personal finance companion</p>
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-sm">
        <p className="text-sm text-gray-400 mb-1">Total Balance</p>
        <p className="text-3xl font-bold">{formatCurrency(125000)}</p>
      </div>
    </main>
  );
}
