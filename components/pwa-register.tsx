'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker 등록 성공:', registration.scope)
        })
        .catch((error) => {
          console.log('[PWA] Service Worker 등록 실패:', error)
        })
    }
  }, [])

  return null
}
