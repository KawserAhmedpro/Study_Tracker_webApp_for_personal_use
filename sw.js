/**
 * StudyTracker — Service Worker (Cache-First / Offline Shell)
 * Provides 100% offline functionality and zero-dependency local asset caching.
 */

const CACHE_NAME = 'studytracker-v1';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/lib/chart.umd.min.js',
  './css/main.css',
  './css/dashboard.css',
  './css/timer.css',
  './css/history.css',
  './css/statistics.css',
  './css/settings.css',
  './js/app.js',
  './js/db/database.js',
  './js/db/schema.js',
  './js/db/migrations.js',
  './js/services/studyService.js',
  './js/services/subjectService.js',
  './js/services/statisticsService.js',
  './js/services/timerService.js',
  './js/services/backupService.js',
  './js/components/icons.js',
  './js/components/toast.js',
  './js/components/modal.js',
  './js/components/subjectModal.js',
  './js/components/sessionModal.js',
  './js/components/importModal.js',
  './js/pages/dashboard.js',
  './js/pages/timer.js',
  './js/pages/history.js',
  './js/pages/statistics.js',
  './js/pages/settings.js',
  './js/utils/dateUtils.js',
  './js/utils/timeUtils.js',
  './js/utils/formatUtils.js',
  './js/utils/idUtils.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        PRECACHE_ASSETS.map(async (assetUrl) => {
          try {
            const response = await fetch(assetUrl, { cache: 'no-cache' });
            if (response.ok) {
              await cache.put(assetUrl, response);
            }
          } catch (err) {
            console.warn('StudyTracker: Warning precaching', assetUrl, err);
          }
        })
      );
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip browser extension schemes or foreign requests
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Cache hit: Return cached response immediately while revalidating in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Quietly ignore background network error when offline
          });

        return cachedResponse;
      }

      // Cache miss: Fetch from network and cache for subsequent offline loads
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // If navigation request fails offline, fallback to cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
