'use client'

import { useActionState } from 'react'
import { requestOTP, verifyOTPAndSignIn } from './actions'
import type { RequestOTPState, VerifyOTPState } from './actions'

export default function LoginPage() {
  const [emailState, emailAction, emailPending] = useActionState<RequestOTPState, FormData>(
    requestOTP,
    {},
  )
  const [otpState, otpAction, otpPending] = useActionState<VerifyOTPState, FormData>(
    verifyOTPAndSignIn,
    {},
  )

  if (emailState.email) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to <strong>{emailState.email}</strong>
            </p>
          </div>

          <form action={otpAction} className="space-y-4">
            <input type="hidden" name="email" value={emailState.email} />
            <div className="space-y-1">
              <label htmlFor="token" className="text-sm font-medium">
                Login code
              </label>
              <input
                id="token"
                name="token"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                autoComplete="one-time-code"
                autoFocus
                required
                className="w-full rounded-md border px-3 py-2 text-lg tracking-widest focus:outline-none focus:ring-2"
              />
            </div>
            {otpState.error && <p className="text-sm text-red-500">{otpState.error}</p>}
            <button
              type="submit"
              disabled={otpPending}
              className="w-full rounded-md bg-foreground text-background py-2 font-medium disabled:opacity-60"
            >
              {otpPending ? 'Verifying…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Sign in to Paisa Buddy</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll send a one-time code to your email.
          </p>
        </div>

        <form action={emailAction} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              required
              className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2"
            />
          </div>
          {emailState.error && <p className="text-sm text-red-500">{emailState.error}</p>}
          <button
            type="submit"
            disabled={emailPending}
            className="w-full rounded-md bg-foreground text-background py-2 font-medium disabled:opacity-60"
          >
            {emailPending ? 'Sending…' : 'Send code'}
          </button>
        </form>
      </div>
    </main>
  )
}
