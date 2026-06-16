export type Investment = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type InvestmentWithTotal = Investment & {
  total_invested: number // paise: SUM(debits) - SUM(credits) for linked reviewed txns
}
