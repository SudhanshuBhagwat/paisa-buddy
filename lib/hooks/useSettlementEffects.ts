'use client'

import { useEffect } from 'react'
import type { Account } from '@/lib/types/account'
import type { TransactionType } from '@/lib/types/transaction'
import { applySettlementDefaults } from '@/lib/logic/settlement'
import type { ReviewFormState } from '@/lib/logic/review'

interface Params {
  category: string
  type: TransactionType
  accountId: string
  toAccountId: string
  accounts: Account[]
  setField: <K extends keyof ReviewFormState>(key: K, value: ReviewFormState[K]) => void
}

export function useSettlementEffects({ category, type, accountId, toAccountId, accounts, setField }: Params) {
  // fires when Settlement category selected — enforces transfer type, notes, and clears invalid accounts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (category === 'Settlement') {
      const result = applySettlementDefaults({ accountId, toAccountId }, accounts)
      setField('type', result.type)
      setField('description', result.description)
      setField('accountId', result.accountId)
      setField('toAccountId', result.toAccountId)
    }
  }, [category]) // intentional: reads accountId/toAccountId at category-change time only

  // auto-fills merchant with TO account name for transfers
  useEffect(() => {
    if (type === 'transfer' && toAccountId) {
      const acc = accounts.find((a) => a.id === toAccountId)
      if (acc) setField('merchant', acc.name)
    } else if (type === 'transfer') {
      setField('merchant', '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toAccountId, type]) // accounts intentionally omitted — merchant only re-fills on account selection change
}
