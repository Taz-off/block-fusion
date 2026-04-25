(function attachConstants(global) {
  'use strict';

  const namespace = global.FusionBlocks || {};

  const GRID_SIZE = 8;

  const BLOCK_VALUES = [
    2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048,
    4096, 8192, 16384
  ];

  const DEFAULT_SETTINGS = {
    animations: true,
    animationLevel: 'full',
    particles: true,
    vibrations: true,
    comboEffects: true,
    milestonePopups: true,
    theme: 'dark',
    volume: 0.45,
    debugMode: false
  };

  const STORAGE_KEYS = {
    bestScore: 'fusionBlocks.bestScore',
    settings: 'fusionBlocks.settings'
  };

  const EFFECT_CONFIG = {
    fusionDuration: 620,
    fusionParticleBase: 8,
    fusionParticlePerCell: 4,
    placementDuration: 360,
    placementParticles: 8,
    comboDuration: 880,
    majorPopupDuration: 1160,
    comboParticleBase: 22,
    comboParticlePerLevel: 8,
    comboShakeLevel: 4,
    maxActiveEffectNodes: 90,
    colors: ['#ffe45c', '#ff4fd8', '#42f5e9', '#8f5cff', '#49f56f', '#ff8f3d']
  };

  const PERFORMANCE_CONFIG = {
    maxLineClearCells: 28,
    maxFusionSourceCells: 8,
    maxFusionParticles: 18,
    maxComboParticles: 42,
    maxComboParticlesLowPower: 28,
    lowPowerCoreCount: 4,
    slowFrameMs: 24,
    fpsSampleSize: 45
  };

  namespace.Constants = {
    GRID_SIZE,
    BLOCK_VALUES,
    DEFAULT_SETTINGS,
    STORAGE_KEYS,
    EFFECT_CONFIG,
    PERFORMANCE_CONFIG
  };

  global.FusionBlocks = namespace;
})(window);
