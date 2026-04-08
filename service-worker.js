const CACHE_NAME = 'jacobcreation-dynamic-cache';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/offline.html',
    '/404.html',
    '/404-mascot.png',
    '/favicon.png',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&display=swap'
];

// Install Event: Cache essential assets initially
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Force the waiting service worker to become active
});

// Activate Event: Clean up old caches if necessary
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Fetch Event: Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Update the cache with the new version from network
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    if (networkResponse && networkResponse.status === 404) {
                        return cache.match('/404.html');
                    }
                    return networkResponse;
                }).catch(() => {
                    // Fallback to offline page if both cache and network fail
                    if (event.request.mode === 'navigate') {
                        return cache.match('/offline.html');
                    }
                });

                // Return the cached response immediately if it exists, otherwise wait for network
                return cachedResponse || fetchPromise;
            });
        })
    );
});