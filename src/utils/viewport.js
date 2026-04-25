(function lockMobileViewport(global) {
  'use strict';

  function setAppHeight() {
    const height = global.visualViewport ? global.visualViewport.height : global.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
  }

  function canUseNativeTouch(target) {
    return Boolean(target.closest('input, select, textarea, button'));
  }

  function preventPageMove(event) {
    if (canUseNativeTouch(event.target)) {
      return;
    }
    event.preventDefault();
  }

  setAppHeight();
  global.addEventListener('resize', setAppHeight);
  global.addEventListener('orientationchange', setAppHeight);

  if (global.visualViewport) {
    global.visualViewport.addEventListener('resize', setAppHeight);
  }

  document.addEventListener('touchmove', preventPageMove, { passive: false });
  document.addEventListener('gesturestart', (event) => event.preventDefault());
})(window);
