// JacobCreation Service Worker

const CACHE_NAME = 'jacobcreation-cache-v8';
const OFFLINE_URL = './offline.html';

// Install event — cache offline page
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching offline page');
                return cache.addAll([
                    OFFLINE_URL
                ]);
            })
    );
    self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Fetch event — serve from cache first
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Return cached file
                    return cachedResponse;
                }

                // Fetch from network and cache it
                return fetch(event.request)
                    .then(networkResponse => {
                        // Don't cache if not a valid normal response, or if it's a redirect
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque' || networkResponse.redirected) {
                            return networkResponse;
                        }

                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            // Cache the new file
                            cache.put(event.request, responseToCache);
                        });

                        return networkResponse;
                    })
                    .catch(() => {
                        // If offline and request fails, show offline page for HTML pages
                        if (event.request.destination === 'document') {
                            return caches.match(OFFLINE_URL);
                        }
                    });
            })
    );
});
