import { createContext, useContext } from 'react'
import type { SetupStartAction } from './types'

export const SetupCompleteCtx = createContext<(action?: SetupStartAction) => void>(() => {})
export const SetupResetCtx = createContext<() => void>(() => {})

export const useSetupComplete = () => useContext(SetupCompleteCtx)
export const useSetupReset = () => useContext(SetupResetCtx)
