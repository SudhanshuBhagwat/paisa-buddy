import { ImageResponse } from 'next/og'

export const size = { width: 200, height: 200 }
export const contentType = 'image/png'

const svgBase64 = btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 0 64 64" fill="none">' +
  '<path d="M32 13 C 32 6, 26 3, 23 6 C 21 9, 26 13, 32 13 Z" fill="#1A936F"/>' +
  '<path d="M32 13 C 32 7, 38 5, 40 8 C 41 11, 37 14, 32 13 Z" fill="#2BA77F"/>' +
  '<path d="M32 16 L 32 11" stroke="#0F5132" stroke-width="2" stroke-linecap="round"/>' +
  '<circle cx="32" cy="36" r="22" fill="#E4F1EA" stroke="#1A936F" stroke-width="2.5"/>' +
  '<circle cx="32" cy="36" r="17" stroke="#1A936F" stroke-width="1.5" stroke-opacity="0.3"/>' +
  '<circle cx="22" cy="40" r="3.2" fill="#F4B8A8" fill-opacity="0.7"/>' +
  '<circle cx="42" cy="40" r="3.2" fill="#F4B8A8" fill-opacity="0.7"/>' +
  '<circle cx="25.5" cy="34" r="2.6" fill="#0F5132"/>' +
  '<circle cx="38.5" cy="34" r="2.6" fill="#0F5132"/>' +
  '<path d="M25 41 Q32 47 39 41" stroke="#0F5132" stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
  '</svg>'
)

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 200,
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;base64,${svgBase64}`}
          width={172}
          height={172}
          alt=""
        />
      </div>
    ),
    { width: 200, height: 200 }
  )
}
