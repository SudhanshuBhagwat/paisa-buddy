import { Suspense } from 'react'
import { requireSetup } from '@/lib/auth/require-setup'
import { ensureUploadToken } from '@/app/actions/user-settings'
import ShortcutClient from './ShortcutClient'

async function ShortcutContent() {
  await requireSetup()
  const token = await ensureUploadToken()
  const base = (process.env.AUTH_URL ?? '').replace(/\/$/, '')
  const uploadUrl = `${base}/api/receipts/upload`
  return <ShortcutClient token={token} uploadUrl={uploadUrl} />
}

export default function ShortcutPage() {
  return (
    <Suspense>
      <ShortcutContent />
    </Suspense>
  )
}
