import React from "react"
import Script from 'next/script'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import PageViewTracker from '@/components/PageViewTracker'
import { PWARegister } from '@/components/pwa-register'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: '미주도감 - 미국 주식 AI 분석 서비스',
  description: 'AI가 미국 주식을 쉽게 해석해드립니다. 종목 분석, 투자 인사이트를 한눈에.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '미주도감',
  },
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
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className={`font-sans antialiased`}>
        {/* v9.22: 앱 시작 시 잘못된 localStorage 자동 정리 (에러 방지) */}
        <Script id="cleanup-localstorage" strategy="beforeInteractive">
          {`
            try {
              var watchlist = localStorage.getItem('mijudogam_watchlist');
              if (watchlist) {
                var parsed = JSON.parse(watchlist);
                if (Array.isArray(parsed)) {
                  var cleaned = parsed.filter(function(item) {
                    return item && typeof item.ticker === 'string';
                  });
                  if (cleaned.length !== parsed.length) {
                    localStorage.setItem('mijudogam_watchlist', JSON.stringify(cleaned));
                    console.log('[Watchlist] 잘못된 데이터 정리됨');
                  }
                }
              }
            } catch (e) {
              localStorage.removeItem('mijudogam_watchlist');
              console.log('[Watchlist] 데이터 초기화됨');
            }
          `}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-86S8VWEK1T"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-86S8VWEK1T');
          `}
        </Script>
        <PageViewTracker />
        <PWARegister />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
