/**
 * sw.js — Sanchay+ Service Worker.
 *
 * Provides offline app-shell caching (HTML, CSS, JS, fonts, icons) using
 * a Stale-While-Revalidate strategy for static assets, while letting API
 * requests pass through to the client-side IndexedDB sync engine.
 */

const CACHE_NAME = 'sanchay-plus-shell-v1';

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/pages/dashboard.html',
  '/pages/goals.html',
  '/pages/goal-details.html',
  '/pages/add-saving.html',
  '/pages/create-goal.html',
  '/pages/assistant.html',
  '/pages/calendar.html',
  '/pages/features.html',
  '/pages/notifications.html',
  '/pages/settings.html',
  '/pages/onboarding.html',
  '/css/output.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/calendar.js',
  '/js/connectivity.js',
  '/js/dashboard.js',
  '/js/db.js',
  '/js/deposits.js',
  '/js/drawer.js',
  '/js/goal-details.js',
  '/js/goals.js',
  '/js/i18n.js',
  '/js/mock-data.js',
  '/js/notifications.js',
  '/js/offline.js',
  '/js/router.js',
  '/js/settings.js',
  '/js/sync.js',
  '/js/ui-states.js',
  '/js/voice.js',
  '/js/assistant.js',
];

// ── Install: Pre-cache App Shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching Sanchay+ app shell…');
      // Add each item with tolerance for individual missing files
      for (const url of APP_SHELL_URLS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] Could not pre-cache:', url, err.message);
        }
      }
    })
  );
  self.skipWaiting();
});

// ── Activate: Clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch: Stale-While-Revalidate for App Shell ────────────────────────────────
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Bypass API calls and non-GET requests entirely
  if (request.method !== 'GET' || url.pathname.startsWith('/api') || url.port === '3000') {
    return;
  }

  // 2. Navigation requests: Network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Fallback to dashboard if navigating offline
          const fallback = await caches.match('/pages/dashboard.html');
          return fallback || new Response('Offline — Please reconnect', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  // 3. Static Assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch((err) => {
          // Network failed, nothing extra to do if cached response is returned
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
