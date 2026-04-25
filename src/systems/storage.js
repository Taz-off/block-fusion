(function attachStorage(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const { DEFAULT_SETTINGS, STORAGE_KEYS } = namespace.Constants;

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

      const savedSettings = JSON.parse(rawSettings);
      return {
        ...DEFAULT_SETTINGS,
        ...savedSettings,
        volume: Number.isFinite(Number(savedSettings.volume))
          ? Number(savedSettings.volume)
          : DEFAULT_SETTINGS.volume
      };
    } catch (error) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      global.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch (error) {
      // Non-blocking: preferences simply reset next session if storage fails.
    }
  }

  namespace.Storage = {
    loadBestScore,
    saveBestScore,
    loadSettings,
    saveSettings
  };
})(window);
