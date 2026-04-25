(function attachGameEngine(global) {
  'use strict';

  const namespace = global.FusionBlocks;
  const { GRID_SIZE } = namespace.Constants;
  const { createPiece } = namespace.Shapes;

  function createEmptyGrid() {
    return Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => null));
  }

  function cellKey(row, col) {
    return `${row}:${col}`;
  }

  class GameEngine {
    constructor({ bestScore = 0 } = {}) {
      this.bestScore = bestScore;
      this.blockId = 0;
      this.newGame();
    }

    newGame() {
      this.state = {
        grid: createEmptyGrid(),
        pieces: [],
        score: 0,
        bestScore: this.bestScore,
        maxBlock: 2,
        isPaused: false,
        isGameOver: false,
        turn: 0
      };

      this.state.pieces = this.createTray();
      this.evaluateGameOver();
      return this.getState();
    }

    getState() {
      return this.state;
    }

    setPaused(isPaused) {
      this.state.isPaused = Boolean(isPaused);
    }

    createTray() {
      return Array.from({ length: 3 }, () => createPiece(this.state.maxBlock));
    }

    getPiece(pieceId) {
      return this.state.pieces.find((piece) => piece && piece.id === pieceId) || null;
    }

    canPlaceBlock(block, gridPosition) {
      if (!block || !gridPosition || this.state.isPaused || this.state.isGameOver) {
        return false;
      }

      const originRow = Number(gridPosition.row);
      const originCol = Number(gridPosition.col);

      if (!Number.isInteger(originRow) || !Number.isInteger(originCol)) {
        return false;
      }

      // Single placement gate used by preview and final drop to avoid drift.
      for (const cell of block.cells) {
        const row = originRow + cell.row;
        const col = originCol + cell.col;

        if (
          row < 0 ||
          row >= GRID_SIZE ||
          col < 0 ||
          col >= GRID_SIZE ||
          this.state.grid[row][col] !== null
        ) {
          return false;
        }
      }

      return true;
    }

    canPlacePiece(piece, originRow, originCol) {
      return this.canPlaceBlock(piece, { row: originRow, col: originCol });
    }

    hasAnyMove(pieces = this.state.pieces) {
      return pieces
        .filter(Boolean)
        .some((piece) => {
          for (let row = 0; row <= GRID_SIZE - piece.height; row += 1) {
            for (let col = 0; col <= GRID_SIZE - piece.width; col += 1) {
              if (this.canPlaceBlock(piece, { row, col })) {
                return true;
              }
            }
          }
          return false;
        });
    }

    placePiece(pieceId, originRow, originCol) {
      const piece = this.getPiece(pieceId);

      if (!this.canPlaceBlock(piece, { row: originRow, col: originCol })) {
        return { ok: false, reason: 'invalid-placement' };
      }

      const pieceIndex = this.state.pieces.findIndex((candidate) => candidate && candidate.id === pieceId);
      const oldMaxBlock = this.state.maxBlock;
      const events = {
        placed: [],
        merges: [],
        clears: { rows: [], cols: [], cells: [], points: 0 },
        combo: null,
        milestone: null,
        refilled: false,
        gameOver: false
      };

      let placementPoints = 0;

      piece.cells.forEach((cell) => {
        const row = originRow + cell.row;
        const col = originCol + cell.col;
        this.blockId += 1;
        this.state.grid[row][col] = {
          id: `block-${this.blockId}`,
          value: cell.value
        };
        this.state.maxBlock = Math.max(this.state.maxBlock, cell.value);
        placementPoints += cell.value;
        events.placed.push({ row, col, value: cell.value });
      });

      this.addScore(placementPoints);
      this.state.pieces[pieceIndex] = null;

      const mergeResult = this.resolveMerges();
      events.merges = mergeResult.merges;

      const clearResult = this.clearFullLines();
      events.clears = clearResult;

      const comboLevel = mergeResult.waves + clearResult.rows.length + clearResult.cols.length;
      if (comboLevel > 1) {
        const comboBonus = comboLevel * comboLevel * 25;
        this.addScore(comboBonus);
        events.combo = {
          level: comboLevel,
          bonus: comboBonus
        };
      }

      if (this.state.maxBlock >= 2048 && oldMaxBlock < 2048) {
        events.milestone = {
          value: this.state.maxBlock
        };
      }

      if (this.state.pieces.every((candidate) => candidate === null)) {
        this.state.pieces = this.createTray();
        events.refilled = true;
      }

      events.gameOver = this.evaluateGameOver();
      this.state.turn += 1;

      return { ok: true, events, state: this.getState() };
    }

    addScore(points) {
      this.state.score += Math.max(0, Math.floor(points));
      if (this.state.score > this.bestScore) {
        this.bestScore = this.state.score;
        this.state.bestScore = this.bestScore;
      }
    }

    resolveMerges() {
      const merges = [];
      let waves = 0;
      let groups = this.findMergeGroups();

      while (groups.length > 0 && waves < 32) {
        waves += 1;

        groups.forEach((group) => {
          const targetBlock = this.state.grid[group.target.row][group.target.col];
          const sourceCells = group.cells.filter((cell) => (
            cell.row !== group.target.row || cell.col !== group.target.col
          ));
          const canMergeGroup =
            targetBlock &&
            targetBlock.value === group.value &&
            sourceCells.every((cell) => {
              const block = this.state.grid[cell.row][cell.col];
              return block && block.value === group.value;
            });

          if (!canMergeGroup) {
            return;
          }

          const newValue = this.getGroupMergeValue(group.value, group.cells.length);
          this.blockId += 1;
          this.state.grid[group.target.row][group.target.col] = {
            id: `block-${this.blockId}`,
            value: newValue
          };
          sourceCells.forEach((cell) => {
            this.state.grid[cell.row][cell.col] = null;
          });
          this.state.maxBlock = Math.max(this.state.maxBlock, newValue);
          this.addScore(newValue);

          merges.push({
            wave: waves,
            value: newValue,
            from: group.cells.map((cell) => ({ row: cell.row, col: cell.col })),
            to: { row: group.target.row, col: group.target.col }
          });
        });

        groups = this.findMergeGroups();
      }

      return { merges, waves };
    }

    getGroupMergeValue(value, cellCount) {
      return value * (2 ** Math.max(0, cellCount - 1));
    }

    findMergeGroups() {
      const visitedCells = new Set();
      const groups = [];
      const directions = [
        { row: -1, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 0, col: -1 }
      ];

      for (let row = 0; row < GRID_SIZE; row += 1) {
        for (let col = 0; col < GRID_SIZE; col += 1) {
          const block = this.state.grid[row][col];
          const currentKey = cellKey(row, col);

          if (!block || visitedCells.has(currentKey)) {
            continue;
          }

          const group = [];
          const queue = [{ row, col }];
          visitedCells.add(currentKey);

          let queueIndex = 0;
          while (queueIndex < queue.length) {
            const cell = queue[queueIndex];
            queueIndex += 1;
            group.push(cell);

            directions.forEach((direction) => {
              const nextRow = cell.row + direction.row;
              const nextCol = cell.col + direction.col;

              if (
                nextRow < 0 ||
                nextRow >= GRID_SIZE ||
                nextCol < 0 ||
                nextCol >= GRID_SIZE
              ) {
                return;
              }

              const nextKey = cellKey(nextRow, nextCol);
              if (visitedCells.has(nextKey)) {
                return;
              }

              const nextBlock = this.state.grid[nextRow][nextCol];
              if (!nextBlock || nextBlock.value !== block.value) {
                return;
              }

              visitedCells.add(nextKey);
              queue.push({ row: nextRow, col: nextCol });
            });
          }

          if (group.length > 1) {
            groups.push({
              value: block.value,
              cells: group,
              target: this.chooseGroupTarget(group)
            });
          }
        }
      }

      return groups;
    }

    chooseGroupTarget(group) {
      return group.reduce((bestCell, cell) => {
        if (cell.row < bestCell.row || (cell.row === bestCell.row && cell.col < bestCell.col)) {
          return cell;
        }
        return bestCell;
      }, group[0]);
    }

    clearFullLines() {
      const rows = [];
      const cols = [];
      const cellsByKey = new Map();
      let removedValue = 0;

      for (let row = 0; row < GRID_SIZE; row += 1) {
        if (this.state.grid[row].every(Boolean)) {
          rows.push(row);
        }
      }

      for (let col = 0; col < GRID_SIZE; col += 1) {
        let isFull = true;
        for (let row = 0; row < GRID_SIZE; row += 1) {
          if (!this.state.grid[row][col]) {
            isFull = false;
            break;
          }
        }
        if (isFull) {
          cols.push(col);
        }
      }

      rows.forEach((row) => {
        for (let col = 0; col < GRID_SIZE; col += 1) {
          const block = this.state.grid[row][col];
          if (block) {
            cellsByKey.set(cellKey(row, col), { row, col, value: block.value });
          }
        }
      });

      cols.forEach((col) => {
        for (let row = 0; row < GRID_SIZE; row += 1) {
          const block = this.state.grid[row][col];
          if (block) {
            cellsByKey.set(cellKey(row, col), { row, col, value: block.value });
          }
        }
      });

      const cells = Array.from(cellsByKey.values());
      cells.forEach((cell) => {
        removedValue += cell.value;
        this.state.grid[cell.row][cell.col] = null;
      });

      const points = cells.length > 0
        ? Math.round(removedValue * 0.75 + cells.length * 20)
        : 0;
      this.addScore(points);

      return { rows, cols, cells, points };
    }

    evaluateGameOver() {
      const activePieces = this.state.pieces.filter(Boolean);
      this.state.isGameOver = activePieces.length > 0 && !this.hasAnyMove(activePieces);
      return this.state.isGameOver;
    }
  }

  namespace.GameEngine = GameEngine;
})(window);
