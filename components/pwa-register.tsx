'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker 등록 성공:', registration.scope)
          
          // 새 버전 체크 (페이지 로드할 때마다)
          registration.update()
          
          // 새 서비스 워커가 대기 중이면 즉시 활성화
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // 새 버전 발견! 즉시 활성화하고 새로고침
                  console.log('[PWA] 새 버전 발견, 업데이트 중...')
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                  window.location.reload()
                }
              })
            }
          })
        })
        .catch((error) => {
          console.log('[PWA] Service Worker 등록 실패:', error)
        })
      
      // 서비스 워커가 교체되면 새로고침
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] 컨트롤러 변경됨, 새로고침...')
        window.location.reload()
      })
    }
  }, [])

  return null
}
