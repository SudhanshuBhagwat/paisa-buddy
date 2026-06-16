import { NextRequest, NextResponse } from 'next/server'
import { categoriesDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { generateUniqueColor } from '@paisa-buddy/shared/categories'

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { name: string }
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const color = generateUniqueColor()
  await categoriesDb.upsertCustom(auth.userId, body.name.trim(), color)
  return NextResponse.json({ name: body.name.trim(), color }, { status: 201 })
}
