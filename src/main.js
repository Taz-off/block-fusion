(function startFusionBlocks(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const settings = namespace.Storage.loadSettings();
  const bestScore = namespace.Storage.loadBestScore();
  const performance = namespace.PerformanceMonitor
    ? new namespace.PerformanceMonitor({ enabled: settings.debugMode })
    : null;
  const engine = new namespace.GameEngine({ bestScore });
  const audio = new namespace.SoundBoard(settings);
  const renderer = new namespace.Renderer({ engine, settings, performance });

  new namespace.InputController({
    engine,
    renderer,
    audio,
    settings,
    storage: namespace.Storage,
    performance
  });
})(window);
