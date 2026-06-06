'use client'

import { useEffect } from 'react'
import { useScrollLock } from '@/lib/hooks/useScrollLock'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmColor?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  confirmColor = 'var(--pb-neg)',
  onConfirm,
  onCancel,
}: Props) {
  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onCancel}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4">
        <div
          className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 pointer-events-auto"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{message}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
              style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: confirmColor, color: '#fff' }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

