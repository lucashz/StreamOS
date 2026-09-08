import type { NextConfig } from 'next';

const apiOrigin = process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  rewrites() {
    return Promise.resolve([
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/:path*`,
      },
    ]);
  },
};

export default nextConfig;
