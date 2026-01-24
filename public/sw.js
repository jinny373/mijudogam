const CACHE_NAME = 'mijudogam-v1';
const OFFLINE_URL = '/offline.html';

// 캐시할 정적 파일들
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
];

// 설치 시 정적 파일 캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 캐시 설치 중...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 활성화 시 이전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 네트워크 요청 처리
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청은 네트워크 우선
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 성공하면 캐시에 저장
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // 실패하면 캐시에서 가져오기
          return caches.match(request);
        })
    );
    return;
  }

  // 정적 파일은 캐시 우선
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then((response) => {
          // HTML, CSS, JS는 캐시
          if (
            response.status === 200 &&
            (request.destination === 'document' ||
              request.destination === 'script' ||
              request.destination === 'style')
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 오프라인이면 오프라인 페이지
          if (request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});
