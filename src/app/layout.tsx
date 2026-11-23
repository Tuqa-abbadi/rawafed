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
        <link rel="preload" href="/logo.svg" as="image" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  )
}
