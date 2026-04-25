(function attachInputController(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const { GRID_SIZE } = namespace.Constants;

  class InputController {
    constructor({ engine, renderer, audio, settings, storage, performance = null }) {
      this.engine = engine;
      this.renderer = renderer;
      this.audio = audio;
      this.settings = settings;
      this.storage = storage;
      this.performance = performance;
      this.selectedPieceId = null;
      this.drag = null;
      this.pendingDragFrame = null;
      this.latestPointer = null;
      this.soundTimers = new Set();

      this.bindNavigation();
      this.bindSettings();
      this.bindBoardInput();
      this.bindPieceInput();
    }

    bindNavigation() {
      document.getElementById('game-settings-button').addEventListener('click', () => {
        this.renderer.setScreen('settings');
      });

      document.getElementById('settings-back-button').addEventListener('click', () => {
        this.renderer.returnToPreviousScreen();
      });

      document.getElementById('pause-button').addEventListener('click', () => {
        this.engine.setPaused(true);
        this.renderer.renderGame();
      });

      document.getElementById('resume-button').addEventListener('click', () => {
        this.engine.setPaused(false);
        this.renderer.renderGame();
      });

      document.getElementById('pause-restart-button').addEventListener('click', () => {
        this.startNewGame();
      });

      document.getElementById('restart-button').addEventListener('click', () => {
        this.startNewGame();
      });

      document.getElementById('game-over-restart-button').addEventListener('click', () => {
        this.startNewGame();
      });

    }

    bindSettings() {
      document.getElementById('animation-level-options').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-animation-level]');
        if (!button) {
          return;
        }
        this.updateSettings({ animationLevel: button.dataset.animationLevel });
      });

      document.getElementById('particles-toggle').addEventListener('change', (event) => {
        this.updateSettings({ particles: event.target.checked });
      });

      document.getElementById('vibrations-toggle').addEventListener('change', (event) => {
        this.updateSettings({ vibrations: event.target.checked });
      });

      document.getElementById('combo-effects-toggle').addEventListener('change', (event) => {
        this.updateSettings({ comboEffects: event.target.checked });
      });

      document.getElementById('milestone-popups-toggle').addEventListener('change', (event) => {
        this.updateSettings({ milestonePopups: event.target.checked });
      });

      document.getElementById('debug-toggle').addEventListener('change', (event) => {
        this.updateSettings({ debugMode: event.target.checked });
      });

      document.getElementById('volume-range').addEventListener('input', (event) => {
        this.updateSettings({ volume: Number(event.target.value) });
        this.audio.play('placement');
      });

      document.getElementById('theme-options').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-theme]');
        if (!button) {
          return;
        }
        this.updateSettings({ theme: button.dataset.theme });
      });
    }

    updateSettings(nextSettings) {
      this.settings = { ...this.settings, ...nextSettings };
      if (nextSettings.animationLevel) {
        this.settings.animations = nextSettings.animationLevel !== 'off';
      }
      if (Object.prototype.hasOwnProperty.call(nextSettings, 'animations') && !nextSettings.animationLevel) {
        this.settings.animationLevel = nextSettings.animations ? 'full' : 'off';
      }
      if (this.storage.normalizeSettings) {
        this.settings = this.storage.normalizeSettings(this.settings);
      }
      this.audio.setVolume(this.settings.volume);
      this.renderer.applySettings(this.settings);
      this.storage.saveSettings(this.settings);
    }

    bindBoardInput() {
      this.renderer.elements.grid.addEventListener('pointerdown', (event) => {
        if (!this.selectedPieceId || this.drag || this.isLocked()) {
          return;
        }

        const piece = this.engine.getPiece(this.selectedPieceId);
        const origin = this.getOriginFromPointer(event, piece);
        if (!origin) {
          return;
        }

        this.tryPlaceSelectedPiece(origin.row, origin.col);
      });
    }

    bindPieceInput() {
      this.renderer.elements.tray.addEventListener('pointerdown', (event) => {
        const pieceButton = event.target.closest('.piece-card[data-piece-id]');
        if (!pieceButton || pieceButton.disabled || this.isLocked()) {
          return;
        }

        event.preventDefault();
        const piece = this.engine.getPiece(pieceButton.dataset.pieceId);
        if (!piece) {
          return;
        }

        this.selectedPieceId = piece.id;
        const sourceRect = pieceButton.getBoundingClientRect();
        pieceButton.classList.add('is-dragging');
        if (pieceButton.setPointerCapture) {
          try {
            pieceButton.setPointerCapture(event.pointerId);
          } catch (error) {
            // Some mobile browsers may capture touch pointers differently.
          }
        }

        const floatingPiece = this.renderer.createFloatingPiece(piece);
        this.drag = {
          piece,
          floatingPiece,
          floatingSize: this.renderer.measureFloatingPiece(floatingPiece),
          boardMetrics: this.renderer.getBoardMetrics(),
          viewportBounds: this.renderer.getViewportBounds(),
          validPlacements: this.engine.getValidPlacementKeys(piece),
          offset: this.getDragOffset(piece),
          sourceElement: pieceButton,
          sourceRect,
          pointerId: event.pointerId,
          lastOrigin: null,
          lastOriginKey: '',
          lastPreviewKey: '',
          lastFloatingState: '',
          moved: false
        };
        if (this.performance) {
          this.performance.setMode('drag');
        }
        this.renderer.effects.playDragStart();
        this.updateDrag(event);

        document.addEventListener('pointermove', this.handlePointerMove, { passive: false });
        document.addEventListener('pointerup', this.handlePointerUp);
        document.addEventListener('pointercancel', this.handlePointerCancel);
      });

      this.handlePointerMove = (event) => {
        if (!this.drag) {
          return;
        }
        event.preventDefault();
        this.drag.moved = true;
        this.scheduleDragUpdate(event);
      };

      this.handlePointerUp = (event) => {
        if (!this.drag) {
          return;
        }

        event.preventDefault();
        this.cancelScheduledDragUpdate();
        const origin = this.getOriginFromPointer(
          event,
          this.drag.piece,
          this.drag.offset,
          this.drag.boardMetrics
        );
        const wasPlaced = origin
          ? this.tryPlaceSelectedPiece(origin.row, origin.col)
          : false;

        this.finishDrag({ placed: wasPlaced });
      };

      this.handlePointerCancel = () => {
        this.cancelScheduledDragUpdate();
        this.finishDrag();
      };
    }

    scheduleDragUpdate(event) {
      this.latestPointer = {
        clientX: event.clientX,
        clientY: event.clientY
      };

      if (this.pendingDragFrame) {
        return;
      }

      this.pendingDragFrame = global.requestAnimationFrame(() => {
        this.pendingDragFrame = null;
        if (!this.drag || !this.latestPointer) {
          return;
        }
        this.updateDrag(this.latestPointer);
      });
    }

    cancelScheduledDragUpdate() {
      if (this.pendingDragFrame) {
        global.cancelAnimationFrame(this.pendingDragFrame);
        this.pendingDragFrame = null;
      }
      this.latestPointer = null;
    }

    updateDrag(event) {
      this.renderer.positionFloatingPiece(
        this.drag.floatingPiece,
        event.clientX,
        event.clientY,
        this.drag.offset,
        this.drag.floatingSize,
        this.drag.viewportBounds
      );
      const origin = this.getOriginFromPointer(
        event,
        this.drag.piece,
        this.drag.offset,
        this.drag.boardMetrics
      );

      if (!origin) {
        this.setFloatingPieceState('outside-grid');
        if (this.drag.lastPreviewKey !== 'none') {
          this.renderer.clearPreview();
          this.drag.lastPreviewKey = 'none';
        }
        this.drag.lastOrigin = null;
        this.drag.lastOriginKey = 'outside';
        return;
      }

      const originKey = `${origin.row}:${origin.col}`;
      if (originKey === this.drag.lastOriginKey) {
        return;
      }

      const valid = this.drag.validPlacements.has(originKey);
      const previewKey = valid ? `${origin.row}:${origin.col}` : 'none';
      this.drag.lastOrigin = origin;
      this.drag.lastOriginKey = originKey;
      this.setFloatingPieceState(valid ? 'can-place' : 'cannot-place');

      if (previewKey === this.drag.lastPreviewKey) {
        return;
      }

      this.drag.lastPreviewKey = previewKey;
      if (!valid) {
        this.renderer.clearPreview();
        return;
      }

      this.renderer.showPreview(this.drag.piece, origin.row, origin.col);
    }

    setFloatingPieceState(state) {
      if (!this.drag || this.drag.lastFloatingState === state) {
        return;
      }

      this.drag.lastFloatingState = state;
      this.renderer.setFloatingPieceState(this.drag.floatingPiece, state);
    }

    finishDrag({ placed = false } = {}) {
      const drag = this.drag;
      document.removeEventListener('pointermove', this.handlePointerMove);
      document.removeEventListener('pointerup', this.handlePointerUp);
      document.removeEventListener('pointercancel', this.handlePointerCancel);

      if (drag.sourceElement && drag.sourceElement.releasePointerCapture) {
        try {
          drag.sourceElement.releasePointerCapture(drag.pointerId);
        } catch (error) {
          // The pointer may already be released by the browser.
        }
      }

      if (drag.sourceElement) {
        drag.sourceElement.classList.remove('is-dragging');
      }

      if (placed) {
        this.renderer.removeFloatingPiece(drag.floatingPiece);
      } else {
        this.selectedPieceId = null;
        this.renderer.returnFloatingPiece(drag.floatingPiece, drag.sourceRect);
      }

      this.drag = null;
      this.latestPointer = null;
      if (this.performance) {
        this.performance.setMode('idle');
      }
      this.renderer.clearPreview();
    }

    getDragOffset(piece) {
      const viewportHeight = global.visualViewport ? global.visualViewport.height : global.innerHeight;
      const baseLift = viewportHeight < 720 ? 78 : 96;
      return {
        x: 0,
        y: -(baseLift + piece.height * 10)
      };
    }

    getOriginFromPointer(event, piece, offset = { x: 0, y: 0 }, boardMetrics = null) {
      if (!piece) {
        return null;
      }

      const rect = boardMetrics || this.renderer.getBoardMetrics();
      const placementX = event.clientX + offset.x;
      const placementY = event.clientY + offset.y;
      const isInside =
        placementX >= rect.left &&
        placementX <= rect.right &&
        placementY >= rect.top &&
        placementY <= rect.bottom;

      if (!isInside) {
        return null;
      }

      const col = Math.min(GRID_SIZE - 1, Math.floor((placementX - rect.left) / rect.cellWidth));
      const row = Math.min(GRID_SIZE - 1, Math.floor((placementY - rect.top) / rect.cellHeight));

      return {
        row: row - Math.floor(piece.height / 2),
        col: col - Math.floor(piece.width / 2)
      };
    }

    tryPlaceSelectedPiece(row, col) {
      const piece = this.engine.getPiece(this.selectedPieceId);
      if (!piece) {
        return false;
      }

      const result = this.engine.placePiece(piece.id, row, col);
      if (!result.ok) {
        this.renderer.shakeBoard();
        return false;
      }

      this.selectedPieceId = null;
      this.renderer.setSelectedPiece(null);
      this.renderer.clearPreview();
      this.renderer.applyTurnEffects(result);
      this.storage.saveBestScore(this.engine.getState().bestScore);
      this.playTurnSounds(result);
      return true;
    }

    playTurnSounds(result) {
      this.audio.play('placement');

      if (result.events.merges.length > 0) {
        this.scheduleSound('merge', 90);
      }

      if (result.events.clears.cells.length > 0) {
        this.scheduleSound('clear', 150);
      }

      if (result.events.combo) {
        this.scheduleSound('combo', 220);
      }

      if (result.events.milestone) {
        this.scheduleSound('milestone', 260);
      }

      if (result.events.gameOver) {
        this.scheduleSound('defeat', 360);
      }
    }

    scheduleSound(name, delay) {
      const timer = global.setTimeout(() => {
        this.soundTimers.delete(timer);
        this.audio.play(name);
      }, delay);
      this.soundTimers.add(timer);
    }

    clearSoundTimers() {
      this.soundTimers.forEach((timer) => global.clearTimeout(timer));
      this.soundTimers.clear();
    }

    startNewGame() {
      if (this.drag) {
        this.cancelScheduledDragUpdate();
        this.finishDrag();
      }
      this.selectedPieceId = null;
      this.clearSoundTimers();
      this.renderer.clearEffectTimers();
      this.engine.newGame();
      this.renderer.setSelectedPiece(null);
      this.renderer.setScreen('game');
      this.renderer.renderGame();
    }

    isLocked() {
      const state = this.engine.getState();
      return state.isPaused || state.isGameOver || this.renderer.currentScreen !== 'game';
    }
  }

  namespace.InputController = InputController;
})(window);
