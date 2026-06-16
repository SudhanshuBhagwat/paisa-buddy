import { NextRequest, NextResponse } from 'next/server'
import { budgetsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  await budgetsDb.delete(auth.userId, id)
  return new NextResponse(null, { status: 204 })
}
