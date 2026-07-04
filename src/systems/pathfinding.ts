/**
 * PathfindingSystem - A* pathfinding with binary heap, anti-blocking fallback,
 * sealed-core detection, and dirty-flag batch recalculation.
 */

import { Grid, GridPosition } from '../models/grid';
import { Path, Structure, Enemy } from '../models/entities';
import { EntityStore } from '../models/entity-store';

// --- Binary Heap (Min-Heap) ---

interface HeapNode {
  position: GridPosition;
  fScore: number;
  gScore: number;
}

export class BinaryHeap {
  private data: HeapNode[] = [];

  get size(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  push(node: HeapNode): void {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapNode {
    if (this.data.length === 0) {
      throw new Error('Heap is empty');
    }
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.data[index].fScore < this.data[parentIndex].fScore) {
        [this.data[index], this.data[parentIndex]] = [this.data[parentIndex], this.data[index]];
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  private sinkDown(index: number): void {
    const length = this.data.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.data[leftChild].fScore < this.data[smallest].fScore) {
        smallest = leftChild;
      }
      if (rightChild < length && this.data[rightChild].fScore < this.data[smallest].fScore) {
        smallest = rightChild;
      }

      if (smallest !== index) {
        [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
        index = smallest;
      } else {
        break;
      }
    }
  }
}

// --- Helper functions ---

/**
 * Creates a string key for a grid position for use in Sets/Maps.
 */
export function posKey(pos: GridPosition): string {
  return `${pos.row},${pos.col}`;
}

/**
 * Manhattan distance heuristic for A*.
 */
export function manhattanDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/**
 * Returns walkable 4-directional neighbors within a walkability grid.
 */
export function getNeighbors(pos: GridPosition, walkabilityGrid: boolean[][]): GridPosition[] {
  const dirs = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];
  const rows = walkabilityGrid.length;
  const cols = rows > 0 ? walkabilityGrid[0].length : 0;

  return dirs
    .map(d => ({ row: pos.row + d.row, col: pos.col + d.col }))
    .filter(
      p =>
        p.row >= 0 &&
        p.row < rows &&
        p.col >= 0 &&
        p.col < cols &&
        walkabilityGrid[p.row][p.col]
    );
}

/**
 * Reconstructs the path from the cameFrom map.
 */
function reconstructPath(cameFrom: Map<string, GridPosition>, end: GridPosition): Path {
  const waypoints: GridPosition[] = [end];
  let current = end;
  let key = posKey(current);

  while (cameFrom.has(key)) {
    current = cameFrom.get(key)!;
    key = posKey(current);
    waypoints.unshift(current);
  }

  return {
    waypoints,
    totalCost: waypoints.length - 1,
  };
}

// --- A* Pathfinding ---

/**
 * A* pathfinding algorithm.
 * @param walkabilityGrid - boolean[][] where true = walkable
 * @param start - starting grid position
 * @param goal - target grid position
 * @returns Path with waypoints and total cost, or null if no path exists
 */
export function aStarPathfind(
  walkabilityGrid: boolean[][],
  start: GridPosition,
  goal: GridPosition
): Path | null {
  const rows = walkabilityGrid.length;
  if (rows === 0) return null;
  const cols = walkabilityGrid[0].length;

  // Validate start and goal are within bounds
  if (
    start.row < 0 || start.row >= rows ||
    start.col < 0 || start.col >= cols ||
    goal.row < 0 || goal.row >= rows ||
    goal.col < 0 || goal.col >= cols
  ) {
    return null;
  }

  // Goal must be walkable (unless start === goal)
  if (!walkabilityGrid[goal.row][goal.col] && !(start.row === goal.row && start.col === goal.col)) {
    return null;
  }

  // Start and goal are the same
  if (start.row === goal.row && start.col === goal.col) {
    return { waypoints: [start], totalCost: 0 };
  }

  // Start must be walkable
  if (!walkabilityGrid[start.row][start.col]) {
    return null;
  }

  const openSet = new BinaryHeap();
  const closedSet = new Set<string>();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, GridPosition>();

  const startKey = posKey(start);
  gScore.set(startKey, 0);
  openSet.push({
    position: start,
    fScore: manhattanDistance(start, goal),
    gScore: 0,
  });

  while (!openSet.isEmpty()) {
    const current = openSet.pop();
    const currentKey = posKey(current.position);

    if (current.position.row === goal.row && current.position.col === goal.col) {
      return reconstructPath(cameFrom, current.position);
    }

    if (closedSet.has(currentKey)) {
      continue;
    }
    closedSet.add(currentKey);

    for (const neighbor of getNeighbors(current.position, walkabilityGrid)) {
      const neighborKey = posKey(neighbor);
      if (closedSet.has(neighborKey)) continue;

      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;

      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, current.position);
        gScore.set(neighborKey, tentativeG);
        openSet.push({
          position: neighbor,
          fScore: tentativeG + manhattanDistance(neighbor, goal),
          gScore: tentativeG,
        });
      }
    }
  }

  return null; // No path found
}

