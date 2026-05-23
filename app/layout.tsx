import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import PinchZoomBlock from "@/components/PinchZoomBlock";
import { getCachedPendingTransactions } from "@/lib/db/cached-queries";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paisa Buddy",
  description: "Personal finance tracker",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

async function NavWithCount() {
  const pending = await getCachedPendingTransactions();
  const count = pending.length;
  return (
    <>
      <TopNav pendingCount={count} />
      <BottomNav pendingCount={count} />
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">
        <PinchZoomBlock />
        <StoreProvider>
          <Suspense fallback={<><TopNav /><BottomNav /></>}>
            <NavWithCount />
          </Suspense>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
