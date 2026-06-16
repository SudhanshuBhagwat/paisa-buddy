import type { CSSProperties } from 'react'

export default function BuddyWelcomeB({ size = 64, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
      role="img" aria-label="Buddy mascot waving hello"
      style={{ display: 'block', flexShrink: 0, ...style }}>
      {/* speech bubble */}
      <rect x="40" y="6" width="20" height="14" rx="5" fill="#1A936F" />
      <path d="M45 19 L45 24 L50 19 Z" fill="#1A936F" />
      <text x="50" y="16" textAnchor="middle" fill="#fff"
        style={{ font: '700 8px "Plus Jakarta Sans", system-ui' }}>hi!</text>
      {/* sparkles */}
      <path d="M10 16 C 10 18, 12 20, 14 20 C 12 20, 10 22, 10 24 C 10 22, 8 20, 6 20 C 8 20, 10 18, 10 16 Z" fill="#E0A33C" />
      <path d="M58 34 C 58 35.6, 59.6 37, 61 37 C 59.6 37, 58 38.4, 58 40 C 58 38.4, 56.4 37, 55 37 C 56.4 37, 58 35.6, 58 34 Z" fill="#2BA77F" />
      {/* sprout */}
      <path d="M27 22 C 27 16, 22 13, 19 16 C 17 19, 22 22, 27 22 Z" fill="#1A936F" />
      <path d="M27 22 C 27 17, 32 15, 34 18 C 35 20, 31 23, 27 22 Z" fill="#2BA77F" />
      <path d="M27 25 L 27 20" stroke="#0F5132" strokeWidth="2" strokeLinecap="round" />
      {/* coin */}
      <circle cx="27" cy="44" r="19" fill="#E4F1EA" stroke="#1A936F" strokeWidth="2.5" />
      <circle cx="27" cy="44" r="14.5" stroke="#1A936F" strokeWidth="1.3" strokeOpacity="0.3" />
      {/* cheeks */}
      <circle cx="18.5" cy="46" r="3" fill="#F4B8A8" fillOpacity="0.75" />
      <circle cx="35.5" cy="46" r="3" fill="#F4B8A8" fillOpacity="0.75" />
      {/* eyes */}
      <circle cx="21.5" cy="41" r="2.5" fill="#0F5132" />
      <circle cx="32.5" cy="41" r="2.5" fill="#0F5132" />
      {/* smile */}
      <path d="M20.5 46 Q27 53 33.5 46" stroke="#0F5132" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      {/* ledge */}
      <path d="M2 55 H62 V62 a2 2 0 0 1 -2 2 H4 a2 2 0 0 1 -2 -2 Z" fill="#0F5132" />
      <rect x="2" y="53" width="60" height="3" rx="1.5" fill="#1A936F" />
    </svg>
  )
}
