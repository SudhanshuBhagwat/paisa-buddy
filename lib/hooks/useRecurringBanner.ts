'use client'

import { useState, useEffect } from 'react'
import type { Transaction } from '@/lib/types/transaction'
import { getNewRecurringCount, markRecurringAsSeen } from '@/lib/logic/recurring'

export function useRecurringBanner(transactions: Transaction[]) {
  const [newCount, setNewCount] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setNewCount(getNewRecurringCount(transactions))
  }, [transactions])

  function dismiss() {
    markRecurringAsSeen(transactions)
    setDismissed(true)
  }

  return { newCount, dismissed, dismiss }
}
