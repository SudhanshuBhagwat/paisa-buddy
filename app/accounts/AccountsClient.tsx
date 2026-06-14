'use client'

import React, { useState } from 'react'
import { formatAmount } from '@/lib/utils'
import { createAccount, updateAccount, deleteAccount } from '@/app/actions/accounts'
import ConfirmModal from '@/components/ConfirmModal'
import BuddySVG from '@/components/BuddySVG'
import type { AccountWithBalance, AccountType } from '@/lib/types/account'
import { ACCOUNT_TYPE_LABELS } from '@/lib/types/account'

const TYPES: AccountType[] = ['savings', 'current', 'credit', 'wallet', 'other']

interface FormState {
  name: string; type: AccountType; bank: string; opening_balance: string
}
const DEFAULT_FORM: FormState = { name: '', type: 'savings', bank: '', opening_balance: '' }

const CARD: React.CSSProperties = {
  background: 'var(--pb-surface)', border: '1px solid var(--pb-line)',
  borderRadius: 'var(--pb-radius)', boxShadow: 'var(--pb-card-shadow)',
}

function accountIconColor(type: AccountType): { bg: string; fg: string } {
  if (type === 'credit') return { bg: '#FEE2E2', fg: 'var(--pb-neg)' }
  if (type === 'wallet') return { bg: '#FEF9C3', fg: '#A16207' }
  return { bg: '#D1FAE5', fg: 'var(--pb-brand)' }
}

function AccountIcon({ type }: { type: AccountType }) {
  const { bg, fg } = accountIconColor(type)
  if (type === 'wallet') return (
    <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        <path d="M16 12h4v4h-4z" />
      </svg>
    </div>
  )
  return (
    <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    </div>
  )
}

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
  </svg>
)

interface Props { accounts: AccountWithBalance[] }

