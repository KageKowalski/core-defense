/**
 * Grid Model - Core data structures for the game grid.
 * The grid uses even dimensions and supports cell-based placement.
 */

export type EntityId = string;

export interface GridPosition {
  row: number;
  col: number;
}

export interface WorldPosition {
  x: number; // World-space X (column * cellSize)
  y: number; // World-space Y (height above ground)
  z: number; // World-space Z (row * cellSize)
}

export interface GridCell {
  row: number;
  col: number;
  occupant: EntityId | null;
  isWalkable: boolean;
  isCoreCell: boolean;
}

export interface Grid {
  width: number;  // Even number of columns
  height: number; // Even number of rows
  cells: GridCell[][];
}

/**
 * Creates a grid with the specified even dimensions.
 * All cells start as walkable with no occupant.
 * @param width - Number of columns (must be even)
 * @param height - Number of rows (must be even)
 */
export function createGrid(width: number, height: number): Grid {
  if (width % 2 !== 0 || height % 2 !== 0) {
    throw new Error('Grid dimensions must be even numbers');
  }
  if (width < 2 || height < 2) {
    throw new Error('Grid dimensions must be at least 2x2');
  }

  const cells: GridCell[][] = [];
  for (let row = 0; row < height; row++) {
    const rowCells: GridCell[] = [];
    for (let col = 0; col < width; col++) {
      rowCells.push({
        row,
        col,
        occupant: null,
        isWalkable: true,
        isCoreCell: false,
      });
    }
    cells.push(rowCells);
  }

  return { width, height, cells };
}

/**
 * Places the Critical Resource at the 4 center cells of the grid.
 * For a grid with width W and height H, the CR occupies:
 *   (H/2 - 1, W/2 - 1), (H/2 - 1, W/2), (H/2, W/2 - 1), (H/2, W/2)
 * 
 * @param grid - The grid to place the Critical Resource on
 * @param crEntityId - The entity ID to assign to the Critical Resource cells
 * @returns The 4 GridPositions occupied by the Critical Resource
 */
export function initializeCriticalResource(grid: Grid, crEntityId: EntityId): GridPosition[] {
  const centerRow = grid.height / 2 - 1;
  const centerCol = grid.width / 2 - 1;

  const positions: GridPosition[] = [
    { row: centerRow, col: centerCol },
    { row: centerRow, col: centerCol + 1 },
    { row: centerRow + 1, col: centerCol },
    { row: centerRow + 1, col: centerCol + 1 },
  ];

  for (const pos of positions) {
    const cell = grid.cells[pos.row][pos.col];
    cell.occupant = crEntityId;
    cell.isWalkable = false;
    cell.isCoreCell = true;
  }

  return positions;
}

/**
 * Converts a GridPosition to a WorldPosition using the given cell size.
 */
export function gridToWorld(pos: GridPosition, cellSize: number = 1): WorldPosition {
  return {
    x: pos.col * cellSize + cellSize / 2,
    y: 0,
    z: pos.row * cellSize + cellSize / 2,
  };
}

/**
 * Converts a WorldPosition to the nearest GridPosition.
 */
export function worldToGrid(pos: WorldPosition, cellSize: number = 1): GridPosition {
  return {
    row: Math.floor(pos.z / cellSize),
    col: Math.floor(pos.x / cellSize),
  };
}
