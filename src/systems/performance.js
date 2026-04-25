(function attachPerformanceTools(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const { PERFORMANCE_CONFIG } = namespace.Constants;

  function getCoreCount() {
    return Number(global.navigator && global.navigator.hardwareConcurrency) || 8;
  }

  function isSmallViewport() {
    return Boolean(global.matchMedia && global.matchMedia('(max-width: 740px)').matches);
  }

  function isLowPowerDevice() {
    return getCoreCount() <= PERFORMANCE_CONFIG.lowPowerCoreCount || isSmallViewport();
  }

  function getEffectBudget() {
    const lowPower = isLowPowerDevice();
    return {
      maxLineClearCells: lowPower ? 20 : PERFORMANCE_CONFIG.maxLineClearCells,
      maxFusionSourceCells: lowPower ? 6 : PERFORMANCE_CONFIG.maxFusionSourceCells,
      maxFusionParticles: lowPower ? 12 : PERFORMANCE_CONFIG.maxFusionParticles,
      maxComboParticles: lowPower
        ? PERFORMANCE_CONFIG.maxComboParticlesLowPower
        : PERFORMANCE_CONFIG.maxComboParticles
    };
  }

  class PerformanceMonitor {
    constructor({ enabled = false } = {}) {
      this.enabled = false;
      this.isTicking = false;
      this.mode = 'idle';
      this.frames = [];
      this.lastTime = 0;
      this.lastRenderTime = 0;
      this.fps = 0;
      this.slowFrames = 0;
      this.previewUpdates = 0;
      this.turns = 0;
      this.overlay = null;

      this.setEnabled(enabled);
    }

    createOverlay() {
      const overlay = document.createElement('div');
      overlay.className = 'perf-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
      return overlay;
    }

    tick(time) {
      if (!this.enabled) {
        this.isTicking = false;
        return;
      }

      if (this.lastTime > 0) {
        const delta = time - this.lastTime;
        this.frames.push(delta);
        if (this.frames.length > PERFORMANCE_CONFIG.fpsSampleSize) {
          this.frames.shift();
        }
        if (delta > PERFORMANCE_CONFIG.slowFrameMs) {
          this.slowFrames += 1;
        }

        const total = this.frames.reduce((sum, frame) => sum + frame, 0);
        this.fps = this.frames.length > 0 ? Math.round(1000 / (total / this.frames.length)) : 0;
      }

      this.lastTime = time;

      if (time - this.lastRenderTime > 250) {
        this.lastRenderTime = time;
        this.render();
      }

      global.requestAnimationFrame((nextTime) => this.tick(nextTime));
    }

    setEnabled(enabled) {
      const nextEnabled = Boolean(enabled);
      if (nextEnabled === this.enabled) {
        return;
      }

      this.enabled = nextEnabled;

      if (!this.enabled) {
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
        return;
      }

      this.frames = [];
      this.lastTime = 0;
      this.lastRenderTime = 0;
      this.fps = 0;
      this.slowFrames = 0;
      this.overlay = this.overlay || this.createOverlay();
      this.render();

      if (!this.isTicking) {
        this.isTicking = true;
        global.requestAnimationFrame((time) => this.tick(time));
      }
    }

    render() {
      if (!this.overlay) {
        return;
      }

      this.overlay.textContent = [
        `FPS ${this.fps}`,
        this.mode,
        `slow ${this.slowFrames}`,
        `preview ${this.previewUpdates}`,
        `turn ${this.turns}`
      ].join(' | ');
    }

    setMode(mode) {
      this.mode = mode;
      this.render();
    }

    markPreviewUpdate() {
      this.previewUpdates += 1;
    }

    markTurn() {
      this.turns += 1;
    }
  }

  namespace.Performance = {
    getEffectBudget,
    isLowPowerDevice
  };
  namespace.PerformanceMonitor = PerformanceMonitor;
})(window);
