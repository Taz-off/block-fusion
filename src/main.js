(function startFusionBlocks(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const settings = namespace.Storage.loadSettings();
  const bestScore = namespace.Storage.loadBestScore();
  const engine = new namespace.GameEngine({ bestScore });
  const audio = new namespace.SoundBoard(settings);
  const renderer = new namespace.Renderer({ engine, settings });

  new namespace.InputController({
    engine,
    renderer,
    audio,
    settings,
    storage: namespace.Storage
  });
})(window);
