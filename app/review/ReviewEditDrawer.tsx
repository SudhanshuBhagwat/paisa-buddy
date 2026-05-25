"use client";

import { useEffect, useState } from "react";
import type { Transaction, TransactionType } from "@/lib/types/transaction";
import type { Account, AccountType } from "@/lib/types/account";
import { ACCOUNT_TYPE_LABELS } from "@/lib/types/account";
import { createAccount } from "@/app/actions/accounts";

interface Props {
  transaction: Transaction;
  categories: string[];
  accounts: Account[];
  onSave: (updates: Partial<Omit<Transaction, "id" | "created_at">>) => void;
  onClose: () => void;
  saving: boolean;
  mode?: "review" | "edit";
}

const TYPES: { value: TransactionType; label: string; color: string }[] = [
  { value: "credit", label: "Credit", color: "#16a34a" },
  { value: "debit", label: "Debit", color: "#dc2626" },
  { value: "transfer", label: "Transfer", color: "#2563eb" },
];

function getCategoryHint(tx: Transaction): string | null {
  if (!tx.raw_ai_response) return null;
  try {
    const parsed = JSON.parse(tx.raw_ai_response) as {
      category_hint?: string | null;
    };
    return parsed.category_hint ?? null;
  } catch {
    return null;
  }
}

