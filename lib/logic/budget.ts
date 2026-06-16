export type BudgetStatus = 'green' | 'amber' | 'red'

export function budgetStatus(spent: number, budget: number): BudgetStatus {
  if (budget <= 0) return 'green'
  const pct = spent / budget
  if (pct >= 1) return 'red'
  if (pct >= 0.7) return 'amber'
  return 'green'
}

export function budgetProgress(spent: number, budget: number): number {
  if (budget <= 0) return 0
  return Math.min(Math.round((spent / budget) * 100), 100)
}
