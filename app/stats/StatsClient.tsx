'use client'

import { useRouter } from 'next/navigation'
import type { Transaction } from '@/lib/types/transaction'
import MonthPicker from '@/components/MonthPicker'
import StatsView from '@/components/StatsView'

interface Props {
  transactions: Transaction[]
  month: string
}

export default function StatsClient({ transactions, month }: Props) {
  const router = useRouter()

  return (
    <main className="max-w-xl md:max-w-2xl mx-auto w-full min-h-dvh pb-20 md:pt-14">
      <div
        className="md:flex md:items-center md:min-h-16"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="w-full py-2">
          <MonthPicker
            value={month}
            onChange={(m) => router.push(`/stats?month=${m}`)}
          />
        </div>
      </div>
      <StatsView transactions={transactions} />
    </main>
  )
}
