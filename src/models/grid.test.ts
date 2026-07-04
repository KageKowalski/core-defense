import { describe, it, expect } from 'vitest';
import { createGrid, initializeCriticalResource, gridToWorld, worldToGrid } from './grid';

describe('createGrid', () => {
  it('should create a grid with the specified dimensions', () => {
    const grid = createGrid(20, 20);
    expect(grid.width).toBe(20);
    expect(grid.height).toBe(20);
    expect(grid.cells.length).toBe(20);
    expect(grid.cells[0].length).toBe(20);
  });

  it('should initialize all cells as walkable with no occupant', () => {
    const grid = createGrid(4, 4);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        expect(grid.cells[row][col].isWalkable).toBe(true);
        expect(grid.cells[row][col].occupant).toBeNull();
        expect(grid.cells[row][col].isCoreCell).toBe(false);
        expect(grid.cells[row][col].row).toBe(row);
        expect(grid.cells[row][col].col).toBe(col);
      }
    }
  });

  it('should throw for odd dimensions', () => {
    expect(() => createGrid(5, 4)).toThrow('Grid dimensions must be even numbers');
    expect(() => createGrid(4, 5)).toThrow('Grid dimensions must be even numbers');
  });

  it('should throw for dimensions less than 2', () => {
    expect(() => createGrid(0, 4)).toThrow('Grid dimensions must be at least 2x2');
  });
});

describe('initializeCriticalResource', () => {
  it('should place CR at center 4 cells of a 20x20 grid', () => {
    const grid = createGrid(20, 20);
    const positions = initializeCriticalResource(grid, 'cr-1');

    // For 20x20: center cells are (9,9), (9,10), (10,9), (10,10)
    expect(positions).toEqual([
      { row: 9, col: 9 },
      { row: 9, col: 10 },
      { row: 10, col: 9 },
      { row: 10, col: 10 },
    ]);

    // Verify cells are marked correctly
    for (const pos of positions) {
      const cell = grid.cells[pos.row][pos.col];
      expect(cell.occupant).toBe('cr-1');
      expect(cell.isWalkable).toBe(false);
      expect(cell.isCoreCell).toBe(true);
    }
  });

  it('should place CR at center 4 cells of a 4x4 grid', () => {
    const grid = createGrid(4, 4);
    const positions = initializeCriticalResource(grid, 'cr-2');

    // For 4x4: center cells are (1,1), (1,2), (2,1), (2,2)
    expect(positions).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ]);
  });

  it('should not affect non-center cells', () => {
    const grid = createGrid(4, 4);
    initializeCriticalResource(grid, 'cr-3');

    // Check corner cells remain walkable
    expect(grid.cells[0][0].isWalkable).toBe(true);
    expect(grid.cells[0][0].isCoreCell).toBe(false);
    expect(grid.cells[3][3].isWalkable).toBe(true);
  });
});

describe('gridToWorld', () => {
  it('should convert grid position to world center', () => {
    const world = gridToWorld({ row: 0, col: 0 }, 1);
    expect(world).toEqual({ x: 0.5, y: 0, z: 0.5 });
  });

  it('should account for cell size', () => {
    const world = gridToWorld({ row: 2, col: 3 }, 2);
    expect(world).toEqual({ x: 7, y: 0, z: 5 });
  });
});

describe('worldToGrid', () => {
  it('should convert world position to grid position', () => {
    const grid = worldToGrid({ x: 0.5, y: 0, z: 0.5 }, 1);
    expect(grid).toEqual({ row: 0, col: 0 });
  });

  it('should floor to get the cell index', () => {
    const grid = worldToGrid({ x: 1.9, y: 0, z: 2.1 }, 1);
    expect(grid).toEqual({ row: 2, col: 1 });
  });
});
