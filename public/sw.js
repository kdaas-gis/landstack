// LandStack Service Worker
// Caching strategies:
//   - App shell (HTML/CSS/JS): cache-first for instant offline loads
//   - Map tiles (WMS/Google/OSM): stale-while-revalidate for offline map browsing

const CACHE_NAME = 'landstack-v1';
const TILE_CACHE_NAME = 'landstack-tiles-v1';
const MAX_TILE_CACHE_ITEMS = 2000;

// App shell files to pre-cache on install
const APP_SHELL = [
    '/landstack/',
    '/landstack/icons/icon-192.png',
    '/landstack/icons/icon-512.png',
];

// --- Install: pre-cache the app shell ---
globalThis.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        })
    );
    // Activate immediately without waiting for old tabs to close
    globalThis.skipWaiting();
});

// --- Activate: clean up old caches ---
globalThis.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME && key !== TILE_CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    // Take control of all open tabs immediately
    globalThis.clients.claim();
});

// --- Helpers ---
function isMapTileRequest(url) {
    const tilePatterns = [
        'tile.openstreetmap.org',
        'mt0.google.com',
        'mt1.google.com',
        'mt2.google.com',
        'mt3.google.com',
        'khms0.google.com',
        'khms1.google.com',
        'khms2.google.com',
        'khms3.google.com',
        '/geoserver/',
        '/wms',
    ];
    return tilePatterns.some((pattern) => url.includes(pattern));
}

function isAppShellRequest(url, request) {
    // Navigation requests (HTML pages) or static assets under our basepath
    if (request.mode === 'navigate') return true;
    const appPatterns = ['/landstack/_next/', '/landstack/icons/'];
    return appPatterns.some((pattern) => url.includes(pattern));
}

async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
        // Delete oldest entries (FIFO)
        const toDelete = keys.slice(0, keys.length - maxItems);
        await Promise.all(toDelete.map((key) => cache.delete(key)));
    }
}

// --- Fetch: route requests through caching strategies ---
globalThis.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = request.url;

    // Only handle GET requests
    if (request.method !== 'GET') return;

    // Strategy 1: Map tiles — stale-while-revalidate
    if (isMapTileRequest(url)) {
        event.respondWith(
            caches.open(TILE_CACHE_NAME).then(async (cache) => {
                const cached = await cache.match(request);
                const fetchPromise = fetch(request)
                    .then((response) => {
                        if (response.ok) {
                            cache.put(request, response.clone());
                            // Trim tile cache in background
                            trimCache(TILE_CACHE_NAME, MAX_TILE_CACHE_ITEMS);
                        }
                        return response;
                    })
                    .catch(() => cached); // If network fails, fall back to cache

                return cached || fetchPromise;
            })
        );
        return;
    }

    // Strategy 2: App shell — cache-first, fallback to network
    if (isAppShellRequest(url, request)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Everything else: network-only (API calls, WFS queries, etc.)
    // No explicit handling — browser default fetch behavior applies.
});
