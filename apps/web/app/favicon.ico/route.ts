import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(_req: NextRequest) {
  const svg = await readFile(path.join(process.cwd(), 'app', 'icon.svg'))
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