// --- Core-adjacent cells ---

/**
 * Gets all walkable cells that are adjacent to the 2x2 Critical Resource.
 */
export function getCoreAdjacentWalkableCells(grid: Grid): GridPosition[] {
  const coreCells: GridPosition[] = [];

  // Find core cells
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      if (grid.cells[row][col].isCoreCell) {
        coreCells.push({ row, col });
      }
    }
  }

  // Find unique adjacent walkable cells
  const adjacentSet = new Set<string>();
  const result: GridPosition[] = [];
  const dirs = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  for (const coreCell of coreCells) {
    for (const d of dirs) {
      const adj = { row: coreCell.row + d.row, col: coreCell.col + d.col };
      if (
        adj.row >= 0 && adj.row < grid.height &&
        adj.col >= 0 && adj.col < grid.width
      ) {
        const key = posKey(adj);
        if (!adjacentSet.has(key) && grid.cells[adj.row][adj.col].isWalkable) {
          adjacentSet.add(key);
          result.push(adj);
        }
      }
    }
  }

  return result;
}

// --- Sealed Core Detection ---

/**
 * Determines whether the Critical Resource is completely sealed off.
 * Uses BFS/flood fill from core-adjacent walkable cells to determine
 * if any of them can reach a grid edge.
 */
export function isCoreSealedOff(grid: Grid): boolean {
  const coreAdjacentCells = getCoreAdjacentWalkableCells(grid);

  // If there are no walkable cells adjacent to the core, it's sealed
  if (coreAdjacentCells.length === 0) return true;

  // BFS from all core-adjacent walkable cells
  const visited = new Set<string>();
  const queue: GridPosition[] = [...coreAdjacentCells];

  // Mark initial cells as visited
  for (const cell of coreAdjacentCells) {
    visited.add(posKey(cell));
  }

  const walkabilityGrid = getWalkabilityGrid(grid);

  while (queue.length > 0) {
    const cell = queue.shift()!;

    // If this cell is on any edge, core is reachable from outside
    if (isEdgeCell(cell, grid.height, grid.width)) {
      return false;
    }

    for (const neighbor of getNeighbors(cell, walkabilityGrid)) {
      const key = posKey(neighbor);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }

  return true; // No edge reachable from core
}

/**
 * Checks if a cell is on the edge of the grid.
 */
export function isEdgeCell(pos: GridPosition, gridHeight: number, gridWidth: number): boolean {
  return pos.row === 0 || pos.row === gridHeight - 1 || pos.col === 0 || pos.col === gridWidth - 1;
}

// --- Walkability Grid ---

/**
 * Extracts a boolean walkability grid from the Grid model.
 */
export function getWalkabilityGrid(grid: Grid): boolean[][] {
  const result: boolean[][] = [];
  for (let row = 0; row < grid.height; row++) {
    const rowArr: boolean[] = [];
    for (let col = 0; col < grid.width; col++) {
      rowArr.push(grid.cells[row][col].isWalkable);
    }
    result.push(rowArr);
  }
  return result;
}

// --- Anti-blocking Fallback ---

/**
 * Finds a path from 'from' to the nearest barrier's adjacent walkable cell.
 * Barriers are sorted by Manhattan distance from 'from'.
 */
export function findPathToNearestBarrier(
  from: GridPosition,
  grid: Grid,
  barriers: Structure[]
): Path | null {
  if (barriers.length === 0) return null;

  const walkabilityGrid = getWalkabilityGrid(grid);

  // Sort barriers by Manhattan distance from 'from'
  const sortedBarriers = [...barriers].sort(
    (a, b) => manhattanDistance(from, a.position) - manhattanDistance(from, b.position)
  );

  // Try to path to cells adjacent to each barrier (in order of proximity)
  for (const barrier of sortedBarriers) {
    const adjacentCells = getAdjacentWalkableCells(barrier.position, walkabilityGrid);
    for (const cell of adjacentCells) {
      const path = aStarPathfind(walkabilityGrid, from, cell);
      if (path) {
        return path;
      }
    }
  }

  return null;
}

/**
 * Gets walkable cells adjacent to a position.
 */
function getAdjacentWalkableCells(pos: GridPosition, walkabilityGrid: boolean[][]): GridPosition[] {
  const dirs = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];
  const rows = walkabilityGrid.length;
  const cols = rows > 0 ? walkabilityGrid[0].length : 0;

  return dirs
    .map(d => ({ row: pos.row + d.row, col: pos.col + d.col }))
    .filter(
      p =>
        p.row >= 0 &&
        p.row < rows &&
        p.col >= 0 &&
        p.col < cols &&
        walkabilityGrid[p.row][p.col]
    );
}

