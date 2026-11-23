import type { NextConfig } from 'next'

/**
 * Fully static site (no server / API routes): `npm run build` writes a plain `out/` folder that any
 * static host serves (Vercel, Netlify, Cloudflare Pages). Long cache headers for the 3D / media
 * assets are in public/_headers (Netlify, Cloudflare) and vercel.json (Vercel).
 */
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false, // no Next.js dev bubble
}

export default nextConfig
