import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Strict compilation — treat warnings as errors in CI
  typescript: {
    ignoreBuildErrors: false,
  },
  // CSP and security headers (nonce wired in middleware, Phase 4)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
