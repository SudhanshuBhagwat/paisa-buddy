'use client'

import { createContext, useContext, useEffect, useReducer } from 'react'
import type { AppState, Action } from './types'
import { loadState, saveState, DEFAULT_STATE } from './storage'

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload
    case 'ADD_TX':
      return { ...state, transactions: [action.payload, ...state.transactions] }
    case 'DELETE_TX':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.payload) }
    case 'ADD_CATEGORY':
      if (state.customCategories.includes(action.payload)) return state
      return { ...state, customCategories: [...state.customCategories, action.payload] }
    case 'REMOVE_CATEGORY':
      return { ...state, customCategories: state.customCategories.filter((c) => c !== action.payload) }
    case 'SET_DARK_MODE':
      return { ...state, darkMode: action.payload }
    case 'SET_BUDDY_MOOD':
      return { ...state, buddyMood: action.payload }
    case 'CLEAR_ALL':
      return { ...DEFAULT_STATE, darkMode: state.darkMode }
    default:
      return state
  }
}

interface StoreCtx {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const StoreContext = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE)

  useEffect(() => {
    dispatch({ type: 'HYDRATE', payload: loadState() })
  }, [])

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode)
  }, [state.darkMode])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore(): StoreCtx {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
