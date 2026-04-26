(function lockMobileViewport(global) {
  'use strict';

  function setAppHeight() {
    const height = global.visualViewport ? global.visualViewport.height : global.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
  }

  function canUseNativeTouch(target) {
    return Boolean(
      target.closest('input, select, textarea, button') ||
      getScrollableAncestor(target)
    );
  }

  function getScrollableAncestor(target) {
    let element = target;

    while (element && element !== document.body) {
      const style = global.getComputedStyle(element);
      const canScrollY = /(auto|scroll)/.test(style.overflowY);

      if (canScrollY && element.scrollHeight > element.clientHeight) {
        return element;
      }

      element = element.parentElement;
    }

    return null;
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
