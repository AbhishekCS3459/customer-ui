import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/marketplace/toaster'
import './globals.css'

export const metadata: Metadata = {
  title: 'TodayZ — Find it nearby',
  description: 'Search a product, compare nearby stores by price, distance and availability, then go and buy.',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="bg-canvas text-ink antialiased">
        <Toaster>{children}</Toaster>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
