// 배포할 때마다 이 버전을 올려주세요! (또는 날짜로)
const CACHE_VERSION = 'v2-' + '20260206f';
const CACHE_NAME = 'mijudogam-' + CACHE_VERSION;
const OFFLINE_URL = '/offline.html';

// 캐시할 정적 파일들 (최소한만)
const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.json',
];

// 설치 시 정적 파일 캐시
self.addEventListener('install', (event) => {
  console.log('[SW] 새 버전 설치 중...', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // 즉시 활성화 (대기 안 함)
  self.skipWaiting();
});

// 활성화 시 이전 캐시 모두 삭제
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화, 이전 캐시 삭제 중...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('mijudogam-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] 삭제:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // 즉시 클라이언트 제어
  self.clients.claim();
});

// SKIP_WAITING 메시지 수신
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 네트워크 요청 처리 - 네트워크 우선 전략
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청은 항상 네트워크 (캐시 안 함)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML 페이지는 네트워크 우선
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => {
          // 오프라인이면 오프라인 페이지
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // 나머지는 네트워크 우선, 실패 시 캐시
  event.respondWith(
    fetch(request)
      .then((response) => {
        // 성공하면 캐시 업데이트
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
