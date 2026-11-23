import type { Metadata, Viewport } from 'next'
import { Alexandria } from 'next/font/google'
import './globals.css'

const alexandria = Alexandria({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-alexandria',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'روافد — Rawafed',
  description: 'من منابع القرآن… إلى آفاق جديدة',
  // tiny inline gold icon (no extra file; avoids the /favicon.ico 404)
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%238a5a1e'/%3E%3Cstop offset='.5' stop-color='%23f3d58a'/%3E%3Cstop offset='1' stop-color='%23c9963f'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='14' fill='%231e1712'/%3E%3Cpath d='M14 50 32 14l18 36H40L32 32l-8 18z' fill='url(%23g)'/%3E%3C/svg%3E",
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FAF5EC',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={alexandria.variable}>
      <head>
        <link rel="preload" href="/logo.svg" as="image" type="image/svg+xml" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
