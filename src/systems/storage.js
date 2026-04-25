(function attachStorage(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const { DEFAULT_SETTINGS, STORAGE_KEYS } = namespace.Constants;
  const ANIMATION_LEVELS = new Set(['full', 'reduced', 'off']);

  function normalizeSettings(settings = {}) {
    const savedSettings = { ...settings };
    if (savedSettings.blockTexture === 'block-blast') {
      savedSettings.theme = 'block-blast';
    }
    delete savedSettings.blockTexture;

    const normalized = {
      ...DEFAULT_SETTINGS,
      ...savedSettings
    };

    if (!ANIMATION_LEVELS.has(savedSettings.animationLevel)) {
      normalized.animationLevel = savedSettings.animations === false ? 'off' : DEFAULT_SETTINGS.animationLevel;
    }

    normalized.animations = normalized.animationLevel !== 'off';
    normalized.particles = Boolean(normalized.particles);
    normalized.vibrations = Boolean(normalized.vibrations);
    normalized.comboEffects = Boolean(normalized.comboEffects);
    normalized.milestonePopups = Boolean(normalized.milestonePopups);
    normalized.debugMode = Boolean(normalized.debugMode);
    normalized.volume = Number.isFinite(Number(normalized.volume))
      ? Number(normalized.volume)
      : DEFAULT_SETTINGS.volume;

    return normalized;
  }

  function loadBestScore() {
    try {
      const rawScore = global.localStorage.getItem(STORAGE_KEYS.bestScore);
      const parsedScore = Number.parseInt(rawScore, 10);
      return Number.isFinite(parsedScore) ? parsedScore : 0;
    } catch (error) {
      return 0;
    }
  }

  function saveBestScore(score) {
    try {
      global.localStorage.setItem(STORAGE_KEYS.bestScore, String(Math.max(0, Math.floor(score))));
    } catch (error) {
      // Storage can be unavailable in private contexts. The game still works without persistence.
    }
  }

  function loadSettings() {
    try {
      const rawSettings = global.localStorage.getItem(STORAGE_KEYS.settings);
      if (!rawSettings) {
        return { ...DEFAULT_SETTINGS };
      }

      return normalizeSettings(JSON.parse(rawSettings));
    } catch (error) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      global.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(normalizeSettings(settings)));
    } catch (error) {
      // Non-blocking: preferences simply reset next session if storage fails.
    }
  }

  namespace.Storage = {
    loadBestScore,
    saveBestScore,
    loadSettings,
    saveSettings,
    normalizeSettings
  };
})(window);
