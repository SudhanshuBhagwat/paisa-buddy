export type Budget = {
  id: string
  user_id: string
  category: string
  amount: number // paise
  period: 'monthly'
  created_at: string
}

export type BudgetWithSpent = Budget & {
  spent: number // paise, current-month confirmed debits in this category
}
