(function attachShapes(global) {
  'use strict';

  const namespace = global.FusionBlocks;

  const SHAPES = [
    { id: 'single', label: 'Solo', weight: 12, cells: [[0, 0]] },
    { id: 'domino-h', label: 'Duo', weight: 10, cells: [[0, 0], [0, 1]] },
    { id: 'domino-v', label: 'Duo', weight: 10, cells: [[0, 0], [1, 0]] },
    { id: 'line-3-h', label: 'Ligne', weight: 7, cells: [[0, 0], [0, 1], [0, 2]] },
    { id: 'line-3-v', label: 'Ligne', weight: 7, cells: [[0, 0], [1, 0], [2, 0]] },
    { id: 'corner-a', label: 'Angle', weight: 8, cells: [[0, 0], [1, 0], [1, 1]] },
    { id: 'corner-b', label: 'Angle', weight: 8, cells: [[0, 1], [1, 0], [1, 1]] },
    { id: 'corner-c', label: 'Angle', weight: 8, cells: [[0, 0], [0, 1], [1, 0]] },
    { id: 'corner-d', label: 'Angle', weight: 8, cells: [[0, 0], [0, 1], [1, 1]] },
    { id: 'square-2', label: 'Carré', weight: 6, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
    { id: 'line-4-h', label: 'Barre', weight: 4, cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    { id: 'line-4-v', label: 'Barre', weight: 4, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
    { id: 'tee', label: 'T', weight: 4, cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
    { id: 'zig', label: 'Zig', weight: 4, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
    { id: 'zag', label: 'Zag', weight: 4, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
    { id: 'plus', label: 'Plus', weight: 2, cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] }
  ];

  let pieceCounter = 0;

  function toCells(shapeCells) {
    return shapeCells.map(([row, col]) => ({ row, col }));
  }

  function getDimensions(cells) {
    return cells.reduce(
      (dimensions, cell) => ({
        width: Math.max(dimensions.width, cell.col + 1),
        height: Math.max(dimensions.height, cell.row + 1)
      }),
      { width: 0, height: 0 }
    );
  }

  function pickWeightedShape() {
    const totalWeight = SHAPES.reduce((sum, shape) => sum + shape.weight, 0);
    let cursor = Math.random() * totalWeight;

    for (const shape of SHAPES) {
      cursor -= shape.weight;
      if (cursor <= 0) {
        return shape;
      }
    }

    return SHAPES[0];
  }

  function getValuePool(maxBlock) {
    const pool = [2, 2, 2, 4, 4, 8];

    if (maxBlock >= 32) {
      pool.push(8, 16);
    }
    if (maxBlock >= 128) {
      pool.push(16, 32);
    }
    if (maxBlock >= 512) {
      pool.push(32, 64);
    }
    if (maxBlock >= 1024) {
      pool.push(64, 128);
    }
    if (maxBlock >= 2048) {
      pool.push(128, 256);
    }

    return pool;
  }

  function pickBlockValue(maxBlock) {
    const pool = getValuePool(maxBlock);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function createPiece(maxBlock) {
    const shape = pickWeightedShape();
    const baseCells = toCells(shape.cells);
    const dimensions = getDimensions(baseCells);
    const baseValue = pickBlockValue(maxBlock);
    const coherentPiece = Math.random() < 0.72;
    pieceCounter += 1;

    return {
      id: `piece-${Date.now()}-${pieceCounter}`,
      shapeId: shape.id,
      label: shape.label,
      width: dimensions.width,
      height: dimensions.height,
      cells: baseCells.map((cell) => ({
        ...cell,
        value: coherentPiece ? baseValue : pickBlockValue(maxBlock)
      }))
    };
  }

  namespace.Shapes = {
    createPiece,
    getDimensions
  };
})(window);
