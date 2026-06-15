import type { CSSProperties } from 'react'

export default function BuddyUploadSVG({ size = 64, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
      role="img" aria-label="Upload file" style={{ display: 'block', ...style }}>
      <g transform="rotate(10 40 24)">
        <path d="M30 10 L44 10 L50 16 L50 36 L30 36 Z" fill="#FFFFFF" stroke="#1A936F" strokeWidth="2" strokeLinejoin="round" />
        <path d="M44 10 L44 16 L50 16 Z" fill="#CDE8DB" stroke="#1A936F" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M34 21 H45 M34 26 H45 M34 31 H41" stroke="#9FC7B4" strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M29 24 C 29 18, 24 16, 22 18.5 C 21 20.5, 25 24, 29 24 Z" fill="#1A936F" />
      <path d="M29 24 C 29 19, 32.5 17, 34.5 19.5 C 35.5 21.5, 32 24.5, 29 24 Z" fill="#2BA77F" />
      <path d="M29 26 L 29 22.5" stroke="#0F5132" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="29" cy="42" r="16" fill="#E4F1EA" stroke="#1A936F" strokeWidth="2.5" />
      <circle cx="29" cy="42" r="12" stroke="#1A936F" strokeWidth="1.2" strokeOpacity="0.3" />
      <circle cx="21.5" cy="46" r="2.6" fill="#F4B8A8" fillOpacity="0.7" />
      <circle cx="36.5" cy="46" r="2.6" fill="#F4B8A8" fillOpacity="0.7" />
      <circle cx="24" cy="40" r="2.2" fill="#0F5132" />
      <circle cx="34" cy="40" r="2.2" fill="#0F5132" />
      <path d="M23.5 46 Q29 51 34.5 46" stroke="#0F5132" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="49" cy="16" r="10.5" fill="#F4F6F2" />
      <circle cx="49" cy="16" r="9" fill="#1A936F" />
      <path d="M49 10.5 L44 16 L53.5 16 Z" fill="#FFFFFF" />
      <rect x="47.3" y="15" width="3.4" height="7" rx="1" fill="#FFFFFF" />
    </svg>
  )
}
