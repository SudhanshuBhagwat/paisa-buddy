const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

async function post<T>(path: string, body: object): Promise<T> {
  const url = `${BASE}${path}`
  console.log('[api] POST', url)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

export async function requestOtp(email: string): Promise<void> {
  await post('/api/auth/send-otp', { email })
}

export async function confirmOtp(email: string, token: string): Promise<{ supabaseToken: string }> {
  return post('/api/auth/verify-otp', { email, token })
}
