import type { CSSProperties } from 'react'
export default function BuddySVG({ size = 64, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ display: 'block', flexShrink: 0, ...style }}>
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
    </svg>
  )
}
