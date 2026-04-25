(function attachEffectManager(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const { GRID_SIZE, EFFECT_CONFIG, PERFORMANCE_CONFIG } = namespace.Constants;
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

  function maxMergeValue(merges = []) {
    return merges.reduce((maxValue, merge) => Math.max(maxValue, merge.value || 0), 0);
  }

  class EffectManager {
    constructor({ boardShell, boardEffects, comboBanner, milestoneToast, screen, settings }) {
      this.boardShell = boardShell;
      this.boardEffects = boardEffects;
      this.comboBanner = comboBanner;
      this.milestoneToast = milestoneToast;
      this.screen = screen || document.getElementById('game-screen') || document.body;
      this.settings = settings;
      this.nodes = new Set();
      this.timers = new Set();
      this.lastHapticAt = 0;
      this.screenLayer = this.ensureScreenLayer();
    }

    ensureScreenLayer() {
      let layer = document.getElementById('screen-effects-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.id = 'screen-effects-layer';
        layer.className = 'screen-effects-layer';
        layer.setAttribute('aria-hidden', 'true');
        this.screen.appendChild(layer);
      }
      return layer;
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
      if (this.milestoneToast) {
        this.milestoneToast.className = 'milestone-toast';
        this.milestoneToast.replaceChildren();
      }
      this.boardShell.classList.remove(
        'combo-impact',
        'combo-shake',
        'combo-mega',
        'combo-insane',
        'major-merge-pulse'
      );
    }

    playDragStart() {
      this.haptic('drag');
    }

    playInvalid() {
      this.haptic('invalid', 'high');
    }

    playTurn(events) {
      if (!events) {
        return;
      }

      this.playPlacement(events.placed);
      this.playMerges(events.merges);
      this.playLineClear(events.clears && events.clears.cells ? events.clears.cells : []);
      this.playComboFromEvents(events);
      this.playNewMax(events);
    }

    playPlacement(cells = []) {
      if (cells.length === 0) {
        return;
      }

      this.haptic('place');
      if (!this.shouldAnimate({ minor: true }) || !this.shouldUseParticles({ minor: true })) {
        return;
      }

      const budget = this.getEffectBudget();
      const cellsToSpark = cells.slice(0, Math.min(cells.length, 4));
      cellsToSpark.forEach((cell, cellIndex) => {
        const center = cellCenter(cell);
        const particleCount = Math.max(2, Math.floor(budget.maxPlacementParticles / cellsToSpark.length));
        for (let index = 0; index < particleCount; index += 1) {
          const angle = randomBetween(-Math.PI, Math.PI);
          const distance = randomBetween(10, 28);
          this.spawnParticle('placement-spark', center, {
            color: pickColor(cellIndex + index),
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            size: randomBetween(3, 6),
            delay: randomBetween(0, 0.03),
            square: index % 2 === 0,
            duration: EFFECT_CONFIG.placementDuration
          });
        }
      });
    }

    playMerges(merges = []) {
      if (merges.length === 0) {
        return;
      }

      this.haptic('merge');
      if (!this.shouldAnimate({ important: true })) {
        return;
      }

      merges.slice(0, 14).forEach((merge, index) => {
        const delay = Math.min(merge.wave - 1, 6) * 82 + index * 18;
        this.schedule(() => this.spawnFusionBurst(merge, index), delay);
      });

      if (merges.length > 1) {
        this.schedule(() => this.spawnBoardWave('fusion-sequence-wave'), 70);
      }
    }

    playLineClear(cells = []) {
      if (!this.shouldAnimate({ important: true }) || !this.shouldUseParticles({ important: true }) || cells.length === 0) {
        return;
      }

      const budget = this.getEffectBudget();
      const particlesPerCell = this.isReduced() ? 1 : 3;
      cells.slice(0, budget.maxLineClearCells).forEach((cell, cellIndex) => {
        const center = cellCenter(cell);
        for (let index = 0; index < particlesPerCell; index += 1) {
          const color = pickColor(cellIndex + index);
          const angle = Math.random() * Math.PI * 2;
          const distance = randomBetween(18, this.isReduced() ? 38 : 56);
          this.spawnParticle('line-clear-particle', center, {
            color,
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            size: randomBetween(4, 8),
            delay: randomBetween(0, 0.06),
            square: index % 3 === 0,
            duration: 720
          });
        }
      });
    }

    playComboFromEvents(events) {
      const combo = this.buildCombo(events);
      if (!combo) {
        return;
      }

      if (combo.level >= 3) {
        this.haptic(combo.level >= 5 ? 'megaCombo' : 'combo', 'high');
      }

      if (this.settings.comboEffects === false || !this.shouldAnimate({ important: true })) {
        return;
      }

      const tier = this.getComboTier(combo.level);
      this.renderComboBanner(combo, tier);
      this.boardShell.classList.add(combo.level >= EFFECT_CONFIG.comboShakeLevel ? 'combo-shake' : 'combo-impact');
      if (combo.level >= 5) {
        this.boardShell.classList.add('combo-mega');
      }
      if (combo.level >= 10) {
        this.boardShell.classList.add('combo-insane');
      }

      if (combo.level >= 3) {
        this.spawnBoardWave(combo.level >= 5 ? 'combo-screen-wave strong' : 'combo-screen-wave');
      }

      if (this.shouldUseParticles({ important: combo.level >= 3 })) {
        this.spawnComboParticles(combo.level, events.merges || []);
      }

      this.schedule(() => {
        this.comboBanner.className = 'combo-banner';
        this.comboBanner.replaceChildren();
        this.boardShell.classList.remove('combo-impact', 'combo-shake', 'combo-mega', 'combo-insane');
      }, EFFECT_CONFIG.comboDuration + Math.min(combo.level, 8) * 45);
    }

    playNewMax(events) {
      const maxEvent = events.newMaxBlock || events.milestone;
      if (!maxEvent || !maxEvent.value) {
        return;
      }

      const value = maxEvent.value;
      this.haptic(value >= 2048 ? 'legendary' : 'newMax', 'high');

      if (!this.shouldAnimate({ important: true })) {
        return;
      }

      const isImportant = value >= 512 || Boolean(events.milestone);
      if (!isImportant) {
        this.spawnBoardWave('new-max-wave subtle');
        return;
      }

      this.boardShell.classList.add('major-merge-pulse');
      this.spawnBoardWave(value >= 2048 ? 'new-max-wave legendary' : 'new-max-wave');

      if (this.settings.milestonePopups !== false) {
        this.spawnMajorPopup(value);
      } else if (this.milestoneToast) {
        this.showMilestoneToast(value);
      }

      if (this.shouldUseParticles({ important: true })) {
        this.spawnMaxParticles(value);
      }

      this.schedule(() => {
        this.boardShell.classList.remove('major-merge-pulse');
      }, EFFECT_CONFIG.majorPopupDuration);
    }

    buildCombo(events) {
      const merges = events.merges || [];
      if (merges.length === 0 && !events.combo) {
        return null;
      }

      const highestWave = merges.reduce((maxWave, merge) => Math.max(maxWave, merge.wave || 1), 1);
      const level = events.combo
        ? events.combo.level
        : Math.max(1, highestWave, merges.length > 1 ? 2 : 1);
      const strongestMerge = Math.max(maxMergeValue(merges), events.newMaxBlock ? events.newMaxBlock.value : 0);
      const message = this.getComboMessage(level, strongestMerge, Boolean(events.newMaxBlock));

      return {
        level,
        bonus: events.combo ? events.combo.bonus : strongestMerge,
        strongestMerge,
        title: message.title,
        subtitle: message.subtitle
      };
    }

    getComboMessage(level, strongestMerge, hasNewMax) {
      if (level >= 10) {
        return { title: 'INSANE COMBO', subtitle: `Combo ${level}` };
      }
      if (level >= 6) {
        return { title: 'ULTRA COMBO', subtitle: `Combo ${level}` };
      }
      if (level >= 5) {
        return { title: 'MEGA COMBO', subtitle: `Combo ${level}` };
      }
      if (strongestMerge >= 4096) {
        return { title: 'LEGENDARY MERGE', subtitle: `Combo ${level}` };
      }
      if (hasNewMax && strongestMerge >= 512) {
        return { title: 'NEW MAX BLOCK', subtitle: `Combo ${level}` };
      }
      if (strongestMerge >= 1024) {
        return { title: 'HUGE MERGE', subtitle: `Combo ${level}` };
      }
      if (level >= 3) {
        return { title: 'CHAIN REACTION', subtitle: `Combo ${level}` };
      }
      if (level >= 2) {
        return { title: `COMBO ${level}`, subtitle: 'Nice chain' };
      }
      return { title: 'NICE MERGE', subtitle: 'Combo 1' };
    }

    renderComboBanner(combo, tier) {
      this.comboBanner.className = 'combo-banner';
      this.comboBanner.replaceChildren();

      const mainText = document.createElement('strong');
      const bonusText = document.createElement('span');
      mainText.textContent = combo.title;
      bonusText.textContent = combo.bonus > 0
        ? `${combo.subtitle}  +${formatNumber(combo.bonus)}`
        : combo.subtitle;
      this.comboBanner.append(mainText, bonusText);

      void this.comboBanner.offsetWidth;
      this.comboBanner.classList.add('show', `combo-tier-${tier}`);
    }

    spawnFusionBurst(merge, mergeIndex) {
      const targetCenter = cellCenter(merge.to);
      const color = pickColor(mergeIndex + merge.wave);
      const sourceCells = merge.from && merge.from.length > 0 ? merge.from : [merge.to];
      const budget = this.getEffectBudget();

      sourceCells.slice(0, budget.maxFusionSourceCells).forEach((cell, index) => {
        this.spawnCellGlow(cell, pickColor(index + mergeIndex));
      });

      this.spawnPointEffect('fusion-flash', targetCenter, color, EFFECT_CONFIG.fusionDuration);
      this.spawnPointEffect('fusion-wave', targetCenter, color, EFFECT_CONFIG.fusionDuration);
      this.spawnMergeValue(merge, targetCenter);

      if (!this.shouldUseParticles({ important: true })) {
        return;
      }

      const particleCount = Math.min(
        budget.maxFusionParticles,
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
          square: index % 5 === 0,
          duration: EFFECT_CONFIG.comboDuration
        });
      }
    }

    spawnMergeValue(merge, center) {
      const valuePop = document.createElement('div');
      valuePop.className = merge.value >= 1024 ? 'merge-value-pop is-huge' : 'merge-value-pop';
      valuePop.textContent = formatNumber(merge.value);
      valuePop.style.left = `${center.x}%`;
      valuePop.style.top = `${center.y}%`;
      valuePop.style.setProperty('--effect-color', pickColor(merge.wave));
      this.appendEffect(valuePop, 760, this.boardEffects);
    }

    spawnCellGlow(cell, color) {
      const center = cellCenter(cell);
      const glow = document.createElement('div');
      glow.className = 'fusion-cell-glow';
      glow.style.left = `${center.x}%`;
      glow.style.top = `${center.y}%`;
      glow.style.setProperty('--effect-color', color);
      this.appendEffect(glow, EFFECT_CONFIG.fusionDuration, this.boardEffects);
    }

    spawnPointEffect(className, center, color, duration) {
      const effect = document.createElement('div');
      effect.className = className;
      effect.style.left = `${center.x}%`;
      effect.style.top = `${center.y}%`;
      effect.style.setProperty('--effect-color', color);
      this.appendEffect(effect, duration, this.boardEffects);
    }

    spawnBoardWave(className) {
      const wave = document.createElement('div');
      wave.className = className;
      this.appendEffect(wave, EFFECT_CONFIG.comboDuration, this.boardEffects);
    }

    spawnMajorPopup(value) {
      const dim = document.createElement('div');
      dim.className = 'screen-dim-flash';
      this.appendEffect(dim, 540, this.screenLayer);

      const popup = document.createElement('div');
      const tier = value >= 4096 ? 'legendary' : value >= 2048 ? 'epic' : 'rare';
      popup.className = `major-block-popup ${tier}`;
      popup.innerHTML = [
        `<strong>${formatNumber(value)}!</strong>`,
        `<span>${value >= 4096 ? 'LEGENDARY' : 'NEW MAX BLOCK'}</span>`
      ].join('');
      this.appendEffect(popup, EFFECT_CONFIG.majorPopupDuration, this.screenLayer);
    }

    showMilestoneToast(value) {
      this.milestoneToast.textContent = `${formatNumber(value)} NEW MAX`;
      this.milestoneToast.classList.remove('show');
      void this.milestoneToast.offsetWidth;
      this.milestoneToast.classList.add('show');
    }

    spawnComboParticles(level, merges) {
      const budget = this.getEffectBudget();
      const count = Math.min(
        budget.maxComboParticles,
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
        const distance = randomBetween(58, level >= 5 ? 160 : 112);

        this.spawnParticle('combo-burst-particle', start, {
          color: pickColor(index + level),
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: randomBetween(6, level >= 5 ? 12 : 9),
          delay: randomBetween(0, 0.12),
          square: index % 4 === 0,
          duration: 860
        });
      }
    }

    spawnMaxParticles(value) {
      const count = this.isReduced() ? 14 : value >= 2048 ? 34 : 22;
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count;
        const distance = randomBetween(74, value >= 2048 ? 178 : 132);
        this.spawnScreenParticle({
          color: pickColor(index + value),
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: randomBetween(5, value >= 2048 ? 12 : 9),
          delay: randomBetween(0, 0.12),
          square: index % 2 === 0
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
      particle.style.setProperty('--particle-duration', `${options.duration || EFFECT_CONFIG.comboDuration}ms`);
      this.appendEffect(particle, options.duration || EFFECT_CONFIG.comboDuration, this.boardEffects);
    }

    spawnScreenParticle(options) {
      const particle = document.createElement('div');
      particle.className = options.square ? 'screen-burst-particle effect-particle is-square' : 'screen-burst-particle effect-particle';
      particle.style.left = '50%';
      particle.style.top = '46%';
      particle.style.setProperty('--particle-x', `${options.x}px`);
      particle.style.setProperty('--particle-y', `${options.y}px`);
      particle.style.setProperty('--particle-color', options.color);
      particle.style.setProperty('--particle-size', `${options.size}px`);
      particle.style.setProperty('--particle-delay', `${options.delay}s`);
      particle.style.setProperty('--particle-duration', '980ms');
      this.appendEffect(particle, 980, this.screenLayer);
    }

    appendEffect(node, duration, container) {
      if (this.nodes.size >= this.getEffectBudget().maxActiveNodes) {
        const oldestNode = this.nodes.values().next().value;
        if (oldestNode) {
          oldestNode.remove();
          this.nodes.delete(oldestNode);
        }
      }

      container.appendChild(node);
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

    haptic(type, priority = 'normal') {
      if (!this.settings.vibrations || !global.navigator || typeof global.navigator.vibrate !== 'function') {
        return;
      }

      const now = global.performance && global.performance.now ? global.performance.now() : Date.now();
      if (priority !== 'high' && now - this.lastHapticAt < 90) {
        return;
      }
      this.lastHapticAt = now;

      const patterns = {
        drag: 8,
        place: 12,
        invalid: [18, 35, 18],
        merge: [16, 24, 22],
        combo: [22, 34, 24],
        megaCombo: [28, 42, 30, 36, 34],
        newMax: [26, 36, 34],
        legendary: [34, 44, 52]
      };

      try {
        global.navigator.vibrate(patterns[type] || 10);
      } catch (error) {
        // Some browsers expose the API but refuse vibration in low-power or privacy modes.
      }
    }

    getComboTier(level) {
      if (level >= 10) {
        return 'insane';
      }
      if (level >= 5) {
        return 'mega';
      }
      if (level >= 3) {
        return 'strong';
      }
      return 'light';
    }

    getAnimationLevel() {
      if (this.settings.animationLevel) {
        return this.settings.animationLevel;
      }
      return this.settings.animations ? 'full' : 'off';
    }

    isReduced() {
      return this.getAnimationLevel() === 'reduced';
    }

    shouldAnimate(options = {}) {
      const level = this.getAnimationLevel();
      if (level === 'off') {
        return false;
      }
      if (level === 'reduced' && options.minor) {
        return false;
      }
      return true;
    }

    shouldUseParticles(options = {}) {
      if (!this.settings.particles || !this.shouldAnimate(options)) {
        return false;
      }
      return !this.isReduced() || Boolean(options.important);
    }

    getEffectBudget() {
      const baseBudget = namespace.Performance && namespace.Performance.getEffectBudget
        ? namespace.Performance.getEffectBudget()
        : {
          maxLineClearCells: PERFORMANCE_CONFIG.maxLineClearCells,
          maxFusionSourceCells: PERFORMANCE_CONFIG.maxFusionSourceCells,
          maxFusionParticles: PERFORMANCE_CONFIG.maxFusionParticles,
          maxComboParticles: PERFORMANCE_CONFIG.maxComboParticles
        };

      const ratio = this.isReduced() ? 0.42 : 1;
      return {
        maxLineClearCells: Math.max(8, Math.floor(baseBudget.maxLineClearCells * ratio)),
        maxFusionSourceCells: Math.max(4, Math.floor(baseBudget.maxFusionSourceCells * ratio)),
        maxFusionParticles: Math.max(6, Math.floor(baseBudget.maxFusionParticles * ratio)),
        maxComboParticles: Math.max(12, Math.floor(baseBudget.maxComboParticles * ratio)),
        maxPlacementParticles: this.isReduced() ? 0 : EFFECT_CONFIG.placementParticles,
        maxActiveNodes: this.isReduced()
          ? Math.floor(EFFECT_CONFIG.maxActiveEffectNodes * 0.55)
          : EFFECT_CONFIG.maxActiveEffectNodes
      };
    }
  }

  namespace.EffectManager = EffectManager;
  namespace.FusionEffects = EffectManager;
})(window);
