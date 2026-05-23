'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { PREDEFINED_CATEGORIES } from '@/lib/categories'
import { logout } from '@/lib/auth/actions'
import {
  addCategory,
  removeCategory,
  removeCategoryAndUnlinkTransactions,
  clearAllTransactions,
} from '@/app/actions/categories'
import { addUpiId, removeUpiId, setDisplayName } from '@/app/actions/user-settings'
import ConfirmModal from '@/components/ConfirmModal'

interface CategoryWithCount {
  name: string
  transactionCount: number
}

interface Props {
  email: string | null
  transactionCount: number
  customCategories: CategoryWithCount[]
  upiIds: string[]
  displayName: string | null
}

export default function SettingsClient({ email, transactionCount, customCategories, upiIds, displayName }: Props) {
  const { state, dispatch } = useStore()
  const [newCat, setNewCat] = useState('')
  const [newUpi, setNewUpi] = useState('')
  const [nameInput, setNameInput] = useState(displayName ?? '')
  const [confirmClear, setConfirmClear] = useState(false)
  const [removingCat, setRemovingCat] = useState<CategoryWithCount | null>(null)

  async function handleAddUpiId() {
    const id = newUpi.trim().toLowerCase()
    if (!id) return
    await addUpiId(id)
    setNewUpi('')
  }

  async function handleRemoveUpiId(id: string) {
    await removeUpiId(id)
  }

  async function handleAddCategory() {
    const name = newCat.trim()
    if (!name) return
    await addCategory(name)
    setNewCat('')
  }

  async function handleConfirmRemoveCategory() {
    if (!removingCat) return
    if (removingCat.transactionCount > 0) {
      await removeCategoryAndUnlinkTransactions(removingCat.name)
    } else {
      await removeCategory(removingCat.name)
    }
    setRemovingCat(null)
  }

  async function handleClear() {
    if (confirmClear) {
      await clearAllTransactions()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
    }
  }

  const removingCatMessage = removingCat
    ? removingCat.transactionCount > 0
      ? `${removingCat.transactionCount} transaction${removingCat.transactionCount !== 1 ? 's' : ''} use this category. Their category will be cleared.`
      : 'This cannot be undone.'
    : ''

  return (
    <main className="max-w-xl md:max-w-2xl mx-auto w-full min-h-dvh pb-20 md:pt-14 px-4">
      <div className="py-4">
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="flex flex-col gap-6">
        {/* Account + Receipt identity */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>ACCOUNT</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-sm shrink-0" style={{ color: 'var(--muted)' }}>Email</span>
              <span className="text-sm font-medium truncate max-w-[60%] text-right">
                {email ?? '—'}
              </span>
            </div>
            <div
              className="flex items-center justify-between px-4 py-3 gap-3"
              style={{ background: 'var(--surface)' }}
            >
              <span className="text-sm shrink-0">Name</span>
              <input
                type="text"
                placeholder="As it appears on receipts"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={async () => {
                  await setDisplayName(nameInput.trim())
                }}
                className="flex-1 text-sm bg-transparent outline-none text-right"
                style={{ color: 'var(--text)' }}
              />
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Your name and email help identify whether you are the sender or receiver in uploaded receipts.
          </p>
        </section>

        {/* UPI IDs */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>UPI IDs <span className="font-normal">(optional)</span></h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {upiIds.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
                No UPI IDs added yet
              </div>
            ) : (
              upiIds.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
                >
                  <span className="text-sm font-mono">{id}</span>
                  <button
                    onClick={() => handleRemoveUpiId(id)}
                    className="text-xs transition-opacity hover:opacity-60"
                    style={{ color: '#dc2626' }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'var(--surface)' }}>
              <input
                type="text"
                placeholder="yourname@upi"
                value={newUpi}
                onChange={(e) => setNewUpi(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUpiId() } }}
                className="flex-1 text-sm bg-transparent outline-none font-mono"
                style={{ color: 'var(--text)' }}
              />
              <button
                onClick={handleAddUpiId}
                disabled={!newUpi.trim()}
                className="text-xs font-medium disabled:opacity-40"
                style={{ color: 'var(--text)' }}
              >
                Add
              </button>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Your UPI IDs help identify debit vs credit direction in uploaded receipts, especially when your name alone isn&apos;t enough.
          </p>
        </section>

        {/* Dark mode */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>APPEARANCE</h2>
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <span className="text-sm">Dark mode</span>
            <button
              onClick={() => dispatch({ type: 'SET_DARK_MODE', payload: !state.darkMode })}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: state.darkMode ? '#09090b' : 'var(--border)' }}
              aria-pressed={state.darkMode}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                style={{
                  background: '#fff',
                  left: '2px',
                  transform: state.darkMode ? 'translateX(20px)' : 'translateX(0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </button>
          </div>
        </section>

        {/* Custom categories */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>CUSTOM CATEGORIES</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {customCategories.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
                No custom categories yet
              </div>
            ) : (
              customCategories.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">{cat.name}</span>
                    {cat.transactionCount > 0 && (
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                        {cat.transactionCount} linked transaction{cat.transactionCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setRemovingCat(cat)}
                    className="text-xs transition-opacity hover:opacity-60"
                    style={{ color: '#dc2626' }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'var(--surface)' }}>
              <input
                type="text"
                placeholder="Add category..."
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }}
                className="flex-1 text-sm bg-transparent outline-none"
                style={{ color: 'var(--text)' }}
              />
              <button
                onClick={handleAddCategory}
                disabled={!newCat.trim()}
                className="text-xs font-medium disabled:opacity-40"
                style={{ color: 'var(--text)' }}
              >
                Add
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_CATEGORIES.map((cat) => (
              <span
                key={cat}
                className="px-3 py-1 rounded-full text-xs"
                style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                {cat}
              </span>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Above categories are built-in and cannot be removed.
          </p>
        </section>

        {/* Apple Shortcut */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>APPLE SHORTCUT</h2>
          <Link
            href="/settings/shortcut"
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <span className="text-sm">Setup instructions & credentials</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </section>

        {/* Data */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>DATA</h2>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            {transactionCount} transaction{transactionCount !== 1 ? 's' : ''} stored
          </div>
          <button
            onClick={handleClear}
            className="w-full py-3 rounded-xl text-sm font-medium transition-colors"
            style={
              confirmClear
                ? { background: '#dc2626', color: '#fff' }
                : { background: 'var(--surface)', color: '#dc2626', border: '1px solid #dc2626' }
            }
          >
            {confirmClear ? 'Tap again to confirm — this cannot be undone' : 'Clear all data'}
          </button>
          {confirmClear && (
            <button
              onClick={() => setConfirmClear(false)}
              className="text-sm"
              style={{ color: 'var(--muted)' }}
            >
              Cancel
            </button>
          )}
        </section>

        {/* Sign out */}
        <section className="flex flex-col gap-3 pb-4">
          <form action={logout}>
            <button
              type="submit"
              className="w-full py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--surface)', color: '#dc2626', border: '1px solid var(--border)' }}
            >
              Sign out
            </button>
          </form>
        </section>
      </div>

      <ConfirmModal
        open={removingCat !== null}
        title={`Delete "${removingCat?.name}" category?`}
        message={removingCatMessage}
        confirmLabel="Delete"
        onConfirm={handleConfirmRemoveCategory}
        onCancel={() => setRemovingCat(null)}
      />
    </main>
  )
}
