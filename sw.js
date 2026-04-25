const CACHE_NAME = 'fusion-blocks-v15';
const ASSET_VERSION = 'v=1.1';

function versioned(path) {
  return `${path}?${ASSET_VERSION}`;
}

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './public/icons/icon.svg',
  './public/icons/icon-192.png',
  './public/icons/icon-512.png',
  versioned('./src/main.js'),
  versioned('./src/components/input.js'),
  versioned('./src/components/renderer.js'),
  versioned('./src/systems/audio.js'),
  versioned('./src/systems/constants.js'),
  versioned('./src/systems/game.js'),
  versioned('./src/systems/pwa.js'),
  versioned('./src/systems/shapes.js'),
  versioned('./src/systems/storage.js'),
  versioned('./src/utils/viewport.js'),
  versioned('./src/components/effects.js'),
  versioned('./src/styles/animations.css'),
  versioned('./src/styles/base.css'),
  versioned('./src/styles/game.css'),
  versioned('./src/styles/themes.css')
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