export default function ReviewEditDrawer({
  transaction: tx,
  categories,
  accounts,
  onSave,
  onClose,
  saving,
  mode = "review",
}: Props) {
  const categoryHint = getCategoryHint(tx);
  const defaultCategory = tx.category ?? categoryHint ?? "";

  const [type, setType] = useState<TransactionType>(tx.type);
  const [amountStr, setAmountStr] = useState(String(tx.amount / 100));
  const [date, setDate] = useState(tx.date);
  const [time, setTime] = useState(tx.time ?? "");
  const [merchant, setMerchant] = useState(tx.merchant ?? "");
  const [description, setDescription] = useState(tx.description);
  const [category, setCategory] = useState(defaultCategory);
  const [accountId, setAccountId] = useState(tx.account_id ?? "");
  const [toAccountId, setToAccountId] = useState(tx.to_account_id ?? "");
  const [bank, setBank] = useState(tx.bank ?? "");
  const [upiRef, setUpiRef] = useState(tx.upi_ref ?? "");
  const [newCatInput, setNewCatInput] = useState("");
  const [extraCats, setExtraCats] = useState<string[]>([]);
  const [extraAccounts, setExtraAccounts] = useState<Account[]>([]);
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<AccountType>("savings");
  const [addingAccSaving, setAddingAccSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const paise = Math.round(parseFloat(amountStr) * 100);
    const needsToAccount = type === "transfer";
    if (!paise || paise <= 0 || !accountId || (needsToAccount && !toAccountId)) return;
    onSave({
      type,
      amount: paise,
      date,
      time: time || null,
      merchant: merchant.trim() || null,
      description: description.trim(),
      category: category || null,
      account_id: accountId,
      to_account_id: needsToAccount ? toAccountId : null,
      bank: bank.trim() || null,
      upi_ref: upiRef.trim() || null,
    });
  }

  async function handleAddAccount() {
    const name = newAccName.trim();
    if (!name) return;
    setAddingAccSaving(true);
    try {
      const newAcc = await createAccount({ name, type: newAccType, bank: null, currency: "INR", opening_balance: 0 });
      setExtraAccounts((prev) => [...prev, newAcc]);
      setAccountId(newAcc.id);
      setAddingAccount(false);
      setNewAccName("");
      setNewAccType("savings");
    } finally {
      setAddingAccSaving(false);
    }
  }

  const activeType = TYPES.find((t) => t.value === type)!;
  const merchantLabel =
    type === "credit"
      ? "SENDER"
      : type === "transfer"
        ? "ACCOUNT"
        : "RECIPIENT";

  function formatDisplayAmount(raw: string): string {
    if (!raw) return "";
    const [intPart, decPart] = raw.split(".");
    const formatted = Number(intPart || 0).toLocaleString("en-IN");
    return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const clean = e.target.value.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    setAmountStr(
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : clean,
    );
  }

  // All categories + hint + any newly added (deduped)
  const baseCats =
    categoryHint && !categories.includes(categoryHint)
      ? [...categories, categoryHint]
      : categories;
  const allCats = [
    ...baseCats,
    ...extraCats.filter((c) => !baseCats.includes(c)),
  ];

  const allAccounts = [
    ...accounts,
    ...extraAccounts.filter((a) => !accounts.find((x) => x.id === a.id)),
  ];

  function handleAddCat() {
    const name = newCatInput.trim();
    if (!name || allCats.includes(name)) return;
    setExtraCats((prev) => [...prev, name]);
    setCategory(name);
    setNewCatInput("");
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
        <div
          className="w-full max-w-xl md:max-w-2xl rounded-t-2xl md:rounded-2xl pointer-events-auto"
          style={{
            background: "var(--surface)",
            maxHeight: "92dvh",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div
              className="w-10 h-1 rounded-full"
              style={{ background: "var(--border)" }}
            />
          </div>

          <div className="px-4 pt-3 pb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {mode === "edit" ? "Edit Transaction" : "Edit & Confirm"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sm"
              style={{ color: "var(--muted)" }}
            >
              Cancel
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="px-4 pb-8 flex flex-col gap-4"
          >
            {/* Type selector */}
            <div
              className="flex rounded-xl p-1 gap-1"
              style={{ background: "var(--bg)" }}
            >
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
                  style={
                    type === t.value
                      ? {
                          background: "var(--surface)",
                          color: t.color,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        }
                      : { color: "var(--muted)" }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div className="flex items-center justify-center gap-2 py-2">
              <span
                className="font-light"
                style={{ color: activeType.color, fontSize: "2.25rem" }}
              >
                ₹
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={formatDisplayAmount(amountStr)}
                onChange={handleAmountChange}
                className="font-semibold bg-transparent border-none outline-none w-56 text-center tabular-nums"
                style={{
                  color: activeType.color,
                  WebkitTextFillColor: activeType.color,
                  fontSize: "2.25rem",
                }}
              />
              <span
                className="font-light invisible select-none"
                aria-hidden="true"
                style={{ fontSize: "2.25rem" }}
              >
                ₹
              </span>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  DATE
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  TIME
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                />
              </div>
            </div>

            {/* Merchant */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--muted)" }}
              >
                {merchantLabel}
              </label>
              <input
                type="text"
                placeholder="e.g. Swiggy, Amazon"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "var(--bg)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--muted)" }}
              >
                NOTES <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "var(--bg)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
                required
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-2">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--muted)" }}
              >
                CATEGORY <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <div
                className="overflow-x-auto pb-1"
                style={{ scrollbarWidth: "none" }}
              >
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateRows: "repeat(2, auto)",
                    gridAutoFlow: "column",
                    gridAutoColumns: "max-content",
                    width: "max-content",
                  }}
                >
                  {allCats.map((cat) => {
                    const isHint = cat === categoryHint && !tx.category;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat === category ? "" : cat)}
                        className="px-3 py-1.5 rounded-full text-sm transition-all"
                        style={
                          category === cat
                            ? { background: activeType.color, color: "#fff" }
                            : isHint
                              ? {
                                  background: "var(--bg)",
                                  color: "var(--muted)",
                                  border: `1px dashed ${activeType.color}`,
                                }
                              : {
                                  background: "var(--bg)",
                                  color: "var(--text)",
                                  border: "1px solid var(--border)",
                                }
                        }
                      >
                        {cat}
                        {isHint && category !== cat ? " ✦" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
              {categoryHint && !tx.category && (
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  ✦ AI suggested
                </p>
              )}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                }}
              >
                <input
                  type="text"
                  placeholder="New category…"
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCat();
                    }
                  }}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: "var(--text)" }}
                />
                <button
                  type="button"
                  onClick={handleAddCat}
                  disabled={!newCatInput.trim()}
                  className="text-xs font-medium disabled:opacity-40"
                  style={{ color: "var(--text)" }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Account */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                ACCOUNT <span style={{ color: "#dc2626" }}>*</span>
              </label>
              {allAccounts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setAccountId(acc.id === accountId ? "" : acc.id)}
                      className="px-3 py-1.5 rounded-full text-sm transition-all"
                      style={
                        accountId === acc.id
                          ? { background: activeType.color, color: "#fff" }
                          : { background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }
                      }
                    >
                      {acc.name}
                    </button>
                  ))}
                </div>
              )}
              {addingAccount ? (
                <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Account name"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") setAddingAccount(false) }}
                    className="px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {(["savings", "current", "credit", "wallet", "other"] as AccountType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewAccType(t)}
                        className="px-2.5 py-1 rounded-full text-xs transition-all"
                        style={newAccType === t ? { background: "var(--text)", color: "var(--bg)" } : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
                      >
                        {ACCOUNT_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddingAccount(false)} className="flex-1 py-1.5 rounded-lg text-xs" style={{ color: "var(--muted)", border: "1px solid var(--border)" }}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleAddAccount} disabled={!newAccName.trim() || addingAccSaving} className="flex-1 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40" style={{ background: "var(--text)", color: "var(--bg)" }}>
                      {addingAccSaving ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingAccount(true)}
                  className="self-start px-3 py-1.5 rounded-full text-sm"
                  style={{ background: "var(--bg)", color: "var(--muted)", border: "1px dashed var(--border)" }}
                >
                  + Add account
                </button>
              )}
            </div>

            {/* To Account (transfers only) */}
            {type === "transfer" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                  TO ACCOUNT <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {allAccounts.filter((a) => a.id !== accountId).map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setToAccountId(acc.id === toAccountId ? "" : acc.id)}
                      className="px-3 py-1.5 rounded-full text-sm transition-all"
                      style={
                        toAccountId === acc.id
                          ? { background: activeType.color, color: "#fff" }
                          : { background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }
                      }
                    >
                      {acc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bank + UPI ref */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  BANK
                </label>
                <input
                  type="text"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  UPI REF
                </label>
                <input
                  type="text"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
                  style={{
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={
                !amountStr || !description.trim() || !category || !accountId ||
                (type === "transfer" && !toAccountId) || saving
              }
              className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40 mt-1"
              style={{ background: activeType.color, color: "#fff" }}
            >
              {saving ? "Saving…" : mode === "edit" ? "Save" : "Confirm & Save"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
