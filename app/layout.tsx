import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { StoreProvider } from '@/lib/store'
import BottomNav from '@/components/BottomNav'
import TopNav from '@/components/TopNav'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Paisa Buddy',
  description: 'Personal finance tracker',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">
        <StoreProvider>
          <TopNav />
          {children}
          <BottomNav />
        </StoreProvider>
      </body>
    </html>
  )
}
