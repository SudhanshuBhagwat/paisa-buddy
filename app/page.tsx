"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  toYearMonth,
  getMonthTransactions,
  calcSummary,
  formatAmount,
  formatDateLabel,
} from "@/lib/utils";
import MonthPicker from "@/components/MonthPicker";
import TransactionList from "@/components/TransactionList";
import TransactionModal from "@/components/TransactionModal";
import CalendarView from "@/components/CalendarView";

const SUMMARY_ITEMS = (
  income: number,
  expense: number,
  balance: number,
  transfer: number,
) => [
  { label: "Income", value: income, color: "#16a34a" },
  { label: "Spent", value: expense, color: "#dc2626" },
  {
    label: "Balance",
    value: balance,
    color: balance >= 0 ? "#16a34a" : "#dc2626",
  },
  { label: "Transfers", value: transfer, color: "#2563eb" },
];

export default function HomePage() {
  const { state } = useStore();
  const [month, setMonth] = useState(() => toYearMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [calSheetOpen, setCalSheetOpen] = useState(false);

  useEffect(() => {
    setSelectedDate(null);
    setSelectedCategory(null);
  }, [month]);

  const txs = getMonthTransactions(state.transactions, month);
  const filteredTxs = txs.filter(
    (t) =>
      (!selectedDate || t.date === selectedDate) &&
      (!selectedCategory || t.category === selectedCategory),
  );
  const { income, expense, balance, transfer } = calcSummary(txs);
  const summaryItems = SUMMARY_ITEMS(income, expense, balance, transfer);

  const txCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of txs) map.set(tx.date, (map.get(tx.date) ?? 0) + 1);
    return map;
  }, [txs]);

  const monthCategories = useMemo(
    () => Array.from(new Set(txs.map((t) => t.category))).sort(),
    [txs],
  );

  return (
    <main className="w-full pb-20 md:pb-0 md:pt-14 min-h-dvh">
      {/*
        Desktop: 2×2 CSS grid
          Cell 1 (top-left):  summary stats
          Cell 2 (top-right): MonthPicker  ← same row as Cell 1 → auto same height
          Cell 3 (bot-left):  transaction list
          Cell 4 (bot-right): calendar
        Mobile: only Cell 3 visible (stacked, full-width)
      */}
      <div className="md:max-w-5xl md:mx-auto md:grid md:grid-cols-[1fr_320px]">
        {/* ── Cell 1: Desktop summary (top-left) ── */}
        <div
          className="hidden md:block md:border-r md:border-b px-4 py-1.5"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between gap-2 h-full">
            {summaryItems.map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl px-3 py-3 flex flex-col gap-1 items-center"
                style={{ background: "var(--bg)" }}
              >
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  {label}
                </span>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color }}
                >
                  {formatAmount(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cell 2: Desktop MonthPicker (top-right) — auto-stretches to match Cell 1 height ── */}
        <div
          className="hidden md:flex md:items-center md:border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="w-full">
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        </div>

        {/* ── Cell 3: Transaction list (bottom-left) + all mobile content ── */}
        <div className="md:border-r" style={{ borderColor: "var(--border)" }}>
          <div className="max-w-xl mx-auto md:max-w-none">
            {/* Mobile: MonthPicker with tappable label */}
            <div className="md:hidden">
              <MonthPicker
                value={month}
                onChange={setMonth}
                onLabelClick={() => setCalSheetOpen(true)}
              />
            </div>

            {/* Mobile: 2×2 summary strip */}
            <div
              className="md:hidden grid grid-cols-2 text-center px-4 py-3 gap-2"
              style={{
                borderBottom: "1px solid var(--border)",
                borderTop: "1px solid var(--border)",
              }}
            >
              {summaryItems.map(({ label, value, color }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {label}
                  </span>
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color }}
                  >
                    {formatAmount(value)}
                  </span>
                </div>
              ))}
            </div>

            {/* Category filter chips */}
            {monthCategories.length > 0 && (
              <div
                className="flex items-center gap-2 px-4 py-3 overflow-x-auto"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span
                  className="shrink-0 text-sm font-bold pr-1"
                  style={{ color: "var(--muted)" }}
                >
                  Filter by:
                </span>
                {monthCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() =>
                      setSelectedCategory(selectedCategory === cat ? null : cat)
                    }
                    className="shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={
                      selectedCategory === cat
                        ? { background: "#dc2626", color: "#fff" }
                        : {
                            background: "var(--bg)",
                            color: "var(--text)",
                            border: "1px solid var(--border)",
                          }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Active date filter banner */}
            {selectedDate && (
              <div
                className="flex items-center justify-between px-4 py-2 text-xs"
                style={{
                  background: "var(--bg)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>
                  Showing {formatDateLabel(selectedDate)}
                </span>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="font-medium"
                  style={{ color: "var(--text)" }}
                >
                  Show all
                </button>
              </div>
            )}

            <TransactionList transactions={filteredTxs} />
          </div>
        </div>

        {/* ── Cell 4: Calendar (bottom-right, desktop only) ── */}
        <div className="hidden md:block">
          <div
            className="sticky top-14"
            style={{ maxHeight: "calc(100dvh - 3.5rem)", overflowY: "auto" }}
          >
            <CalendarView
              month={month}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              transactionCounts={txCounts}
            />
            {selectedDate && (
              <div className="px-3 pb-3">
                <button
                  onClick={() => setSelectedDate(null)}
                  className="w-full py-2 rounded-lg text-xs"
                  style={{
                    background: "var(--bg)",
                    color: "var(--muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Show all transactions
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 z-30"
        style={{ background: "var(--text)", color: "var(--bg)" }}
        aria-label="Add transaction"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* ── Mobile calendar bottom sheet ── */}
      {calSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-50 md:hidden"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setCalSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl md:hidden"
            style={{ background: "var(--surface)" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: "var(--border)" }}
              />
            </div>
            <div className="px-4 pb-2 pt-1">
              <MonthPicker
                value={month}
                onChange={(m) => {
                  setMonth(m);
                  setSelectedDate(null);
                }}
              />
            </div>
            <CalendarView
              month={month}
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                setSelectedDate(d);
                setCalSheetOpen(false);
              }}
              transactionCounts={txCounts}
            />
            <div className="px-4 pb-6 pt-2 flex gap-2">
              {selectedDate && (
                <button
                  onClick={() => {
                    setSelectedDate(null);
                    setCalSheetOpen(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm"
                  style={{
                    background: "var(--bg)",
                    color: "var(--muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Show all
                </button>
              )}
              <button
                onClick={() => setCalSheetOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "var(--text)", color: "var(--bg)" }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
