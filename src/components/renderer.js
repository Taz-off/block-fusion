(function attachRenderer(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const { GRID_SIZE } = namespace.Constants;
  const numberFormatter = new Intl.NumberFormat('fr-FR');

  function formatNumber(value) {
    return numberFormatter.format(Math.floor(value));
  }

  function keyFor(row, col) {
    return `${row}:${col}`;
  }

  function getBlockClass(value) {
    if (value <= 2048) {
      return `block-value-${value}`;
    }
    return 'block-value-high';
  }

  function getDigitClass(value) {
    const digits = String(value).length;
    return `digits-${Math.min(5, digits)}`;
  }

  class Renderer {
    constructor({ engine, settings }) {
      this.engine = engine;
      this.settings = settings;
      this.currentScreen = 'game';
      this.previousScreen = 'game';
      this.selectedPieceId = null;
      this.preview = null;
      this.boardCells = new Map();
      this.animationMarks = this.createEmptyMarks();
      this.effectTimers = [];

      this.elements = {
        screens: {
          game: document.getElementById('game-screen'),
          settings: document.getElementById('settings-screen')
        },
        scoreValue: document.getElementById('score-value'),
        bestScoreValue: document.getElementById('best-score-value'),
        maxBlockValue: document.getElementById('max-block-value'),
        finalScoreValue: document.getElementById('final-score-value'),
        grid: document.getElementById('game-grid'),
        boardShell: document.getElementById('board-shell'),
        boardEffects: document.getElementById('board-effects'),
        comboBanner: document.getElementById('combo-banner'),
        milestoneToast: document.getElementById('milestone-toast'),
        tray: document.getElementById('piece-tray'),
        pauseLayer: document.getElementById('pause-layer'),
        gameOverLayer: document.getElementById('game-over-layer'),
        animationsToggle: document.getElementById('animations-toggle'),
        particlesToggle: document.getElementById('particles-toggle'),
        volumeRange: document.getElementById('volume-range'),
        themeOptions: document.getElementById('theme-options')
      };
      this.elements.dragLayer = this.ensureDragLayer();
      this.effects = new namespace.FusionEffects({
        boardShell: this.elements.boardShell,
        boardEffects: this.elements.boardEffects,
        comboBanner: this.elements.comboBanner,
        settings
      });

      this.applySettings(settings);
      this.renderAll();
    }

    ensureDragLayer() {
      let dragLayer = document.getElementById('drag-layer');
      if (!dragLayer) {
        dragLayer = document.createElement('div');
        dragLayer.id = 'drag-layer';
        dragLayer.className = 'drag-layer';
        document.body.appendChild(dragLayer);
      }
      return dragLayer;
    }

    createEmptyMarks() {
      return {
        placed: new Set(),
        merged: new Set()
      };
    }

    applySettings(settings) {
      this.settings = settings;
      document.body.classList.remove('theme-dark', 'theme-neon', 'theme-pastel', 'theme-block-blast');
      document.body.classList.add(`theme-${settings.theme}`);
      document.body.classList.toggle('no-animations', !settings.animations);
      document.body.classList.toggle('no-particles', !settings.particles);
      this.effects.updateSettings(settings);

      this.elements.animationsToggle.checked = settings.animations;
      this.elements.particlesToggle.checked = settings.particles;
      this.elements.volumeRange.value = String(settings.volume);

      this.elements.themeOptions.querySelectorAll('button').forEach((button) => {
        button.classList.toggle('active', button.dataset.theme === settings.theme);
      });
    }

    setScreen(screenName) {
      this.previousScreen = this.currentScreen;
      this.currentScreen = screenName;

      Object.entries(this.elements.screens).forEach(([name, element]) => {
        const isActive = name === screenName;
        element.classList.toggle('active', isActive);
        element.setAttribute('aria-hidden', String(!isActive));
      });

      this.renderAll();
    }

    returnToPreviousScreen() {
      this.setScreen(this.previousScreen === 'settings' ? 'game' : this.previousScreen);
    }

    renderAll() {
      this.renderGame();
      this.applySettings(this.settings);
    }

    renderGame() {
      const state = this.engine.getState();
      this.elements.scoreValue.textContent = formatNumber(state.score);
      this.elements.bestScoreValue.textContent = formatNumber(state.bestScore);
      this.elements.maxBlockValue.textContent = formatNumber(state.maxBlock);
      this.elements.finalScoreValue.textContent = formatNumber(state.score);
      this.renderBoard();
      this.renderPieces();
      this.toggleModal(this.elements.pauseLayer, state.isPaused);
      this.toggleModal(this.elements.gameOverLayer, state.isGameOver);
    }

    toggleModal(element, isVisible) {
      element.classList.toggle('visible', isVisible);
      element.setAttribute('aria-hidden', String(!isVisible));
    }

    renderBoard() {
      const state = this.engine.getState();
      const previewCells = this.getPreviewCells();

      this.ensureBoardCells();

      for (let row = 0; row < GRID_SIZE; row += 1) {
        for (let col = 0; col < GRID_SIZE; col += 1) {
          const key = keyFor(row, col);
          const slot = this.boardCells.get(key);
          const block = state.grid[row][col];
          const preview = previewCells.get(key);
          const className = preview ? 'grid-cell preview-valid' : 'grid-cell';
          const signature = this.getCellSignature(key, block, preview);

          if (slot.className !== className) {
            slot.className = className;
          }

          if (slot.dataset.renderSignature === signature) {
            continue;
          }

          slot.dataset.renderSignature = signature;
          slot.replaceChildren();

          if (block) {
            slot.appendChild(this.createBlockElement(block.value, {
              placed: this.animationMarks.placed.has(key),
              merged: this.animationMarks.merged.has(key)
            }));
          } else if (preview) {
            const ghostBlock = this.createBlockElement(preview.value, { ghost: true });
            slot.appendChild(ghostBlock);
          }
        }
      }
    }

    ensureBoardCells() {
      if (this.boardCells.size === GRID_SIZE * GRID_SIZE) {
        return;
      }

      this.boardCells.clear();
      const fragment = document.createDocumentFragment();

      for (let row = 0; row < GRID_SIZE; row += 1) {
        for (let col = 0; col < GRID_SIZE; col += 1) {
          const slot = document.createElement('div');
          const key = keyFor(row, col);
          slot.className = 'grid-cell';
          slot.dataset.row = String(row);
          slot.dataset.col = String(col);
          this.boardCells.set(key, slot);
          fragment.appendChild(slot);
        }
      }

      this.elements.grid.replaceChildren(fragment);
    }

    getCellSignature(key, block, preview) {
      if (block) {
        return [
          'block',
          block.id,
          block.value,
          this.animationMarks.placed.has(key) ? 'placed' : '',
          this.animationMarks.merged.has(key) ? 'merged' : ''
        ].join(':');
      }

      if (preview) {
        return `preview:${preview.value}`;
      }

      return 'empty';
    }

    getPreviewCells() {
      const previewCells = new Map();
      if (!this.preview || !this.preview.piece || !this.preview.valid) {
        return previewCells;
      }

      this.preview.piece.cells.forEach((cell) => {
        const row = this.preview.row + cell.row;
        const col = this.preview.col + cell.col;
        if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
          previewCells.set(keyFor(row, col), {
            value: cell.value,
            valid: true
          });
        }
      });

      return previewCells;
    }

    createBlockElement(value, options = {}) {
      const block = document.createElement('div');
      block.className = [
        'block',
        getBlockClass(value),
        getDigitClass(value),
        options.ghost ? 'block-ghost' : '',
        options.placed ? 'placed-pop' : '',
        options.merged ? 'merge-pop' : '',
        value >= 2048 ? 'block-legendary' : ''
      ].filter(Boolean).join(' ');
      const label = document.createElement('span');
      label.className = 'block-value-label';
      label.textContent = formatNumber(value);
      block.appendChild(label);
      return block;
    }

    renderPieces() {
      const state = this.engine.getState();
      const fragment = document.createDocumentFragment();

      state.pieces.forEach((piece, index) => {
        const slot = document.createElement('div');
        slot.className = 'tray-slot';

        if (piece) {
          const pieceElement = this.createPieceElement(piece, {
            asButton: true,
            selected: piece.id === this.selectedPieceId,
            disabled: state.isPaused || state.isGameOver
          });
          slot.appendChild(pieceElement);
        } else {
          const empty = document.createElement('div');
          empty.className = 'tray-empty';
          empty.textContent = index + 1;
          slot.appendChild(empty);
        }

        fragment.appendChild(slot);
      });

      this.elements.tray.replaceChildren(fragment);
    }

    createPieceElement(piece, options = {}) {
      const element = document.createElement(options.asButton ? 'button' : 'div');
      const cellsByKey = new Map(piece.cells.map((cell) => [keyFor(cell.row, cell.col), cell]));
      element.className = [
        'piece-card',
        options.selected ? 'selected' : '',
        options.ghost ? 'floating-piece-card' : ''
      ].filter(Boolean).join(' ');

      if (options.asButton) {
        element.type = 'button';
        element.dataset.pieceId = piece.id;
        element.disabled = Boolean(options.disabled);
        element.setAttribute('aria-label', `Piece ${piece.label}`);
      }

      const shape = document.createElement('div');
      shape.className = 'piece-shape';
      shape.style.setProperty('--piece-cols', String(piece.width));
      shape.style.setProperty('--piece-rows', String(piece.height));

      for (let row = 0; row < piece.height; row += 1) {
        for (let col = 0; col < piece.width; col += 1) {
          const miniSlot = document.createElement('div');
          const cell = cellsByKey.get(keyFor(row, col));
          miniSlot.className = 'piece-mini-slot';

          if (cell) {
            miniSlot.appendChild(this.createMiniBlockElement(cell.value));
          }

          shape.appendChild(miniSlot);
        }
      }

      element.appendChild(shape);
      return element;
    }

    createMiniBlockElement(value) {
      const block = document.createElement('div');
      block.className = [
        'piece-block',
        getBlockClass(value),
        getDigitClass(value),
        value >= 2048 ? 'block-legendary' : ''
      ].filter(Boolean).join(' ');
      block.textContent = formatNumber(value);
      return block;
    }

    setSelectedPiece(pieceId) {
      this.selectedPieceId = pieceId;
      this.renderPieces();
    }

    showPreview(piece, row, col) {
      const previewKey = `${piece.id}:${row}:${col}`;
      if (this.preview && this.preview.key === previewKey) {
        return;
      }

      this.preview = { piece, row, col, valid: true, key: previewKey };
      this.renderBoard();
    }

    clearPreview() {
      if (!this.preview) {
        return;
      }

      this.preview = null;
      this.renderBoard();
    }

    createFloatingPiece(piece) {
      const floatingPiece = this.createPieceElement(piece, { ghost: true });
      floatingPiece.classList.add('floating-piece');
      floatingPiece.classList.add('outside-grid');
      floatingPiece.setAttribute('aria-hidden', 'true');
      this.elements.dragLayer.appendChild(floatingPiece);
      return floatingPiece;
    }

    measureFloatingPiece(floatingPiece) {
      const rect = floatingPiece.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height
      };
    }

    positionFloatingPiece(floatingPiece, x, y, offset = { x: 0, y: 0 }, measuredSize = null) {
      const viewportWidth = global.visualViewport ? global.visualViewport.width : global.innerWidth;
      const viewportHeight = global.visualViewport ? global.visualViewport.height : global.innerHeight;
      const size = measuredSize || this.measureFloatingPiece(floatingPiece);
      const margin = 12;
      const halfWidth = Math.max(40, size.width / 2);
      const halfHeight = Math.max(40, size.height / 2);
      const centerX = Math.min(Math.max(x + offset.x, halfWidth + margin), viewportWidth - halfWidth - margin);
      const centerY = Math.min(Math.max(y + offset.y, halfHeight + margin), viewportHeight - halfHeight - margin);

      floatingPiece.style.transform = `translate3d(${centerX}px, ${centerY}px, 0) translate(-50%, -50%) scale(1.06)`;
    }

    setFloatingPieceState(floatingPiece, state) {
      floatingPiece.classList.remove('outside-grid', 'can-place', 'cannot-place');
      floatingPiece.classList.add(state);
    }

    removeFloatingPiece(floatingPiece) {
      if (floatingPiece && floatingPiece.parentElement) {
        floatingPiece.parentElement.removeChild(floatingPiece);
      }
    }

    returnFloatingPiece(floatingPiece, sourceRect) {
      if (!floatingPiece) {
        return;
      }

      if (!sourceRect) {
        this.removeFloatingPiece(floatingPiece);
        return;
      }

      const targetX = sourceRect.left + (sourceRect.width / 2);
      const targetY = sourceRect.top + (sourceRect.height / 2);
      floatingPiece.classList.add('returning');
      floatingPiece.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%) scale(0.82)`;
      global.setTimeout(() => this.removeFloatingPiece(floatingPiece), 190);
    }

    applyTurnEffects(result) {
      if (!result.ok) {
        return;
      }

      this.clearEffectTimers();
      this.animationMarks = this.createEmptyMarks();

      result.events.placed.forEach((cell) => {
        this.animationMarks.placed.add(keyFor(cell.row, cell.col));
      });
      result.events.merges.forEach((merge) => {
        this.animationMarks.merged.add(keyFor(merge.to.row, merge.to.col));
      });

      this.renderGame();

      this.effects.playMerges(result.events.merges);
      this.effects.playLineClear(result.events.clears.cells);

      if (result.events.combo) {
        this.effects.playCombo(result.events.combo, result.events.merges);
      }

      if (result.events.milestone) {
        this.showMilestone(result.events.milestone.value);
      }

      if (this.settings.animations) {
        const timer = global.setTimeout(() => {
          this.animationMarks = this.createEmptyMarks();
          this.renderBoard();
        }, 560);
        this.effectTimers.push(timer);
      }
    }

    clearEffectTimers() {
      this.effectTimers.forEach((timer) => global.clearTimeout(timer));
      this.effectTimers = [];
      this.effects.clear();
    }

    shakeBoard() {
      if (!this.settings.animations) {
        return;
      }

      this.elements.boardShell.classList.remove('shake');
      void this.elements.boardShell.offsetWidth;
      this.elements.boardShell.classList.add('shake');
    }

    showMilestone(value) {
      this.elements.milestoneToast.textContent = `${formatNumber(value)} atteint`;
      this.elements.milestoneToast.classList.remove('show');
      void this.elements.milestoneToast.offsetWidth;
      this.elements.milestoneToast.classList.add('show');
    }
  }

  namespace.Renderer = Renderer;
})(window);
