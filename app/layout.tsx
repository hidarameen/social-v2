import React from "react"
import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import Providers from './providers'
import { Toaster } from 'sonner'
import { SplashOverlay } from '@/components/layout/splash-overlay'
import './globals.css'

export const metadata: Metadata = {
  title: 'SocialFlow - Social Media Automation Platform',
  description: 'Professional social media automation, scheduling, and analytics platform. Connect multiple accounts across Facebook, Instagram, Twitter, TikTok, YouTube, Telegram, and LinkedIn.',
  generator: 'v0.app',
  keywords: 'social media, automation, scheduling, buffer, zapier, ifttt, facebook, instagram, twitter, tiktok, youtube',
  authors: [{ name: 'SocialFlow' }],
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <SplashOverlay />
          {children}
        </Providers>
        <Toaster richColors />
        <Analytics />
      </body>
    </html>
  )
}
