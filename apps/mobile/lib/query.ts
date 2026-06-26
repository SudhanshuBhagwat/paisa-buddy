import type { QueryClient } from '@tanstack/react-query'

export const queryKeys = {
  home: ['homeData'] as const,
  transactions: (month?: string) => (month ? ['transactionsData', month] : ['transactionsData']) as readonly string[],
  transactionSupport: ['transactionsSupportData'] as const,
  review: ['reviewData'] as const,
  accounts: ['accounts'] as const,
  categories: ['categories'] as const,
  investments: ['investments'] as const,
  settings: ['settings'] as const,
  stats: (month?: string) => (month ? ['statsData', month] : ['statsData']) as readonly string[],
}

export function invalidateTransactionData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.home })
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions() })
  queryClient.invalidateQueries({ queryKey: queryKeys.transactionSupport })
  void queryClient.refetchQueries({ queryKey: queryKeys.transactions(), type: 'active' })
  queryClient.invalidateQueries({ queryKey: queryKeys.review })
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
  queryClient.invalidateQueries({ queryKey: queryKeys.investments })
  queryClient.invalidateQueries({ queryKey: queryKeys.settings })
  queryClient.invalidateQueries({ queryKey: queryKeys.stats() })
}

export function invalidateAccountData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.home })
  queryClient.invalidateQueries({ queryKey: queryKeys.review })
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
  queryClient.invalidateQueries({ queryKey: queryKeys.transactionSupport })
  queryClient.invalidateQueries({ queryKey: queryKeys.stats() })
}

export function invalidateCategoryData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.home })
  queryClient.invalidateQueries({ queryKey: queryKeys.review })
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions() })
  queryClient.invalidateQueries({ queryKey: queryKeys.transactionSupport })
  queryClient.invalidateQueries({ queryKey: queryKeys.settings })
  queryClient.invalidateQueries({ queryKey: queryKeys.categories })
  queryClient.invalidateQueries({ queryKey: queryKeys.stats() })
  void queryClient.refetchQueries({ queryKey: queryKeys.transactions(), type: 'active' })
  void queryClient.refetchQueries({ queryKey: queryKeys.categories, type: 'active' })
}

export function invalidateSettingsData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.home })
  queryClient.invalidateQueries({ queryKey: queryKeys.settings })
}
