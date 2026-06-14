import 'server-only'
import type { NextRequest } from 'next/server'
import { auth } from '@/auth'

type SessionOk = { userId: string }
type SessionFail = Response

/**
 * For use in Route Handlers only (not server actions or server components).
 *
 * Returns { userId } when the request has a valid session, or a 401/403 Response
 * that the caller must return immediately.
 *
 * Also enforces that the request originates from the same host (same-site), so
 * the endpoint cannot be called from external tools or other origins — only from
 * the web app itself.
 */
export async function requireApiSession(req: NextRequest): Promise<SessionOk | SessionFail> {
  // 1. Session check
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Same-origin check — request must come from this app's own host.
  //    Browsers always send an Origin header on cross-origin requests and on
  //    same-site requests that involve a body (POST/PUT/PATCH).
  //    Absence of Origin on a POST is a strong signal the request isn't from a browser.
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')

  if (!origin || !host) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (originHost !== host) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { userId }
}
