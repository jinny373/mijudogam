import React from "react"
import Script from 'next/script'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import PageViewTracker from '@/components/PageViewTracker'
import { PWARegister } from '@/components/pwa-register'
import { BottomNav } from '@/components/bottom-nav'
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
        {/* v9.25: 자동 버전 체크 - 새 배포 시 자동 새로고침 */}
        <Script id="version-check" strategy="afterInteractive">
          {`
            (function() {
              fetch('/api/version', { cache: 'no-store' })
                .then(function(res) { return res.json(); })
                .then(function(data) {
                  var SERVER_VERSION = data.version;
                  var STORED_VERSION = localStorage.getItem('mijudogam_app_version');
                  
                  if (STORED_VERSION && STORED_VERSION !== SERVER_VERSION) {
                    localStorage.setItem('mijudogam_app_version', SERVER_VERSION);
                    
                    if ('caches' in window) {
                      caches.keys().then(function(names) {
                        names.forEach(function(name) {
                          caches.delete(name);
                        });
                      });
                    }
                    
                    window.location.reload(true);
                  } else if (!STORED_VERSION) {
                    localStorage.setItem('mijudogam_app_version', SERVER_VERSION);
                  }
                })
                .catch(function(err) {
                  console.log('Version check failed:', err);
                });
            })();
          `}
        </Script>
        {/* v9.22: 카카오톡 인앱 브라우저 감지 → 외부 브라우저 유도 */}
        <Script id="kakao-inapp-redirect" strategy="beforeInteractive">
          {`
            (function() {
              var ua = navigator.userAgent || navigator.vendor;
              var isKakao = ua.indexOf('KAKAOTALK') > -1;
              if (isKakao) {
                document.addEventListener('DOMContentLoaded', function() {
                  document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:20px;text-align:center;font-family:sans-serif;">' +
                    '<div style="font-size:48px;margin-bottom:20px;">📱</div>' +
                    '<h2 style="margin-bottom:12px;color:#333;">외부 브라우저로 열어주세요</h2>' +
                    '<p style="color:#666;margin-bottom:24px;line-height:1.5;">카카오톡 내 브라우저에서는<br/>정상 작동하지 않을 수 있어요</p>' +
                    '<p style="color:#888;font-size:14px;">우측 상단 <strong>⋮</strong> 메뉴 →<br/><strong>다른 브라우저로 열기</strong></p>' +
                  '</div>';
                });
              }
            })();
          `}
        </Script>
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
        <BottomNav />
        <Analytics />
      </body>
    </html>
  )
}
