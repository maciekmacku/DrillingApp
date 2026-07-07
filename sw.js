// Drilling App – Service Worker v1.1
const CACHE_NAME = 'drilling-app-v2';
const STATIC_CACHE = 'drilling-static-v2';
const FONT_CACHE = 'drilling-fonts-v2';

// Files to cache for offline use
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json'
];

const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap'
];

// ── INSTALL ──────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing Drilling App Service Worker...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      }),
      caches.open(FONT_CACHE).then(cache => {
        console.log('[SW] Caching fonts');
        return cache.addAll(FONT_URLS).catch(err => {
          console.warn('[SW] Font cache failed (offline install?):', err);
        });
      })
    ]).then(() => {
      console.log('[SW] Install complete');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE ─────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== FONT_CACHE && key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      console.log('[SW] Activated, claiming clients');
      return self.clients.claim();
    })
  );
});

// ── FETCH ─────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts – cache first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // App shell – cache first, then network
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname === '') {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const networkFetch = fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => {
            // Offline – return cached version
            return cached || caches.match('./index.html');
          });
          // Return cached immediately, update in background
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Everything else – network first, cache fallback
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(event.request).then(cached =>
        cached || caches.match('./index.html')
      )
    )
  );
});

// ── BACKGROUND SYNC (optional) ───────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-calculations') {
    console.log('[SW] Background sync: calculations');
  }
});

// ── PUSH NOTIFICATIONS (optional) ───────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Drilling App', body: 'Aktualizacja dostępna' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      vibrate: [100, 50, 100]
    })
  );
});
