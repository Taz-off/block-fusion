(function attachRenderer(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const { GRID_SIZE } = namespace.Constants;
  const numberFormatter = new Intl.NumberFormat('fr-FR');
  const blockBlastNumberFormatter = new Intl.NumberFormat('en-US');

  function formatNumber(value) {
    return numberFormatter.format(Math.floor(value));
  }

  function formatScoreNumber(value, useBlockBlastStyle) {
    const formatter = useBlockBlastStyle ? blockBlastNumberFormatter : numberFormatter;
    return formatter.format(Math.floor(value));
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
    constructor({ engine, settings, performance = null }) {
      this.engine = engine;
      this.settings = settings;
      this.performance = performance;
      this.currentScreen = 'game';
      this.previousScreen = 'game';
      this.selectedPieceId = null;
      this.preview = null;
      this.previewCells = new Map();
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
        animationLevelOptions: document.getElementById('animation-level-options'),
        particlesToggle: document.getElementById('particles-toggle'),
        vibrationsToggle: document.getElementById('vibrations-toggle'),
        comboEffectsToggle: document.getElementById('combo-effects-toggle'),
        milestonePopupsToggle: document.getElementById('milestone-popups-toggle'),
        debugToggle: document.getElementById('debug-toggle'),
        volumeRange: document.getElementById('volume-range'),
        themeOptions: document.getElementById('theme-options')
      };
      this.elements.dragLayer = this.ensureDragLayer();
      this.effects = new namespace.EffectManager({
        boardShell: this.elements.boardShell,
        boardEffects: this.elements.boardEffects,
        comboBanner: this.elements.comboBanner,
        milestoneToast: this.elements.milestoneToast,
        screen: this.elements.screens.game,
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
      const animationLevel = settings.animationLevel || (settings.animations ? 'full' : 'off');
      document.body.classList.remove('theme-dark', 'theme-neon', 'theme-pastel', 'theme-block-blast');
      document.body.classList.add(`theme-${settings.theme}`);
      document.body.classList.toggle('no-animations', animationLevel === 'off');
      document.body.classList.toggle('reduced-animations', animationLevel === 'reduced');
      document.body.classList.toggle('no-particles', !settings.particles || animationLevel === 'off');
      this.effects.updateSettings(settings);

      this.elements.animationLevelOptions.querySelectorAll('button').forEach((button) => {
        button.classList.toggle('active', button.dataset.animationLevel === animationLevel);
      });
      this.elements.particlesToggle.checked = Boolean(settings.particles);
      this.elements.vibrationsToggle.checked = Boolean(settings.vibrations);
      this.elements.comboEffectsToggle.checked = settings.comboEffects !== false;
      this.elements.milestonePopupsToggle.checked = settings.milestonePopups !== false;
      this.elements.debugToggle.checked = settings.debugMode;
      this.elements.volumeRange.value = String(settings.volume);
      if (this.performance) {
        this.performance.setEnabled(settings.debugMode);
      }

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
      const useBlockBlastScoreStyle = this.settings.theme === 'block-blast';
      this.elements.scoreValue.textContent = formatScoreNumber(state.score, useBlockBlastScoreStyle);
      this.elements.bestScoreValue.textContent = formatScoreNumber(state.bestScore, useBlockBlastScoreStyle);
      this.elements.maxBlockValue.textContent = formatScoreNumber(state.maxBlock, useBlockBlastScoreStyle);
      this.elements.finalScoreValue.textContent = formatScoreNumber(state.score, useBlockBlastScoreStyle);
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
      this.ensureBoardCells();

      for (let row = 0; row < GRID_SIZE; row += 1) {
        for (let col = 0; col < GRID_SIZE; col += 1) {
          this.renderCell(row, col);
        }
      }
    }

    renderCell(row, col) {
      const state = this.engine.getState();
      const key = keyFor(row, col);
      const slot = this.boardCells.get(key);
      const block = state.grid[row][col];
      const preview = this.previewCells.get(key);
      const className = preview ? 'grid-cell preview-valid' : 'grid-cell';
      const signature = this.getCellSignature(key, block, preview);

      if (!slot) {
        return;
      }

      if (slot.className !== className) {
        slot.className = className;
      }

      if (slot.dataset.renderSignature === signature) {
        return;
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

    buildPreviewCells(piece, row, col) {
      const previewCells = new Map();
      if (!piece) {
        return previewCells;
      }

      piece.cells.forEach((cell) => {
        const cellRow = row + cell.row;
        const cellCol = col + cell.col;
        if (cellRow >= 0 && cellRow < GRID_SIZE && cellCol >= 0 && cellCol < GRID_SIZE) {
          previewCells.set(keyFor(cellRow, cellCol), {
            value: cell.value,
            valid: true
          });
        }
      });

      return previewCells;
    }

    updatePreviewCells(nextPreviewCells) {
      this.ensureBoardCells();

      const affectedKeys = new Set([
        ...this.previewCells.keys(),
        ...nextPreviewCells.keys()
      ]);

      this.previewCells = nextPreviewCells;
      affectedKeys.forEach((key) => {
        const [row, col] = key.split(':').map(Number);
        this.renderCell(row, col);
      });

      if (affectedKeys.size > 0 && this.performance) {
        this.performance.markPreviewUpdate();
      }
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
      this.updatePreviewCells(this.buildPreviewCells(piece, row, col));
    }

    clearPreview() {
      if (!this.preview && this.previewCells.size === 0) {
        return;
      }

      this.preview = null;
      this.updatePreviewCells(new Map());
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

    getBoardMetrics() {
      const rect = this.elements.grid.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        cellWidth: rect.width / GRID_SIZE,
        cellHeight: rect.height / GRID_SIZE
      };
    }

    getViewportBounds() {
      return {
        width: global.visualViewport ? global.visualViewport.width : global.innerWidth,
        height: global.visualViewport ? global.visualViewport.height : global.innerHeight
      };
    }

    positionFloatingPiece(
      floatingPiece,
      x,
      y,
      offset = { x: 0, y: 0 },
      measuredSize = null,
      viewportBounds = null
    ) {
      const viewport = viewportBounds || this.getViewportBounds();
      const size = measuredSize || this.measureFloatingPiece(floatingPiece);
      const margin = 12;
      const halfWidth = Math.max(40, size.width / 2);
      const halfHeight = Math.max(40, size.height / 2);
      const centerX = Math.min(Math.max(x + offset.x, halfWidth + margin), viewport.width - halfWidth - margin);
      const centerY = Math.min(Math.max(y + offset.y, halfHeight + margin), viewport.height - halfHeight - margin);

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
      if (this.performance) {
        this.performance.markTurn();
      }

      this.effects.playTurn(result.events);

      if ((this.settings.animationLevel || (this.settings.animations ? 'full' : 'off')) !== 'off') {
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
      this.effects.playInvalid();
      if ((this.settings.animationLevel || (this.settings.animations ? 'full' : 'off')) === 'off') {
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
