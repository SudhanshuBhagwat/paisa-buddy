export type AuthUser = {
  id: string
  email: string
}

export interface AuthProvider {
  getSession(req?: Request): Promise<AuthUser | null>
}
