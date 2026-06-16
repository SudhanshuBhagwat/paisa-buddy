'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function WindowFocusRefresh() {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const onFocus = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => router.refresh(), 2000)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [router])
  return null
}
