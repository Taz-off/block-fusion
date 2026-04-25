(function attachFusionEffects(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const { GRID_SIZE, EFFECT_CONFIG } = namespace.Constants;
  const numberFormatter = new Intl.NumberFormat('fr-FR');

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickColor(index = 0) {
    const colors = EFFECT_CONFIG.colors;
    return colors[index % colors.length];
  }

  function cellCenter(cell) {
    return {
      x: ((cell.col + 0.5) / GRID_SIZE) * 100,
      y: ((cell.row + 0.5) / GRID_SIZE) * 100
    };
  }

  function formatNumber(value) {
    return numberFormatter.format(Math.floor(value));
  }

  class FusionEffects {
    constructor({ boardShell, boardEffects, comboBanner, settings }) {
      this.boardShell = boardShell;
      this.boardEffects = boardEffects;
      this.comboBanner = comboBanner;
      this.settings = settings;
      this.nodes = new Set();
      this.timers = new Set();
    }

    updateSettings(settings) {
      this.settings = settings;
    }

    clear() {
      this.timers.forEach((timer) => global.clearTimeout(timer));
      this.timers.clear();
      this.nodes.forEach((node) => node.remove());
      this.nodes.clear();
      this.comboBanner.className = 'combo-banner';
      this.comboBanner.replaceChildren();
      this.boardShell.classList.remove('combo-impact', 'combo-shake', 'combo-mega');
    }

    playMerges(merges) {
      if (!this.shouldAnimate() || merges.length === 0) {
        return;
      }

      merges.forEach((merge, index) => {
        const delay = Math.min(merge.wave - 1, 6) * 95 + index * 24;
        this.schedule(() => this.spawnFusionBurst(merge, index), delay);
      });

      if (merges.length > 1) {
        this.schedule(() => this.spawnBoardWave('fusion-sequence-wave'), 70);
      }
    }

    playLineClear(cells) {
      if (!this.shouldAnimate() || !this.shouldUseParticles() || cells.length === 0) {
        return;
      }

      cells.slice(0, 40).forEach((cell, cellIndex) => {
        const center = cellCenter(cell);
        for (let index = 0; index < 4; index += 1) {
          const color = pickColor(cellIndex + index);
          const angle = Math.random() * Math.PI * 2;
          const distance = randomBetween(18, 56);
          this.spawnParticle('line-clear-particle', center, {
            color,
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            size: randomBetween(5, 8),
            delay: randomBetween(0, 0.08),
            square: index % 3 === 0
          });
        }
      });
    }

    playCombo(combo, merges = []) {
      if (!this.shouldAnimate() || !combo) {
        return;
      }

      const tier = this.getComboTier(combo.level);
      const label = this.getComboLabel(combo.level);

      this.comboBanner.className = 'combo-banner';
      this.comboBanner.replaceChildren();
      const mainText = document.createElement('strong');
      const bonusText = document.createElement('span');
      mainText.textContent = label;
      bonusText.textContent = `+${formatNumber(combo.bonus)}`;
      this.comboBanner.append(mainText, bonusText);

      void this.comboBanner.offsetWidth;
      this.comboBanner.classList.add('show', `combo-tier-${tier}`);

      this.boardShell.classList.add(combo.level >= EFFECT_CONFIG.comboShakeLevel ? 'combo-shake' : 'combo-impact');
      if (combo.level >= 4) {
        this.boardShell.classList.add('combo-mega');
      }

      this.spawnBoardWave(combo.level >= 3 ? 'combo-screen-wave strong' : 'combo-screen-wave');

      if (this.shouldUseParticles()) {
        this.spawnComboParticles(combo.level, merges);
      }

      this.schedule(() => {
        this.comboBanner.className = 'combo-banner';
        this.comboBanner.replaceChildren();
        this.boardShell.classList.remove('combo-impact', 'combo-shake', 'combo-mega');
      }, EFFECT_CONFIG.comboDuration);
    }

    spawnFusionBurst(merge, mergeIndex) {
      const targetCenter = cellCenter(merge.to);
      const color = pickColor(mergeIndex + merge.wave);
      const sourceCells = merge.from.length > 0 ? merge.from : [merge.to];

      sourceCells.slice(0, 12).forEach((cell, index) => {
        this.spawnCellGlow(cell, pickColor(index + mergeIndex));
      });

      this.spawnPointEffect('fusion-flash', targetCenter, color);
      this.spawnPointEffect('fusion-wave', targetCenter, color);

      if (!this.shouldUseParticles()) {
        return;
      }

      const particleCount = Math.min(
        30,
        EFFECT_CONFIG.fusionParticleBase + sourceCells.length * EFFECT_CONFIG.fusionParticlePerCell
      );

      for (let index = 0; index < particleCount; index += 1) {
        const angle = (Math.PI * 2 * index) / particleCount + randomBetween(-0.28, 0.28);
        const distance = randomBetween(22, sourceCells.length > 3 ? 78 : 56);
        this.spawnParticle('fusion-particle', targetCenter, {
          color: pickColor(index + mergeIndex),
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: randomBetween(5, 10),
          delay: randomBetween(0, 0.05),
          square: index % 5 === 0
        });
      }
    }

    spawnCellGlow(cell, color) {
      const center = cellCenter(cell);
      const glow = document.createElement('div');
      glow.className = 'fusion-cell-glow';
      glow.style.left = `${center.x}%`;
      glow.style.top = `${center.y}%`;
      glow.style.setProperty('--effect-color', color);
      this.appendEffect(glow, EFFECT_CONFIG.fusionDuration);
    }

    spawnPointEffect(className, center, color) {
      const effect = document.createElement('div');
      effect.className = className;
      effect.style.left = `${center.x}%`;
      effect.style.top = `${center.y}%`;
      effect.style.setProperty('--effect-color', color);
      this.appendEffect(effect, EFFECT_CONFIG.fusionDuration);
    }

    spawnBoardWave(className) {
      const wave = document.createElement('div');
      wave.className = className;
      this.appendEffect(wave, EFFECT_CONFIG.comboDuration);
    }

    spawnComboParticles(level, merges) {
      const count = Math.min(
        74,
        EFFECT_CONFIG.comboParticleBase + level * EFFECT_CONFIG.comboParticlePerLevel
      );
      const anchors = merges.map((merge) => cellCenter(merge.to));

      for (let index = 0; index < count; index += 1) {
        const anchor = anchors.length > 0
          ? anchors[index % anchors.length]
          : { x: randomBetween(25, 75), y: randomBetween(18, 72) };
        const start = {
          x: Math.min(92, Math.max(8, anchor.x + randomBetween(-16, 16))),
          y: Math.min(92, Math.max(8, anchor.y + randomBetween(-16, 16)))
        };
        const angle = Math.random() * Math.PI * 2;
        const distance = randomBetween(58, level >= 4 ? 160 : 112);

        this.spawnParticle('combo-burst-particle', start, {
          color: pickColor(index + level),
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: randomBetween(6, level >= 4 ? 12 : 9),
          delay: randomBetween(0, 0.12),
          square: index % 4 === 0
        });
      }
    }

    spawnParticle(className, center, options) {
      const particle = document.createElement('div');
      particle.className = options.square ? `${className} effect-particle is-square` : `${className} effect-particle`;
      particle.style.left = `${center.x}%`;
      particle.style.top = `${center.y}%`;
      particle.style.setProperty('--particle-x', `${options.x}px`);
      particle.style.setProperty('--particle-y', `${options.y}px`);
      particle.style.setProperty('--particle-color', options.color);
      particle.style.setProperty('--particle-size', `${options.size}px`);
      particle.style.setProperty('--particle-delay', `${options.delay}s`);
      this.appendEffect(particle, EFFECT_CONFIG.comboDuration);
    }

    appendEffect(node, duration) {
      this.boardEffects.appendChild(node);
      this.nodes.add(node);
      this.schedule(() => {
        node.remove();
        this.nodes.delete(node);
      }, duration);
    }

    schedule(callback, delay) {
      const timer = global.setTimeout(() => {
        this.timers.delete(timer);
        callback();
      }, delay);
      this.timers.add(timer);
    }

    getComboTier(level) {
      if (level >= 5) {
        return 'insane';
      }
      if (level >= 4) {
        return 'mega';
      }
      if (level >= 3) {
        return 'strong';
      }
      return 'light';
    }

    getComboLabel(level) {
      if (level >= 5) {
        return 'INSANE';
      }
      if (level >= 4) {
        return 'MEGA COMBO';
      }
      return `COMBO x${level}`;
    }

    shouldAnimate() {
      return Boolean(this.settings.animations);
    }

    shouldUseParticles() {
      return Boolean(this.settings.particles);
    }
  }

  namespace.FusionEffects = FusionEffects;
})(window);
