'use client'

import { useState } from 'react'
import type { Transaction } from '@/lib/types/transaction'
import type { Account } from '@/lib/types/account'
import type { InvestmentWithTotal } from '@/lib/db/types'
import { sanitizeAmountInput } from '@/lib/logic/amount'
import {
  isTransactionConfirmable,
  formStateToPayload,
  txToFormState,
  type ReviewFormState,
} from '@/lib/logic/review'

const BLANK: ReviewFormState = {
  type: 'debit',
  amountStr: '',
  merchant: '',
  description: '',
  category: '',
  accountId: '',
  toAccountId: '',
  bank: '',
  upiRef: '',
  date: '',
  time: '',
  isRecurring: false,
  investmentId: '',
}

export function useTransactionForm(
  baseAccounts: Account[],
  baseInvestments: InvestmentWithTotal[],
  baseCats: string[],
  tx?: Transaction,
  overrides?: Partial<ReviewFormState>,
) {
  const initial = tx ? { ...txToFormState(tx), ...overrides } : { ...BLANK, ...overrides }

  const [fields, setFields] = useState<ReviewFormState>(initial)
  const [extraCats, setExtraCats] = useState<string[]>([])
  const [extraAccounts, setExtraAccounts] = useState<Account[]>([])
  const [extraInvestments, setExtraInvestments] = useState<InvestmentWithTotal[]>([])

  const allCats = [...baseCats, ...extraCats.filter((c) => !baseCats.includes(c))]
  const allAccounts = [...baseAccounts, ...extraAccounts.filter((a) => !baseAccounts.find((x) => x.id === a.id))]
  const allInvestments = [...baseInvestments, ...extraInvestments.filter((i) => !baseInvestments.find((x) => x.id === i.id))]

  function setField<K extends keyof ReviewFormState>(key: K, value: ReviewFormState[K]) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function reset(overrideValues?: Partial<ReviewFormState>) {
    setFields({ ...BLANK, ...overrideValues })
    setExtraCats([])
    setExtraAccounts([])
    setExtraInvestments([])
  }

  function handleAmountChange(raw: string) {
    setField('amountStr', sanitizeAmountInput(raw))
  }

  function addExtraCat(name: string) {
    if (!name || allCats.includes(name)) return
    setExtraCats((prev) => [...prev, name])
    setField('category', name)
  }

  function addExtraAccount(acc: Account) {
    setExtraAccounts((prev) => [...prev, acc])
    setField('accountId', acc.id)
  }

  function addExtraInvestment(inv: InvestmentWithTotal) {
    setExtraInvestments((prev) => [...prev, inv])
    setField('investmentId', inv.id)
  }

  const isValid = isTransactionConfirmable(fields)
  const toPayload = () => formStateToPayload(fields)

  return {
    fields,
    allCats,
    allAccounts,
    allInvestments,
    setField,
    reset,
    handleAmountChange,
    addExtraCat,
    addExtraAccount,
    addExtraInvestment,
    isValid,
    toPayload,
  }
}