export default function AccountsClient({ accounts }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  function openAdd() { setForm(DEFAULT_FORM); setEditingAccount(null); setModalOpen(true) }
  function openEdit(acc: AccountWithBalance) {
    setForm({ name: acc.name, type: acc.type, bank: acc.bank ?? '', opening_balance: String(Math.abs(acc.opening_balance) / 100) })
    setEditingAccount(acc); setModalOpen(true)
  }

  async function handleSave() {
    const name = form.name.trim()
    if (!name) return
    const rawBalance = Math.round(parseFloat(form.opening_balance || '0') * 100)
    const opening_balance = form.type === 'credit' ? -Math.abs(rawBalance) : rawBalance
    setSaving(true)
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, { name, type: form.type, bank: form.bank.trim() || null, opening_balance })
      } else {
        await createAccount({ name, type: form.type, bank: form.bank.trim() || null, currency: 'INR', opening_balance })
      }
      setModalOpen(false)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deletingId) return
    await deleteAccount(deletingId)
    setDeletingId(null)
  }

  const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0)
  const bankCount = new Set(accounts.filter(a => a.bank).map(a => a.bank!)).size
  const cardCount = accounts.filter(a => a.type === 'credit').length
  const deletingAccount = accounts.find((a) => a.id === deletingId)

  const AddBtn = ({ label = 'Add Account' }: { label?: string }) => (
    <button onClick={openAdd}
      style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--pb-brand)', borderRadius: 12, padding: '10px 16px', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, boxShadow: '0 6px 16px color-mix(in srgb, var(--pb-brand) 35%, transparent)' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      {label}
    </button>
  )

  const HeroCard = () => (
    <div style={{ background: 'linear-gradient(135deg, #0F5132, #1A936F)', borderRadius: 'var(--pb-radius)', padding: '20px 22px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -18, bottom: -12, zIndex: 0, pointerEvents: 'none' }}>
        <BuddySVG size={110} style={{ opacity: 0.12 }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 10.5, letterSpacing: '0.07em', fontWeight: 700, opacity: 0.75, marginBottom: 6, textTransform: 'uppercase' }}>Total across accounts</div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: '"Space Mono", monospace', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {formatAmount(totalBalance)}
        </div>
        <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 6 }}>
          {bankCount > 0 ? `${bankCount} bank${bankCount > 1 ? 's' : ''} · ` : ''}{cardCount > 0 ? `${cardCount} card${cardCount > 1 ? 's' : ''} · ` : ''}{accounts.length} account{accounts.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )

  return (
    <main className="w-full min-h-dvh pb-24 md:pb-6 md:pt-[62px] lg:pt-[66px]">

      {/* ── Desktop ─────────────────────────────────────────── */}
      <div className="hidden lg:block" style={{ height: 'calc(100dvh - 66px)', overflowY: 'auto', padding: '26px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--pb-ink)', margin: 0 }}>Accounts</h1>
          <AddBtn />
        </div>

        {accounts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12, color: 'var(--pb-ink-3)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <p style={{ fontSize: 14, margin: 0 }}>No accounts yet</p>
            <button onClick={openAdd} style={{ fontSize: 13, fontWeight: 600, color: 'var(--pb-brand)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Add your first account
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 18 }}><HeroCard /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {accounts.map((acc) => {
                const balColor = acc.current_balance >= 0 ? 'var(--pb-pos)' : 'var(--pb-neg)'
                return (
                  <div key={acc.id} style={{ ...CARD, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <AccountIcon type={acc.type} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--pb-ink-3)', marginTop: 2 }}>
                          {ACCOUNT_TYPE_LABELS[acc.type]}{acc.bank ? ` · ${acc.bank}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: balColor, fontFamily: '"Space Mono", monospace', letterSpacing: '-0.01em' }}>
                          {formatAmount(acc.current_balance)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--pb-ink-3)', marginTop: 1 }}>Current balance</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(acc)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--pb-line)', background: 'var(--pb-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pb-ink-2)' }}>
                          <EditIcon />
                        </button>
                        <button onClick={() => setDeletingId(acc.id)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--pb-line)', background: 'var(--pb-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pb-ink-3)' }}>
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Mobile + Tablet ──────────────────────────────────── */}
      <div className="lg:hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between" style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 10px' }}>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: 'var(--pb-ink)', margin: 0 }}>Accounts</h1>
          <AddBtn label="Add" />
        </div>

        {/* Tablet header */}
        <div className="hidden md:flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--pb-line)' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--pb-ink)', margin: 0 }}>Accounts</h1>
          <AddBtn />
        </div>

        <div style={{ padding: '10px 18px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {accounts.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12, color: 'var(--pb-ink-3)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              <p style={{ fontSize: 14, margin: 0 }}>No accounts yet</p>
              <button onClick={openAdd} style={{ fontSize: 13, fontWeight: 600, color: 'var(--pb-brand)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Add your first account
              </button>
            </div>
          ) : (
            <>
              <HeroCard />

              {/* Account list card */}
              <div style={{ ...CARD, overflow: 'hidden' }}>
                {accounts.map((acc, idx) => {
                  const balColor = acc.current_balance >= 0 ? 'var(--pb-pos)' : 'var(--pb-neg)'
                  return (
                    <div key={acc.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                      borderBottom: idx < accounts.length - 1 ? '1px solid var(--pb-line)' : undefined,
                    }}>
                      <AccountIcon type={acc.type} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--pb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--pb-ink-3)', marginTop: 1 }}>
                          {ACCOUNT_TYPE_LABELS[acc.type]}{acc.bank ? ` · ${acc.bank}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: balColor, fontFamily: '"Space Mono", monospace' }}>
                          {formatAmount(acc.current_balance)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button onClick={() => openEdit(acc)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pb-ink-3)' }}>
                          <EditIcon />
                        </button>
                        <button onClick={() => setDeletingId(acc.id)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pb-ink-3)' }}>
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
            <div className="w-full max-w-xl md:max-w-2xl rounded-t-2xl md:rounded-2xl pointer-events-auto"
              style={{ background: 'var(--pb-surface)', maxHeight: '90dvh', overflowY: 'auto' }}>
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--pb-line)' }} />
              </div>
              <div className="px-4 pt-3 pb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{editingAccount ? 'Edit Account' : 'New Account'}</h2>
                <button type="button" onClick={() => setModalOpen(false)} className="text-sm" style={{ color: 'var(--pb-ink-3)' }}>Cancel</button>
              </div>
              <div className="px-4 pb-8 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--pb-ink-3)' }}>NAME <span style={{ color: 'var(--pb-neg)' }}>*</span></label>
                  <input type="text" placeholder="e.g. HDFC Savings" value={form.name} autoFocus
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--pb-bg)', color: 'var(--pb-ink)', border: '1px solid var(--pb-line)' }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--pb-ink-3)' }}>TYPE</label>
                  <div className="flex flex-wrap gap-2">
                    {TYPES.map((t) => (
                      <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, type: t }))}
                        className="px-3 py-1.5 rounded-full text-sm transition-all"
                        style={form.type === t
                          ? { background: 'var(--pb-brand)', color: '#fff' }
                          : { background: 'var(--pb-bg)', color: 'var(--pb-ink-2)', border: '1px solid var(--pb-line)' }}>
                        {ACCOUNT_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--pb-ink-3)' }}>BANK</label>
                  <input type="text" placeholder="e.g. HDFC Bank" value={form.bank}
                    onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--pb-bg)', color: 'var(--pb-ink)', border: '1px solid var(--pb-line)' }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--pb-ink-3)' }}>
                    {form.type === 'credit' ? 'AMOUNT TO BE SETTLED' : 'OPENING BALANCE'}
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--pb-bg)', border: '1px solid var(--pb-line)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--pb-ink-3)' }}>₹</span>
                    <input type="text" inputMode="decimal" placeholder="0" value={form.opening_balance}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9.]/g, '')
                        const parts = clean.split('.')
                        setForm((f) => ({ ...f, opening_balance: parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean }))
                      }}
                      className="flex-1 bg-transparent text-sm outline-none tabular-nums" style={{ color: 'var(--pb-ink)' }} />
                  </div>
                </div>
                <button type="button" onClick={handleSave} disabled={!form.name.trim() || saving}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
                  style={{ background: 'var(--pb-brand)', color: '#fff' }}>
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
        confirmLabel="Delete" confirmColor="var(--pb-neg)"
        onConfirm={handleDelete} onCancel={() => setDeletingId(null)} />
    </main>
  )
}
