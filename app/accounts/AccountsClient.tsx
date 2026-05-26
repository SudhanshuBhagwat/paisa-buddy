'use client'

import { useState } from 'react'
import { formatAmount } from '@/lib/utils'
import { createAccount, updateAccount, deleteAccount } from '@/app/actions/accounts'
import ConfirmModal from '@/components/ConfirmModal'
import type { AccountWithBalance, AccountType } from '@/lib/types/account'
import { ACCOUNT_TYPE_LABELS } from '@/lib/types/account'

const TYPES: AccountType[] = ['savings', 'current', 'credit', 'wallet', 'other']

interface FormState {
  name: string
  type: AccountType
  bank: string
  opening_balance: string
}

const DEFAULT_FORM: FormState = { name: '', type: 'savings', bank: '', opening_balance: '' }

interface Props {
  accounts: AccountWithBalance[]
}

export default function AccountsClient({ accounts }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setForm(DEFAULT_FORM)
    setEditingAccount(null)
    setModalOpen(true)
  }

  function openEdit(acc: AccountWithBalance) {
    setForm({
      name: acc.name,
      type: acc.type,
      bank: acc.bank ?? '',
      opening_balance: String(Math.abs(acc.opening_balance) / 100),
    })
    setEditingAccount(acc)
    setModalOpen(true)
  }

  async function handleSave() {
    const name = form.name.trim()
    if (!name) return
    const rawBalance = Math.round(parseFloat(form.opening_balance || '0') * 100)
    const opening_balance = form.type === 'credit' ? -Math.abs(rawBalance) : rawBalance
    setSaving(true)
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          name,
          type: form.type,
          bank: form.bank.trim() || null,
          opening_balance,
        })
      } else {
        await createAccount({
          name,
          type: form.type,
          bank: form.bank.trim() || null,
          currency: 'INR',
          opening_balance,
        })
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingId) return
    await deleteAccount(deletingId)
    setDeletingId(null)
  }

  const deletingAccount = accounts.find((a) => a.id === deletingId)

  return (
    <main className="max-w-xl md:max-w-2xl mx-auto w-full min-h-dvh pb-20 md:pt-14 px-4">
      <div className="py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Accounts</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: 'var(--text)', color: 'var(--bg)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--muted)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <p className="text-sm">No accounts yet</p>
          <button onClick={openAdd} className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Add your first account
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((acc) => {
            const balColor = acc.current_balance >= 0 ? '#16a34a' : '#dc2626'
            const balFmt = formatAmount(acc.current_balance)
            const balDotIdx = balFmt.lastIndexOf('.')
            const balInt = balDotIdx >= 0 ? balFmt.slice(0, balDotIdx) : balFmt
            const balDec = balDotIdx >= 0 ? balFmt.slice(balDotIdx + 1) : null
            return (
              <div
                key={acc.id}
                className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold truncate">{acc.name}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                    >
                      {ACCOUNT_TYPE_LABELS[acc.type]}
                    </span>
                    {acc.bank && (
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{acc.bank}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-baseline tabular-nums" style={{ color: balColor }}>
                      <span className="text-base font-semibold">{balInt}</span>
                      {balDec && <span className="text-xs font-semibold">.{balDec}</span>}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>balance</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(acc)}
                      className="p-1.5 rounded-lg transition-opacity hover:opacity-60"
                      style={{ color: 'var(--muted)' }}
                      aria-label="Edit account"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeletingId(acc.id)}
                      className="p-1.5 rounded-lg transition-opacity hover:opacity-60"
                      style={{ color: 'var(--muted)' }}
                      aria-label="Delete account"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
            <div
              className="w-full max-w-xl md:max-w-2xl rounded-t-2xl md:rounded-2xl pointer-events-auto"
              style={{ background: 'var(--surface)', maxHeight: '90dvh', overflowY: 'auto' }}
            >
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
              </div>
              <div className="px-4 pt-3 pb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {editingAccount ? 'Edit Account' : 'New Account'}
                </h2>
                <button type="button" onClick={() => setModalOpen(false)} className="text-sm" style={{ color: 'var(--muted)' }}>
                  Cancel
                </button>
              </div>

              <div className="px-4 pb-8 flex flex-col gap-4">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    NAME <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Savings"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    autoFocus
                    className="px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>

                {/* Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>TYPE</label>
                  <div className="flex flex-wrap gap-2">
                    {TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, type: t }))}
                        className="px-3 py-1.5 rounded-full text-sm transition-all"
                        style={
                          form.type === t
                            ? { background: 'var(--text)', color: 'var(--bg)' }
                            : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
                        }
                      >
                        {ACCOUNT_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bank */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>BANK</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank"
                    value={form.bank}
                    onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>

                {/* Opening balance */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    {form.type === 'credit' ? 'AMOUNT TO BE SETTLED' : 'OPENING BALANCE'}
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>₹</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={form.opening_balance}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9.]/g, '')
                        const parts = clean.split('.')
                        setForm((f) => ({ ...f, opening_balance: parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean }))
                      }}
                      className="flex-1 bg-transparent text-sm outline-none tabular-nums"
                      style={{ color: 'var(--text)' }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!form.name.trim() || saving}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
                  style={{ background: 'var(--text)', color: 'var(--bg)' }}
                >
                  {saving ? 'Saving…' : editingAccount ? 'Save Changes' : 'Add Account'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={deletingId !== null}
        title={`Delete "${deletingAccount?.name}"?`}
        message="Transactions linked to this account will be unlinked but not deleted."
        confirmLabel="Delete"
        confirmColor="#dc2626"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </main>
  )
}
