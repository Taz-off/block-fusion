(function registerFusionBlocksPwa(global) {
  'use strict';

  const SERVICE_WORKER_URL = './sw.js?v=1.2.41';

  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (global.location.protocol === 'file:') {
    return;
  }

  let hasRefreshedForUpdate = false;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasRefreshedForUpdate) {
        return;
      }

      hasRefreshedForUpdate = true;
      global.location.reload();
    });
  }

  global.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SERVICE_WORKER_URL)
      .then((registration) => registration.update())
      .catch(() => {
        // The game remains fully playable if the browser refuses service workers.
      });
  });
})(window);
