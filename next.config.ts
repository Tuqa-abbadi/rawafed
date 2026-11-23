import type { NextConfig } from 'next'

const LONG_CACHE = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false, // no Next.js dev bubble
  // static 3D / media assets: cache for a year (file names change when the content changes)
  async headers() {
    return ['/models/:path*', '/textures/:path*', '/audio/:path*', '/env/:path*'].map((source) => ({ source, headers: LONG_CACHE }))
  },
}

export default nextConfig
