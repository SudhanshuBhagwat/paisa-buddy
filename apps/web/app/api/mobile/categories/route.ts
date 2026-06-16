import { NextRequest, NextResponse } from 'next/server'
import { categoriesDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { parseBody, MAX_NAME_LEN } from '@/lib/mobile-validate'
import { generateUniqueColor } from '@paisa-buddy/shared/categories'

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await parseBody<{ name?: string }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (name.length > MAX_NAME_LEN) return NextResponse.json({ error: `name too long (max ${MAX_NAME_LEN})` }, { status: 400 })

  const color = generateUniqueColor()
  await categoriesDb.upsertCustom(auth.userId, name, color)
  return NextResponse.json({ name, color }, { status: 201 })
}
