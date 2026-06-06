'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { logout } from '@/lib/auth/actions'
import {
  addCategory, removeCategory, removeCategoryAndUnlinkTransactions, clearAllTransactions,
} from '@/app/actions/categories'
import { addUpiId, removeUpiId, setDisplayName } from '@/app/actions/user-settings'
import ConfirmModal from '@/components/ConfirmModal'

interface CategoryWithCount { name: string; color: string; transactionCount: number }

interface Props {
  email: string | null
  transactionCount: number
  customCategories: CategoryWithCount[]
  predefinedCategories: CategoryWithCount[]
  upiIds: string[]
  displayName: string | null
}

const CARD: React.CSSProperties = {
  background: 'var(--pb-surface)', border: '1px solid var(--pb-line)',
  borderRadius: 'var(--pb-radius)', boxShadow: 'var(--pb-card-shadow)',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--pb-ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Row({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: last ? undefined : '1px solid var(--pb-line)' }}>
      {children}
    </div>
  )
}

const navItems = [
  { id: 'profile',    label: 'Profile',          icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { id: 'upi',        label: 'UPI IDs',           icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
  { id: 'appearance', label: 'Appearance',        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
  { id: 'categories', label: 'Categories',        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
  { id: 'shortcut',   label: 'Apple Shortcut',   icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
  { id: 'data',       label: 'Data',              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> },
]

export default function SettingsClient({ email, transactionCount, customCategories, predefinedCategories, upiIds, displayName }: Props) {
  const { state, dispatch } = useStore()
  const [newCat, setNewCat] = useState('')
  const [newUpi, setNewUpi] = useState('')
  const [nameInput, setNameInput] = useState(displayName ?? '')
  const [confirmClear, setConfirmClear] = useState(false)
  const [removingCat, setRemovingCat] = useState<CategoryWithCount | null>(null)
  const [activeNav, setActiveNav] = useState('profile')

  async function handleAddUpiId() {
    const id = newUpi.trim().toLowerCase()
    if (!id) return
    await addUpiId(id); setNewUpi('')
  }
  async function handleAddCategory() {
    const name = newCat.trim()
    if (!name) return
    await addCategory(name); setNewCat('')
  }
  async function handleConfirmRemoveCategory() {
    if (!removingCat) return
    if (removingCat.transactionCount > 0) await removeCategoryAndUnlinkTransactions(removingCat.name)
    else await removeCategory(removingCat.name)
    setRemovingCat(null)
  }
  async function handleClear() {
    if (confirmClear) { await clearAllTransactions(); setConfirmClear(false) }
    else setConfirmClear(true)
  }

  const initials = nameInput.trim()
    ? nameInput.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : email ? email.slice(0, 2).toUpperCase() : '?'

  const removingCatMessage = removingCat
    ? removingCat.transactionCount > 0
      ? `${removingCat.transactionCount} transaction${removingCat.transactionCount !== 1 ? 's' : ''} use this category. Their category will be cleared.`
      : 'This cannot be undone.'
    : ''

  function scrollToSection(id: string) {
    setActiveNav(id)
    const el = document.getElementById(`section-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Shared section content ──────────────────────────────────────────

  function renderProfile(id?: string) {
    return (
      <section id={id}>
        <SectionLabel>Profile</SectionLabel>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 16px', borderBottom: '1px solid var(--pb-line)' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'color-mix(in srgb, var(--pb-brand) 15%, var(--pb-surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--pb-brand)' }}>{initials}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input type="text" placeholder="Your name" value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={async () => { await setDisplayName(nameInput.trim()) }}
                style={{ fontSize: 16, fontWeight: 700, color: 'var(--pb-ink)', background: 'transparent', border: 'none', outline: 'none', width: '100%', padding: 0, fontFamily: 'inherit' }} />
              <div style={{ fontSize: 12.5, color: 'var(--pb-ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email ?? '—'}</div>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--pb-ink-3)', marginTop: 6, lineHeight: 1.5 }}>
          Your name and email help identify you as sender or receiver in uploaded receipts.
        </p>
      </section>
    )
  }

  function renderUPI(id?: string) {
    return (
      <section id={id}>
        <SectionLabel>UPI IDs <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></SectionLabel>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {upiIds.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--pb-ink-3)' }}>No UPI IDs added yet</div>
          ) : upiIds.map((id, idx) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--pb-line)' }}>
              <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--pb-ink)' }}>{id}</span>
              <button onClick={() => removeUpiId(id)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--pb-neg)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
            <input type="text" placeholder="yourname@upi" value={newUpi}
              onChange={(e) => setNewUpi(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUpiId() } }}
              style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', background: 'transparent', border: 'none', outline: 'none', color: 'var(--pb-ink)' }} />
            <button onClick={handleAddUpiId} disabled={!newUpi.trim()}
              style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--pb-brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: newUpi.trim() ? 1 : 0.35 }}>Add</button>
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--pb-ink-3)', marginTop: 6, lineHeight: 1.5 }}>
          Your UPI IDs help identify debit vs credit direction in uploaded receipts.
        </p>
      </section>
    )
  }

  function renderAppearance(id?: string) {
    return (
      <section id={id}>
        <SectionLabel>Appearance</SectionLabel>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <Row last>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pb-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span style={{ fontSize: 13.5, color: 'var(--pb-ink)' }}>Dark mode</span>
            </div>
            <button onClick={() => dispatch({ type: 'SET_DARK_MODE', payload: !state.darkMode })}
              style={{ position: 'relative', width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s', background: state.darkMode ? 'var(--pb-brand)' : 'var(--pb-line)' }}
              aria-pressed={state.darkMode}>
              <span style={{ position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'transform 0.2s', transform: state.darkMode ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </Row>
        </div>
      </section>
    )
  }

  function renderCategories(id?: string) {
    return (
      <section id={id}>
        <SectionLabel>Custom Categories</SectionLabel>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {customCategories.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--pb-ink-3)' }}>No custom categories yet</div>
          ) : customCategories.map((cat) => (
            <div key={cat.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--pb-line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, color: 'var(--pb-ink)' }}>{cat.name}</span>
                {cat.transactionCount > 0 && (
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, background: 'var(--pb-bg)', color: 'var(--pb-ink-3)', border: '1px solid var(--pb-line)', flexShrink: 0 }}>
                    {cat.transactionCount} tx
                  </span>
                )}
              </div>
              <button onClick={() => setRemovingCat(cat)}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--pb-neg)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
            <input type="text" placeholder="Add category..." value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }}
              style={{ flex: 1, fontSize: 13, background: 'transparent', border: 'none', outline: 'none', color: 'var(--pb-ink)', fontFamily: 'inherit' }} />
            <button onClick={handleAddCategory} disabled={!newCat.trim()}
              style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--pb-brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: newCat.trim() ? 1 : 0.35 }}>Add</button>
          </div>
        </div>
        {predefinedCategories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {predefinedCategories.map(({ name, transactionCount: count }) => (
              <span key={name} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, background: 'var(--pb-bg)', color: 'var(--pb-ink-3)', border: '1px solid var(--pb-line)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {name}
                {count > 0 && <span style={{ fontWeight: 600, color: 'var(--pb-ink)' }}>{count}</span>}
              </span>
            ))}
          </div>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--pb-ink-3)', marginTop: 8, lineHeight: 1.5 }}>
          Built-in categories (shown above) cannot be removed.
        </p>
      </section>
    )
  }

  function renderShortcut(id?: string) {
    return (
      <section id={id}>
        <SectionLabel>Apple Shortcut</SectionLabel>
        <Link href="/settings/shortcut" style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pb-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <span style={{ fontSize: 13.5, color: 'var(--pb-ink)' }}>Setup instructions & credentials</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pb-ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </section>
    )
  }

  function renderData(id?: string) {
    return (
      <section id={id}>
        <SectionLabel>Data</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--pb-ink-3)' }}>
            {transactionCount} transaction{transactionCount !== 1 ? 's' : ''} stored
          </div>
          <button onClick={handleClear} style={{
            padding: '12px 16px', borderRadius: 'var(--pb-radius)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
            ...(confirmClear
              ? { background: 'var(--pb-neg)', color: '#fff', border: 'none' }
              : { background: 'var(--pb-surface)', color: 'var(--pb-neg)', border: '1px solid var(--pb-neg)' })
          }}>
            {confirmClear ? 'Tap again to confirm — this cannot be undone' : 'Clear all data'}
          </button>
          {confirmClear && (
            <button onClick={() => setConfirmClear(false)} style={{ fontSize: 13, color: 'var(--pb-ink-3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          )}
          <form action={logout} style={{ marginTop: 4 }}>
            <button type="submit" style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--pb-radius)', fontSize: 13.5, fontWeight: 600, background: 'var(--pb-surface)', color: 'var(--pb-neg)', border: '1px solid var(--pb-line)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Sign out
            </button>
          </form>
        </div>
      </section>
    )
  }

  return (
    <main className="w-full min-h-dvh pb-24 md:pb-0 md:pt-14 lg:pt-[66px]">

      {/* ── Desktop: sidebar + content ───────────────────────── */}
      <div className="hidden lg:flex" style={{ height: 'calc(100dvh - 66px)', overflow: 'hidden' }}>
        {/* Left nav */}
        <nav style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--pb-line)', overflowY: 'auto', padding: '28px 0', display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--pb-ink)', margin: '0 24px 20px' }}>Settings</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {navItems.map(({ id, label, icon }) => (
              <button key={id} type="button" onClick={() => scrollToSection(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '11px 24px', border: 'none', borderRight: activeNav === id ? '3px solid var(--pb-brand)' : '3px solid transparent', cursor: 'pointer', fontFamily: 'inherit',
                  background: activeNav === id ? 'var(--pb-brand-pale)' : 'transparent',
                  color: activeNav === id ? 'var(--pb-brand-deep)' : 'var(--pb-ink-2)', fontWeight: activeNav === id ? 700 : 600, fontSize: 14, textAlign: 'left',
                }}>
                <span style={{ color: activeNav === id ? 'var(--pb-brand)' : 'var(--pb-ink-3)' }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <form action={logout}>
            <button type="submit" style={{ width: '100%', padding: '11px 24px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color: 'var(--pb-neg)', fontSize: 14, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </form>
        </nav>

        {/* Right content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 44px', scrollBehavior: 'smooth' }}>
          <div style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 28 }}>
            {renderProfile('section-profile')}
            {renderUPI('section-upi')}
            {renderAppearance('section-appearance')}
            {renderCategories('section-categories')}
            {renderShortcut('section-shortcut')}
            {renderData('section-data')}
          </div>
        </div>
      </div>

      {/* ── Mobile + Tablet ──────────────────────────────────── */}
      <div className="lg:hidden">
        {/* Mobile header */}
        <div className="md:hidden" style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 10px' }}>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: 'var(--pb-ink)', margin: 0 }}>Settings</h1>
        </div>
        {/* Tablet header */}
        <div className="hidden md:flex items-center px-6 py-4" style={{ borderBottom: '1px solid var(--pb-line)' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--pb-ink)', margin: 0 }}>Settings</h1>
        </div>

        <div style={{ padding: '12px 18px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {renderProfile()}
          {renderUPI()}
          {renderAppearance()}
          {renderCategories()}
          {renderShortcut()}
          {renderData()}
        </div>
      </div>

      <ConfirmModal
        open={removingCat !== null}
        title={`Delete "${removingCat?.name}" category?`}
        message={removingCatMessage}
        confirmLabel="Delete"
        onConfirm={handleConfirmRemoveCategory}
        onCancel={() => setRemovingCat(null)} />
    </main>
  )
}
