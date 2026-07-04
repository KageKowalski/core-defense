/**
 * SpawnSystem - Manages wave spawning with staggered intervals.
 * Handles wave composition, spawn edge selection, and spawn position generation.
 */

import { GridPosition, gridToWorld } from '../models/grid';
import { Enemy, BasicEnemy, BruteEnemy } from '../models/entities';
import { GameConfig } from '../models/config';
import { EntityStore, addEntity } from '../models/entity-store';
import { PathfindingSystem } from './pathfinding';
import { Logger } from '../utils/logger';

const log = Logger.create('Spawn');

export type SpawnEdge = 'top' | 'bottom' | 'left' | 'right';

export interface WaveComposition {
  basicCount: number;
  bruteCount: number;
  totalCount: number;
  spawnInterval: number;
}

export type EnemyType = 'basic_enemy' | 'brute_enemy';

interface SpawnState {
  queue: EnemyType[];
  edges: SpawnEdge[];
  index: number;
  timer: number;
  interval: number;
  active: boolean;
}

/**
 * Calculates the wave composition for a given wave number.
 * total = 5 + (N-1)*2, brute = max(0, N-3), basic = total - brute
 */
export function getWaveComposition(waveNumber: number): WaveComposition {
  const totalCount = 5 + (waveNumber - 1) * 2;
  const bruteCount = Math.max(0, waveNumber - 3);
  const basicCount = totalCount - bruteCount;
  const interval = clamp(2.0 - waveNumber * 0.1, GameConfig.spawn.minInterval, GameConfig.spawn.maxInterval);

  return { basicCount, bruteCount, totalCount, spawnInterval: interval };
}

/**
 * Clamps a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Selects at least 2 different edges randomly for spawning.
 */
export function selectSpawnEdges(rng?: () => number): SpawnEdge[] {
  const random = rng || Math.random;
  const allEdges: SpawnEdge[] = ['top', 'bottom', 'left', 'right'];

  // Shuffle array using Fisher-Yates
  const shuffled = [...allEdges];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Select 2-4 edges (ensuring at least 2)
  const count = Math.max(2, Math.min(4, Math.floor(random() * 3) + 2));
  return shuffled.slice(0, count);
}

/**
 * Returns a spawn position outside the visible grid (1 cell beyond the edge).
 * @param edge - Which edge to spawn from
 * @param gridWidth - Width of the grid
 * @param gridHeight - Height of the grid
 * @param rng - Optional random number generator
 */
export function getSpawnPosition(
  edge: SpawnEdge,
  gridWidth: number,
  gridHeight: number,
  rng?: () => number
): GridPosition {
  const random = rng || Math.random;

  switch (edge) {
    case 'top':
      return { row: -1, col: Math.floor(random() * gridWidth) };
    case 'bottom':
      return { row: gridHeight, col: Math.floor(random() * gridWidth) };
    case 'left':
      return { row: Math.floor(random() * gridHeight), col: -1 };
    case 'right':
      return { row: Math.floor(random() * gridHeight), col: gridWidth };
  }
}

/**
 * Builds the spawn queue from a wave composition.
 * Brute enemies are distributed evenly throughout the queue.
 */
function buildSpawnQueue(composition: WaveComposition): EnemyType[] {
  const queue: EnemyType[] = [];
  const { basicCount, bruteCount, totalCount } = composition;

  if (bruteCount === 0) {
    for (let i = 0; i < basicCount; i++) {
      queue.push('basic_enemy');
    }
    return queue;
  }

  // Distribute brutes evenly among the queue
  const bruteInterval = Math.floor(totalCount / (bruteCount + 1));
  let bruteIndex = bruteInterval;
  let brutesPlaced = 0;

  for (let i = 0; i < totalCount; i++) {
    if (brutesPlaced < bruteCount && i === bruteIndex) {
      queue.push('brute_enemy');
      brutesPlaced++;
      bruteIndex += bruteInterval;
    } else {
      queue.push('basic_enemy');
    }
  }

  // Ensure all brutes are placed (in case of rounding)
  while (queue.filter(e => e === 'brute_enemy').length < bruteCount) {
    const lastBasicIdx = queue.lastIndexOf('basic_enemy');
    if (lastBasicIdx >= 0) {
      queue[lastBasicIdx] = 'brute_enemy';
    }
  }

  return queue;
}

/**
 * Creates an enemy entity of the given type at the specified position.
 */
export function createEnemyEntity(
  type: EnemyType,
  position: GridPosition,
  id: string
): Enemy {
  const worldPosition = gridToWorld(position, GameConfig.grid.cellSize);

  if (type === 'basic_enemy') {
    const enemy: BasicEnemy = {
      id,
      type: 'basic_enemy',
      position,
      worldPosition,
      maxHealth: GameConfig.enemies.basic.health,
      currentHealth: GameConfig.enemies.basic.health,
      speed: GameConfig.enemies.basic.speed,
      damage: GameConfig.enemies.basic.damage,
      structureDamage: GameConfig.enemies.basic.structureDamage,
      bounty: GameConfig.enemies.basic.bounty,
      path: null,
      pathIndex: 0,
      interpolation: 0,
      isAttackingBarrier: false,
      attackCooldown: 0,
    };
    return enemy;
  } else {
    const enemy: BruteEnemy = {
      id,
      type: 'brute_enemy',
      position,
      worldPosition,
      maxHealth: GameConfig.enemies.brute.health,
      currentHealth: GameConfig.enemies.brute.health,
      speed: GameConfig.enemies.brute.speed,
      damage: GameConfig.enemies.brute.damage,
      structureDamage: GameConfig.enemies.brute.structureDamage,
      bounty: GameConfig.enemies.brute.bounty,
      path: null,
      pathIndex: 0,
      interpolation: 0,
      isAttackingBarrier: false,
      attackCooldown: 0,
    };
    return enemy;
  }
}

