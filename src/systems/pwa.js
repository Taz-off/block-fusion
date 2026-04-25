(function registerFusionBlocksPwa(global) {
  'use strict';

  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (global.location.protocol === 'file:') {
    return;
  }

  global.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // The game remains fully playable if the browser refuses service workers.
    });
  });
})(window);
