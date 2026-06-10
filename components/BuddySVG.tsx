import type { CSSProperties } from 'react'
import type { BuddyMood } from '@/lib/types'

export default function BuddySVG({ size = 64, mood = 'happy', style }: { size?: number; mood?: BuddyMood; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ display: 'block', flexShrink: 0, ...style }}>
      {mood === 'happy' && (
        <>
          <path d="M32 13 C 32 6, 26 3, 23 6 C 21 9, 26 13, 32 13 Z" fill="#1A936F" />
          <path d="M32 13 C 32 7, 38 5, 40 8 C 41 11, 37 14, 32 13 Z" fill="#2BA77F" />
          <path d="M32 16 L 32 11" stroke="#0F5132" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="36" r="22" fill="#E4F1EA" stroke="#1A936F" strokeWidth="2.5" />
          <circle cx="32" cy="36" r="17" stroke="#1A936F" strokeWidth="1.5" strokeOpacity="0.3" />
          <circle cx="22" cy="40" r="3.2" fill="#F4B8A8" fillOpacity="0.7" />
          <circle cx="42" cy="40" r="3.2" fill="#F4B8A8" fillOpacity="0.7" />
          <circle cx="25.5" cy="34" r="2.6" fill="#0F5132" />
          <circle cx="38.5" cy="34" r="2.6" fill="#0F5132" />
          <path d="M25 41 Q32 47 39 41" stroke="#0F5132" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === 'neutral' && (
        <>
          <path d="M32 14 C 32 8, 27 5, 24 7.5 C 22.5 9.5, 27 13, 32 14 Z" fill="#6BAA8F" />
          <path d="M32 14 C 32 9, 36 7, 38 9 C 39 11, 36 14, 32 14 Z" fill="#8BC4A8" />
          <path d="M32 17 L 32 12" stroke="#3D7A5E" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="36" r="22" fill="#ECF0ED" stroke="#7EA88F" strokeWidth="2.5" />
          <circle cx="32" cy="36" r="17" stroke="#7EA88F" strokeWidth="1.5" strokeOpacity="0.25" />
          <circle cx="25.5" cy="34" r="2.4" fill="#3D5A48" />
          <circle cx="38.5" cy="34" r="2.4" fill="#3D5A48" />
          <path d="M27 42 L37 42" stroke="#3D5A48" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === 'sad' && (
        <>
          <path d="M31 15 C 29 9, 23 8, 22 11 C 21.5 13, 26 15, 31 15 Z" fill="#8FAA9B" />
          <path d="M31 17 L 31 13" stroke="#6B8A78" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="32" cy="36" r="22" fill="#F5EDEA" stroke="#C4907E" strokeWidth="2.5" />
          <circle cx="32" cy="36" r="17" stroke="#C4907E" strokeWidth="1.5" strokeOpacity="0.2" />
          <circle cx="22" cy="41" r="3" fill="#E09A8A" fillOpacity="0.5" />
          <circle cx="42" cy="41" r="3" fill="#E09A8A" fillOpacity="0.5" />
          <circle cx="25.5" cy="35" r="2.3" fill="#6B4D42" />
          <circle cx="38.5" cy="35" r="2.3" fill="#6B4D42" />
          <path d="M23 31 Q25.5 29.5 28 31" stroke="#6B4D42" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M36 31 Q38.5 29.5 41 31" stroke="#6B4D42" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M26 44 Q32 39 38 44" stroke="#6B4D42" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  )
}
