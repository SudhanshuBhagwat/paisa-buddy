'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { PREDEFINED_CATEGORIES } from '@/lib/categories'

export default function SettingsPage() {
  const { state, dispatch } = useStore()
  const [newCat, setNewCat] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  function handleAddCategory() {
    const name = newCat.trim()
    if (!name) return
    dispatch({ type: 'ADD_CATEGORY', payload: name })
    setNewCat('')
  }

  function handleClear() {
    if (confirmClear) {
      dispatch({ type: 'CLEAR_ALL' })
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
    }
  }

  return (
    <main className="max-w-xl md:max-w-2xl mx-auto w-full min-h-dvh pb-20 md:pt-14 px-4">
      <div className="py-4">
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="flex flex-col gap-6">
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
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {state.customCategories.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
                No custom categories yet
              </div>
            ) : (
              state.customCategories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
                >
                  <span className="text-sm">{cat}</span>
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_CATEGORY', payload: cat })}
                    className="text-xs transition-opacity hover:opacity-60"
                    style={{ color: '#dc2626' }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ background: 'var(--surface)' }}
            >
              <input
                type="text"
                placeholder="Add category..."
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() }}}
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

        {/* Data */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>DATA</h2>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            {state.transactions.length} transaction{state.transactions.length !== 1 ? 's' : ''} stored
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
      </div>
    </main>
  )
}
