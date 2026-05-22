"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { toYearMonth, getMonthTransactions } from "@/lib/utils";
import MonthPicker from "@/components/MonthPicker";
import StatsView from "@/components/StatsView";

export default function StatsPage() {
  const { state } = useStore();
  const [month, setMonth] = useState(() => toYearMonth(new Date()));
  const txs = getMonthTransactions(state.transactions, month);

  return (
    <main className="max-w-xl md:max-w-2xl mx-auto w-full min-h-dvh pb-20 md:pt-14">
      <div
        className="md:flex md:items-center md:min-h-16"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="w-full">
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </div>
      <StatsView transactions={txs} />
    </main>
  );
}
