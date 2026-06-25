export type SetupStartAction = 'dashboard' | 'import' | 'addTransaction'

export type RootStackParamList = {
  Setup: undefined
  Main: undefined
  ImportStatement: undefined
  ImportDetails: { importSessionId: string }
  DeveloperMode: undefined
  Review: undefined
  BackupRestore: undefined
  Storage: undefined
  Privacy: undefined
  ImportHistory: undefined
}

export type MainTabParamList = {
  Home: { initialAction?: SetupStartAction } | undefined
  Transactions: undefined
  Month: { initialAction?: 'budget'; actionId?: number } | undefined
  Accounts: undefined
  Settings: undefined
}
