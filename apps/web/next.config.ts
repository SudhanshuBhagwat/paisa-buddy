import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@paisa-buddy/ui',
    '@paisa-buddy/utils',
    '@paisa-buddy/types',
  ],
};

export default nextConfig;
