const CACHE_NAME = 'fusion-blocks-v12';

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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
