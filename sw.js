const CACHE_NAME = 'fusion-blocks-v14';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './public/icons/icon.svg',
  './public/icons/icon-192.png',
  './public/icons/icon-512.png',
  './src/main.js',
  './src/components/input.js',
  './src/components/renderer.js',
  './src/systems/audio.js',
  './src/systems/constants.js',
  './src/systems/game.js',
  './src/systems/pwa.js',
  './src/systems/shapes.js',
  './src/systems/storage.js',
  './src/utils/viewport.js',
  './src/components/effects.js',
  './src/styles/animations.css',
  './src/styles/base.css',
  './src/styles/game.css',
  './src/styles/themes.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function shouldUseAppFallback(request) {
  const acceptHeader = request.headers.get('accept') || '';
  return request.mode === 'navigate' || acceptHeader.includes('text/html');
}

function fetchAndRefreshCache(request) {
  return fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.ok) {
      const copy = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }

    return networkResponse;
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetchAndRefreshCache(event.request)
      .catch(() => caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          if (shouldUseAppFallback(event.request)) {
            return caches.match('./index.html');
          }

          return Response.error();
        }))
  );
});