/**
 * SpawnSystem class - manages wave spawning with staggered intervals.
 */
export class SpawnSystem {
  private entityStore: EntityStore;
  private pathfinding: PathfindingSystem;
  private gridWidth: number;
  private gridHeight: number;
  private spawnState: SpawnState | null = null;
  private rng: () => number;

  constructor(
    entityStore: EntityStore,
    pathfinding: PathfindingSystem,
    gridWidth: number,
    gridHeight: number,
    rng?: () => number
  ) {
    this.entityStore = entityStore;
    this.pathfinding = pathfinding;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.rng = rng || Math.random;
  }

  /**
   * Begins a new wave, setting up the spawn queue and state.
   */
  beginWave(waveNumber: number): void {
    const composition = getWaveComposition(waveNumber);
    const queue = buildSpawnQueue(composition);
    const edges = selectSpawnEdges(this.rng);

    this.spawnState = {
      queue,
      edges,
      index: 0,
      timer: 0,
      interval: composition.spawnInterval,
      active: true,
    };

    log.info('Wave spawning started', {
      waveNumber,
      basicCount: composition.basicCount,
      bruteCount: composition.bruteCount,
      totalCount: composition.totalCount,
      interval: composition.spawnInterval,
      edges,
    });
  }

  /**
   * Updates the spawn system. Spawns enemies at staggered intervals.
   * @param dt - Time delta in seconds
   */
  update(dt: number): void {
    if (!this.spawnState || !this.spawnState.active) return;

    this.spawnState.timer += dt;

    while (
      this.spawnState.timer >= this.spawnState.interval &&
      this.spawnState.index < this.spawnState.queue.length
    ) {
      this.spawnState.timer -= this.spawnState.interval;
      this.spawnEnemy();
    }

    // Check if all enemies have been spawned
    if (this.spawnState.index >= this.spawnState.queue.length) {
      this.spawnState.active = false;
    }
  }

  /**
   * Spawns a single enemy from the queue.
   */
  private spawnEnemy(): void {
    if (!this.spawnState) return;

    const enemyType = this.spawnState.queue[this.spawnState.index];
    const edge = this.spawnState.edges[this.spawnState.index % this.spawnState.edges.length];

    let position = getSpawnPosition(edge, this.gridWidth, this.gridHeight, this.rng);

    // Try to find a path from this position
    let path = this.pathfinding.findPathToCore(position);

    // If pathfinding fails from initial position, try alternative spawn positions
    if (!path) {
      log.warn('Pathfinding failed from spawn position, trying alternatives', {
        edge,
        position,
        enemyType,
      });
      path = this.tryAlternativeSpawnPositions(edge);
      if (path) {
        position = path.waypoints[0];
      } else {
        log.error('All spawn positions failed pathfinding', { edge, enemyType });
      }
    }

    const id = crypto.randomUUID();
    const enemy = createEnemyEntity(enemyType, position, id);
    enemy.path = path;

    addEntity(this.entityStore, enemy);
    this.spawnState.index++;

    log.debug('Enemy spawned', {
      id: id.slice(0, 8),
      type: enemyType,
      edge,
      position,
      hasPath: !!path,
      remaining: this.spawnState.queue.length - this.spawnState.index,
    });
  }

  /**
   * Tries alternative spawn positions when pathfinding fails from the initial position.
   * Tries other edges and positions until a valid path is found.
   */
  private tryAlternativeSpawnPositions(failedEdge: SpawnEdge): ReturnType<PathfindingSystem['findPathToCore']> {
    const allEdges: SpawnEdge[] = ['top', 'bottom', 'left', 'right'];
    const otherEdges = allEdges.filter(e => e !== failedEdge);

    for (const edge of otherEdges) {
      // Try multiple positions on each edge
      for (let attempt = 0; attempt < 5; attempt++) {
        const pos = getSpawnPosition(edge, this.gridWidth, this.gridHeight, this.rng);
        const path = this.pathfinding.findPathToCore(pos);
        if (path) return path;
      }
    }

    return null;
  }

  /**
   * Returns whether spawning is currently active.
   */
  isActive(): boolean {
    return this.spawnState?.active ?? false;
  }

  /**
   * Returns the number of enemies remaining to be spawned.
   */
  getEnemiesRemainingToSpawn(): number {
    if (!this.spawnState) return 0;
    return this.spawnState.queue.length - this.spawnState.index;
  }

  /**
   * Resets the spawn system state.
   */
  reset(): void {
    this.spawnState = null;
  }
}
