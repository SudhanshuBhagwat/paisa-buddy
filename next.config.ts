import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // Prevent the client from caching RSC payloads for static pages.
    // Without this, navigating to a page (e.g. tapping the Review tab) serves
    // a stale RSC payload for up to 5 minutes even after updateTag() fires.
    // Server-side 'use cache' remains intact so responses are still fast.
    staleTimes: {
      static: 0,
    },
  },
};

export default nextConfig;
