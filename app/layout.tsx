import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import PinchZoomBlock from "@/components/PinchZoomBlock";
import { getCachedPendingTransactions } from "@/lib/db/cached-queries";
import { auth } from "@/auth";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Paisa Buddy",
  description: "Personal finance tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Paisa Buddy",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F6F2" },
    { media: "(prefers-color-scheme: dark)", color: "#17161A" },
  ],
};

async function NavWithCount() {
  const session = await auth();
  const userId = session?.user?.id;
  // No session (e.g. /login page) — render nav without count.
  const count = userId ? (await getCachedPendingTransactions(userId)).length : 0;
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
    <html lang="en" className={`${plusJakarta.variable} ${spaceMono.variable} h-full antialiased`}>
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
