/**
 * Unit tests for PathfindingSystem - A* pathfinding, anti-blocking fallback,
 * sealed-core detection, dirty flag, and batch recalculation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BinaryHeap,
  aStarPathfind,
  isCoreSealedOff,
  findPathToNearestBarrier,
  getCoreAdjacentWalkableCells,
  getWalkabilityGrid,
  manhattanDistance,
  PathfindingSystem,
  posKey,
} from './pathfinding';
import { createGrid, initializeCriticalResource, Grid, GridPosition } from '../models/grid';
import { createEntityStore, EntityStore, addEntity } from '../models/entity-store';
import { CriticalResource, Structure, Enemy, Barrier } from '../models/entities';

// --- Helpers ---

function createSimpleWalkabilityGrid(rows: number, cols: number, blocked: GridPosition[] = []): boolean[][] {
  const grid: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(true);
    }
    grid.push(row);
  }
  for (const pos of blocked) {
    grid[pos.row][pos.col] = false;
  }
  return grid;
}

function createTestCR(): CriticalResource {
  return {
    id: 'cr-1',
    type: 'critical_resource',
    maxHealth: 100,
    currentHealth: 100,
    position: { row: 9, col: 9 },
    worldPosition: { x: 9.5, y: 0, z: 9.5 },
    cells: [
      { row: 9, col: 9 },
      { row: 9, col: 10 },
      { row: 10, col: 9 },
      { row: 10, col: 10 },
    ],
  };
}

function createTestEnemy(id: string, position: GridPosition): Enemy {
  return {
    id,
    type: 'basic_enemy',
    position,
    worldPosition: { x: position.col + 0.5, y: 0, z: position.row + 0.5 },
    maxHealth: 50,
    currentHealth: 50,
    speed: 2,
    damage: 10,
    structureDamage: 0,
    bounty: 5,
    path: null,
    pathIndex: 0,
    interpolation: 0,
    isAttackingBarrier: false,
    attackCooldown: 0,
  };
}

function createTestBarrier(id: string, position: GridPosition): Barrier {
  return {
    id,
    type: 'barrier',
    position,
    worldPosition: { x: position.col + 0.5, y: 0, z: position.row + 0.5 },
    maxHealth: 150,
    currentHealth: 150,
    originalCost: 10,
  };
}

// --- BinaryHeap Tests ---

describe('BinaryHeap', () => {
  it('should push and pop in sorted order by fScore', () => {
    const heap = new BinaryHeap();
    heap.push({ position: { row: 0, col: 0 }, fScore: 5, gScore: 5 });
    heap.push({ position: { row: 1, col: 1 }, fScore: 2, gScore: 2 });
    heap.push({ position: { row: 2, col: 2 }, fScore: 8, gScore: 8 });
    heap.push({ position: { row: 3, col: 3 }, fScore: 1, gScore: 1 });

    expect(heap.pop().fScore).toBe(1);
    expect(heap.pop().fScore).toBe(2);
    expect(heap.pop().fScore).toBe(5);
    expect(heap.pop().fScore).toBe(8);
  });

  it('should report size correctly', () => {
    const heap = new BinaryHeap();
    expect(heap.size).toBe(0);
    expect(heap.isEmpty()).toBe(true);
    heap.push({ position: { row: 0, col: 0 }, fScore: 1, gScore: 1 });
    expect(heap.size).toBe(1);
    expect(heap.isEmpty()).toBe(false);
  });

  it('should throw when popping from empty heap', () => {
    const heap = new BinaryHeap();
    expect(() => heap.pop()).toThrow('Heap is empty');
  });
});

// --- A* Pathfinding Tests ---

describe('aStarPathfind', () => {
  it('should find the shortest path on a simple open grid', () => {
    const grid = createSimpleWalkabilityGrid(5, 5);
    const path = aStarPathfind(grid, { row: 0, col: 0 }, { row: 4, col: 4 });

    expect(path).not.toBeNull();
    expect(path!.totalCost).toBe(8); // Manhattan distance on open grid
    expect(path!.waypoints[0]).toEqual({ row: 0, col: 0 });
    expect(path!.waypoints[path!.waypoints.length - 1]).toEqual({ row: 4, col: 4 });
  });

  it('should return null when no path exists', () => {
    // Create a grid with a wall blocking all paths
    const grid = createSimpleWalkabilityGrid(5, 5);
    // Block entire row 2
    for (let col = 0; col < 5; col++) {
      grid[2][col] = false;
    }
    const path = aStarPathfind(grid, { row: 0, col: 0 }, { row: 4, col: 4 });
    expect(path).toBeNull();
  });

  it('should navigate around obstacles', () => {
    // 5x5 grid with wall in the middle except for a gap
    const blocked: GridPosition[] = [
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      // col 4 is open (the gap)
    ];
    const grid = createSimpleWalkabilityGrid(5, 5, blocked);
    const path = aStarPathfind(grid, { row: 0, col: 0 }, { row: 4, col: 0 });

    expect(path).not.toBeNull();
    // Path must go around: 0,0 -> right to col 4 -> through gap at row 2, col 4 -> back left to col 0, row 4
    // The shortest path goes around the wall
    expect(path!.totalCost).toBeGreaterThan(4); // Greater than straight-line Manhattan
    // Verify no waypoint is on a blocked cell
    for (const wp of path!.waypoints) {
      if (blocked.some(b => b.row === wp.row && b.col === wp.col)) {
        throw new Error(`Path goes through blocked cell: ${wp.row}, ${wp.col}`);
      }
    }
  });

  it('should return path with single waypoint when start equals goal', () => {
    const grid = createSimpleWalkabilityGrid(5, 5);
    const path = aStarPathfind(grid, { row: 2, col: 2 }, { row: 2, col: 2 });

    expect(path).not.toBeNull();
    expect(path!.totalCost).toBe(0);
    expect(path!.waypoints).toEqual([{ row: 2, col: 2 }]);
  });

  it('should return null when goal is not walkable', () => {
    const grid = createSimpleWalkabilityGrid(5, 5);
    grid[4][4] = false;
    const path = aStarPathfind(grid, { row: 0, col: 0 }, { row: 4, col: 4 });
    expect(path).toBeNull();
  });

  it('should return null when start is not walkable', () => {
    const grid = createSimpleWalkabilityGrid(5, 5);
    grid[0][0] = false;
    const path = aStarPathfind(grid, { row: 0, col: 0 }, { row: 4, col: 4 });
    expect(path).toBeNull();
  });

  it('should return null for out-of-bounds positions', () => {
    const grid = createSimpleWalkabilityGrid(5, 5);
    expect(aStarPathfind(grid, { row: -1, col: 0 }, { row: 4, col: 4 })).toBeNull();
    expect(aStarPathfind(grid, { row: 0, col: 0 }, { row: 5, col: 5 })).toBeNull();
  });

  it('should find path along narrow corridor', () => {
    // Only row 0 is walkable
    const grid: boolean[][] = [];
    for (let r = 0; r < 5; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < 5; c++) {
        row.push(r === 0);
      }
      grid.push(row);
    }
    const path = aStarPathfind(grid, { row: 0, col: 0 }, { row: 0, col: 4 });
    expect(path).not.toBeNull();
    expect(path!.totalCost).toBe(4);
  });

  it('should use 4-directional movement only (no diagonals)', () => {
    const grid = createSimpleWalkabilityGrid(3, 3);
    const path = aStarPathfind(grid, { row: 0, col: 0 }, { row: 2, col: 2 });

    expect(path).not.toBeNull();
    expect(path!.totalCost).toBe(4); // Must be 4 (2 down + 2 right), not 2 (diagonal)
    // Verify each consecutive pair differs by exactly 1 in row or col
    for (let i = 0; i < path!.waypoints.length - 1; i++) {
      const curr = path!.waypoints[i];
      const next = path!.waypoints[i + 1];
      const dist = Math.abs(curr.row - next.row) + Math.abs(curr.col - next.col);
      expect(dist).toBe(1);
    }
  });
});

// --- Core-Adjacent Cell Tests ---

describe('getCoreAdjacentWalkableCells', () => {
  it('should return walkable cells adjacent to the 2x2 core', () => {
    const grid = createGrid(20, 20);
    initializeCriticalResource(grid, 'cr-1');

    const adjacent = getCoreAdjacentWalkableCells(grid);

    // Core is at (9,9), (9,10), (10,9), (10,10)
    // Adjacent cells should be: 8 unique positions around the 2x2
    expect(adjacent.length).toBeGreaterThan(0);

    // No adjacent cell should be a core cell
    for (const cell of adjacent) {
      expect(grid.cells[cell.row][cell.col].isCoreCell).toBe(false);
      expect(grid.cells[cell.row][cell.col].isWalkable).toBe(true);
    }
  });

  it('should return empty when all core-adjacent cells are blocked', () => {
    const grid = createGrid(6, 6);
    initializeCriticalResource(grid, 'cr-1');
    // Core at (2,2), (2,3), (3,2), (3,3)
    // Block all adjacent cells
    const adjacentPositions = [
      { row: 1, col: 2 }, { row: 1, col: 3 },
      { row: 2, col: 1 }, { row: 3, col: 1 },
      { row: 4, col: 2 }, { row: 4, col: 3 },
      { row: 2, col: 4 }, { row: 3, col: 4 },
    ];
    for (const pos of adjacentPositions) {
      grid.cells[pos.row][pos.col].isWalkable = false;
      grid.cells[pos.row][pos.col].occupant = 'blocker';
    }

    const adjacent = getCoreAdjacentWalkableCells(grid);
    expect(adjacent.length).toBe(0);
  });
});

// --- Sealed Core Detection Tests ---

describe('isCoreSealedOff', () => {
  it('should return false when core is reachable from edges (open grid)', () => {
    const grid = createGrid(20, 20);
    initializeCriticalResource(grid, 'cr-1');

    expect(isCoreSealedOff(grid)).toBe(false);
  });

  it('should return true when core is fully surrounded by structures', () => {
    const grid = createGrid(10, 10);
    initializeCriticalResource(grid, 'cr-1');
    // Core at (4,4), (4,5), (5,4), (5,5)
    // Surround with a ring of blocked cells
    const ringPositions = [
      { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 },
      { row: 4, col: 3 }, { row: 4, col: 6 },
      { row: 5, col: 3 }, { row: 5, col: 6 },
      { row: 6, col: 3 }, { row: 6, col: 4 }, { row: 6, col: 5 }, { row: 6, col: 6 },
    ];
    for (const pos of ringPositions) {
      grid.cells[pos.row][pos.col].isWalkable = false;
      grid.cells[pos.row][pos.col].occupant = 'barrier';
    }

    expect(isCoreSealedOff(grid)).toBe(true);
  });

  it('should return false when one gap exists in the surrounding ring', () => {
    const grid = createGrid(12, 12);
    initializeCriticalResource(grid, 'cr-1');
    // Core at (5,5), (5,6), (6,5), (6,6)
    // Create a ring around the core. Leave a gap on the right side at (6,8)
    // so (6,7) core-adjacent can reach the edge.
    const ringPositions = [
      { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 }, { row: 3, col: 7 }, { row: 3, col: 8 },
      { row: 4, col: 3 }, { row: 4, col: 8 },
      { row: 5, col: 3 }, { row: 5, col: 8 },
      { row: 6, col: 3 },
      // { row: 6, col: 8 }, // LEAVE THIS OPEN as a gap
      { row: 7, col: 3 }, { row: 7, col: 8 },
      { row: 8, col: 3 }, { row: 8, col: 4 }, { row: 8, col: 5 }, { row: 8, col: 6 }, { row: 8, col: 7 }, { row: 8, col: 8 },
    ];
    for (const pos of ringPositions) {
      grid.cells[pos.row][pos.col].isWalkable = false;
      grid.cells[pos.row][pos.col].occupant = 'barrier';
    }

    expect(isCoreSealedOff(grid)).toBe(false);
  });

  it('should return true when all core-adjacent cells are blocked', () => {
    const grid = createGrid(6, 6);
    initializeCriticalResource(grid, 'cr-1');
    // Core at (2,2), (2,3), (3,2), (3,3)
    // Block all cells immediately adjacent to core
    const adjacentPositions = [
      { row: 1, col: 2 }, { row: 1, col: 3 },
      { row: 2, col: 1 }, { row: 3, col: 1 },
      { row: 4, col: 2 }, { row: 4, col: 3 },
      { row: 2, col: 4 }, { row: 3, col: 4 },
    ];
    for (const pos of adjacentPositions) {
      grid.cells[pos.row][pos.col].isWalkable = false;
      grid.cells[pos.row][pos.col].occupant = 'blocker';
    }

    expect(isCoreSealedOff(grid)).toBe(true);
  });
});

// --- findPathToNearestBarrier Tests ---

describe('findPathToNearestBarrier', () => {
  it('should path to the nearest barrier by Manhattan distance', () => {
    const grid = createGrid(10, 10);
    initializeCriticalResource(grid, 'cr-1');

    // Place two barriers at different distances
    const barrierClose = createTestBarrier('b1', { row: 2, col: 2 });
    const barrierFar = createTestBarrier('b2', { row: 8, col: 8 });

    // Mark barrier cells as non-walkable
    grid.cells[2][2].isWalkable = false;
    grid.cells[2][2].occupant = 'b1';
    grid.cells[8][8].isWalkable = false;
    grid.cells[8][8].occupant = 'b2';

    const from: GridPosition = { row: 0, col: 0 };
    const path = findPathToNearestBarrier(from, grid, [barrierClose, barrierFar]);

    expect(path).not.toBeNull();
    // Path should end at a cell adjacent to the closer barrier (row 2, col 2)
    const lastWaypoint = path!.waypoints[path!.waypoints.length - 1];
    const distToClose = manhattanDistance(lastWaypoint, barrierClose.position);
    expect(distToClose).toBe(1); // Adjacent to the close barrier
  });

  it('should return null when no barriers exist', () => {
    const grid = createGrid(10, 10);
    const from: GridPosition = { row: 0, col: 0 };
    const path = findPathToNearestBarrier(from, grid, []);
    expect(path).toBeNull();
  });

  it('should skip barriers with no reachable adjacent cells', () => {
    const grid = createGrid(10, 10);
    initializeCriticalResource(grid, 'cr-1');

    // Place a barrier and completely surround it (no adjacent walkable cells)
    const barrier = createTestBarrier('b1', { row: 5, col: 5 });
    grid.cells[5][5].isWalkable = false;
    grid.cells[5][5].occupant = 'b1';
    grid.cells[4][5].isWalkable = false;
    grid.cells[4][5].occupant = 'wall1';
    grid.cells[6][5].isWalkable = false;
    grid.cells[6][5].occupant = 'wall2';
    grid.cells[5][4].isWalkable = false;
    grid.cells[5][4].occupant = 'wall3';
    grid.cells[5][6].isWalkable = false;
    grid.cells[5][6].occupant = 'wall4';

    // Place a second reachable barrier
    const barrier2 = createTestBarrier('b2', { row: 0, col: 5 });
    grid.cells[0][5].isWalkable = false;
    grid.cells[0][5].occupant = 'b2';

    const from: GridPosition = { row: 0, col: 0 };
    const path = findPathToNearestBarrier(from, grid, [barrier, barrier2]);

    expect(path).not.toBeNull();
    // Should path to the second barrier since first has no reachable adjacent cells
    const lastWaypoint = path!.waypoints[path!.waypoints.length - 1];
    const distToBarrier2 = manhattanDistance(lastWaypoint, barrier2.position);
    expect(distToBarrier2).toBe(1);
  });

  it('should choose the closest barrier among multiple options', () => {
    const grid = createGrid(10, 10);

    // Barriers at different distances from origin
    const barrier1 = createTestBarrier('b1', { row: 1, col: 1 });
    const barrier2 = createTestBarrier('b2', { row: 5, col: 5 });
    const barrier3 = createTestBarrier('b3', { row: 8, col: 8 });

    grid.cells[1][1].isWalkable = false;
    grid.cells[1][1].occupant = 'b1';
    grid.cells[5][5].isWalkable = false;
    grid.cells[5][5].occupant = 'b2';
    grid.cells[8][8].isWalkable = false;
    grid.cells[8][8].occupant = 'b3';

    const from: GridPosition = { row: 0, col: 0 };
    const path = findPathToNearestBarrier(from, grid, [barrier3, barrier1, barrier2]);

    expect(path).not.toBeNull();
    // Should reach adjacent to barrier1 (closest to origin)
    const lastWaypoint = path!.waypoints[path!.waypoints.length - 1];
    const distToB1 = manhattanDistance(lastWaypoint, barrier1.position);
    expect(distToB1).toBe(1);
  });
});

// --- PathfindingSystem Class Tests ---

describe('PathfindingSystem', () => {
  let grid: Grid;
  let entityStore: EntityStore;
  let system: PathfindingSystem;

  beforeEach(() => {
    grid = createGrid(20, 20);
    initializeCriticalResource(grid, 'cr-1');
    const cr: CriticalResource = {
      id: 'cr-1',
      type: 'critical_resource',
      maxHealth: 100,
      currentHealth: 100,
      position: { row: 9, col: 9 },
      worldPosition: { x: 9.5, y: 0, z: 9.5 },
      cells: [
        { row: 9, col: 9 },
        { row: 9, col: 10 },
        { row: 10, col: 9 },
        { row: 10, col: 10 },
      ],
    };
    entityStore = createEntityStore(cr);
    system = new PathfindingSystem(grid, entityStore);
  });

  describe('dirty flag and batch recalculation', () => {
    it('should start with dirty = false', () => {
      expect(system.isDirty()).toBe(false);
    });

    it('should set dirty = true when markDirty is called', () => {
      system.markDirty();
      expect(system.isDirty()).toBe(true);
    });

    it('should reset dirty to false after update()', () => {
      system.markDirty();
      system.update();
      expect(system.isDirty()).toBe(false);
    });

    it('should not recalculate when not dirty', () => {
      const enemy = createTestEnemy('e1', { row: 0, col: 0 });
      addEntity(entityStore, enemy);

      // Update without marking dirty - enemy path should remain null
      system.update();
      expect(enemy.path).toBeNull();
    });

    it('should recalculate all enemy paths when dirty', () => {
      const enemy1 = createTestEnemy('e1', { row: 0, col: 0 });
      const enemy2 = createTestEnemy('e2', { row: 19, col: 19 });
      addEntity(entityStore, enemy1);
      addEntity(entityStore, enemy2);

      system.markDirty();
      system.update();

      expect(enemy1.path).not.toBeNull();
      expect(enemy2.path).not.toBeNull();
    });

    it('should reset pathIndex to 0 on recalculation', () => {
      const enemy = createTestEnemy('e1', { row: 0, col: 0 });
      enemy.pathIndex = 5; // Simulate being partway along a path
      addEntity(entityStore, enemy);

      system.markDirty();
      system.update();

      expect(enemy.pathIndex).toBe(0);
    });
  });

  describe('findPathToCore', () => {
    it('should find a path from edge to core-adjacent cell', () => {
      const path = system.findPathToCore({ row: 0, col: 0 });
      expect(path).not.toBeNull();
      expect(path!.waypoints.length).toBeGreaterThan(1);

      // Last waypoint should be adjacent to the core
      const last = path!.waypoints[path!.waypoints.length - 1];
      const coreAdj = getCoreAdjacentWalkableCells(grid);
      const isAdjacentToCore = coreAdj.some(c => c.row === last.row && c.col === last.col);
      expect(isAdjacentToCore).toBe(true);
    });

    it('should return null when no path to core exists', () => {
      // Block all core-adjacent cells
      const coreAdj = getCoreAdjacentWalkableCells(grid);
      for (const pos of coreAdj) {
        grid.cells[pos.row][pos.col].isWalkable = false;
        grid.cells[pos.row][pos.col].occupant = 'wall';
      }

      const path = system.findPathToCore({ row: 0, col: 0 });
      expect(path).toBeNull();
    });
  });

  describe('anti-blocking fallback integration', () => {
    it('should path to barriers when core is sealed', () => {
      // Seal the core with barriers
      const coreAdj = getCoreAdjacentWalkableCells(grid);
      for (const pos of coreAdj) {
        const barrier = createTestBarrier(`b-${pos.row}-${pos.col}`, pos);
        grid.cells[pos.row][pos.col].isWalkable = false;
        grid.cells[pos.row][pos.col].occupant = barrier.id;
        addEntity(entityStore, barrier);
      }

      expect(system.isCoreSealedOff()).toBe(true);

      const enemy = createTestEnemy('e1', { row: 0, col: 0 });
      addEntity(entityStore, enemy);

      system.markDirty();
      system.update();

      // Enemy should have a path (to nearest barrier)
      expect(enemy.path).not.toBeNull();
    });
  });

  describe('isCoreSealedOff', () => {
    it('should return false for open grid', () => {
      expect(system.isCoreSealedOff()).toBe(false);
    });
  });

  describe('getWalkabilityGrid', () => {
    it('should return correct dimensions', () => {
      const wGrid = system.getWalkabilityGrid();
      expect(wGrid.length).toBe(20);
      expect(wGrid[0].length).toBe(20);
    });

    it('should mark core cells as non-walkable', () => {
      const wGrid = system.getWalkabilityGrid();
      // Core at (9,9), (9,10), (10,9), (10,10)
      expect(wGrid[9][9]).toBe(false);
      expect(wGrid[9][10]).toBe(false);
      expect(wGrid[10][9]).toBe(false);
      expect(wGrid[10][10]).toBe(false);
    });
  });
});

// --- Core-adjacent targeting test ---

describe('Core-adjacent cell targeting', () => {
  it('should path to nearest core-adjacent cell when multiple exist', () => {
    const grid = createGrid(10, 10);
    initializeCriticalResource(grid, 'cr-1');
    // Core at (4,4), (4,5), (5,4), (5,5)

    const cr: CriticalResource = {
      id: 'cr-1',
      type: 'critical_resource',
      maxHealth: 100,
      currentHealth: 100,
      position: { row: 4, col: 4 },
      worldPosition: { x: 4.5, y: 0, z: 4.5 },
      cells: [
        { row: 4, col: 4 },
        { row: 4, col: 5 },
        { row: 5, col: 4 },
        { row: 5, col: 5 },
      ],
    };
    const entityStore = createEntityStore(cr);
    const system = new PathfindingSystem(grid, entityStore);

    // Path from top-left corner
    const path = system.findPathToCore({ row: 0, col: 0 });
    expect(path).not.toBeNull();

    // The end cell should be core-adjacent
    const last = path!.waypoints[path!.waypoints.length - 1];
    const coreAdj = getCoreAdjacentWalkableCells(grid);
    const isAdjacentToCore = coreAdj.some(c => c.row === last.row && c.col === last.col);
    expect(isAdjacentToCore).toBe(true);

    // Path from bottom-right corner
    const path2 = system.findPathToCore({ row: 9, col: 9 });
    expect(path2).not.toBeNull();
    const last2 = path2!.waypoints[path2!.waypoints.length - 1];
    const isAdjacentToCore2 = coreAdj.some(c => c.row === last2.row && c.col === last2.col);
    expect(isAdjacentToCore2).toBe(true);
  });
});
