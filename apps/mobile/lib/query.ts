import type { QueryClient } from '@tanstack/react-query'

export const queryKeys = {
  home: ['homeData'] as const,
  review: ['reviewData'] as const,
  accounts: ['accounts'] as const,
  investments: ['investments'] as const,
  settings: ['settings'] as const,
  stats: (month?: string) => (month ? ['statsData', month] : ['statsData']) as readonly string[],
}

export function invalidateTransactionData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.home })
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
  queryClient.invalidateQueries({ queryKey: queryKeys.stats() })
}

export function invalidateCategoryData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.home })
  queryClient.invalidateQueries({ queryKey: queryKeys.review })
  queryClient.invalidateQueries({ queryKey: queryKeys.settings })
  queryClient.invalidateQueries({ queryKey: queryKeys.stats() })
}

export function invalidateSettingsData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.home })
  queryClient.invalidateQueries({ queryKey: queryKeys.settings })
}
