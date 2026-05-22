import type { AppState } from './types'

const KEY = 'paisa-buddy-v1'

export const DEFAULT_STATE: AppState = {
  transactions: [],
  customCategories: [],
  darkMode: false,
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_STATE
    return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_STATE
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(state))
}
