export type SetupStartAction = 'dashboard' | 'import' | 'addTransaction'

export type RootStackParamList = {
  Setup: undefined
  Main: undefined
  ImportStatement: undefined
  Review: undefined
}

export type MainTabParamList = {
  Home: { initialAction?: SetupStartAction } | undefined
  Transactions: undefined
  Month: undefined
  Accounts: undefined
  Settings: undefined
}