// --- PathfindingSystem Class ---

/**
 * PathfindingSystem wraps A* functions and manages the dirty flag
 * for batched path recalculation.
 */
export class PathfindingSystem {
  private dirty: boolean = false;
  private grid: Grid;
  private entityStore: EntityStore;

  constructor(grid: Grid, entityStore: EntityStore) {
    this.grid = grid;
    this.entityStore = entityStore;
  }

  /**
   * Marks pathfinding as dirty, triggering recalculation on next update.
   * Called when a structure is placed, sold, or destroyed.
   */
  markDirty(): void {
    this.dirty = true;
  }

  /**
   * Returns whether pathfinding is currently marked dirty.
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Update tick: if dirty, recalculate all active enemy paths.
   * Max 1 recalculation per tick (batch).
   */
  update(): void {
    if (this.dirty) {
      this.recalculateAllPaths();
      this.dirty = false;
    }
  }

  /**
   * Recalculates paths for all active enemies.
   * If core is sealed, uses anti-blocking fallback; otherwise paths to core.
   */
  private recalculateAllPaths(): void {
    const sealed = isCoreSealedOff(this.grid);

    for (const enemy of this.entityStore.enemies.values()) {
      if (sealed) {
        const barriers = this.getBarriers();
        enemy.path = findPathToNearestBarrier(enemy.position, this.grid, barriers);
      } else {
        enemy.path = this.findPathToCore(enemy.position);
      }
      enemy.pathIndex = 0;
    }
  }

  /**
   * Finds a path from 'from' to the nearest walkable cell adjacent to the Critical Resource.
   */
  findPathToCore(from: GridPosition): Path | null {
    const walkabilityGrid = getWalkabilityGrid(this.grid);
    const coreAdjacentCells = getCoreAdjacentWalkableCells(this.grid);

    if (coreAdjacentCells.length === 0) return null;

    // Try each core-adjacent cell, return the shortest path found
    let bestPath: Path | null = null;

    for (const target of coreAdjacentCells) {
      const path = aStarPathfind(walkabilityGrid, from, target);
      if (path && (bestPath === null || path.totalCost < bestPath.totalCost)) {
        bestPath = path;
      }
    }

    return bestPath;
  }

  /**
   * Returns all barrier structures from the entity store.
   */
  private getBarriers(): Structure[] {
    const barriers: Structure[] = [];
    for (const structure of this.entityStore.structures.values()) {
      if (structure.type === 'barrier') {
        barriers.push(structure);
      }
    }
    return barriers;
  }

  /**
   * Convenience: checks if the core is sealed off.
   */
  isCoreSealedOff(): boolean {
    return isCoreSealedOff(this.grid);
  }

  /**
   * Convenience: returns the walkability grid.
   */
  getWalkabilityGrid(): boolean[][] {
    return getWalkabilityGrid(this.grid);
  }
}
