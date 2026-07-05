/**
 * Unit tests for the SpawnSystem.
 */

import { describe, it, expect } from 'vitest';
import {
  getWaveComposition,
  selectSpawnEdges,
  getSpawnPosition,
  clamp,
  createEnemyEntity,
  SpawnSystem,
  SpawnEdge,
} from './spawning';
import { GameConfig } from '../models/config';

describe('getWaveComposition', () => {
  it('returns correct composition for wave 1', () => {
    const comp = getWaveComposition(1);
    expect(comp.totalCount).toBe(5);
    expect(comp.bruteCount).toBe(0);
    expect(comp.basicCount).toBe(5);
  });

  it('returns correct composition for wave 2', () => {
    const comp = getWaveComposition(2);
    expect(comp.totalCount).toBe(7);
    expect(comp.bruteCount).toBe(0);
    expect(comp.basicCount).toBe(7);
  });

  it('returns correct composition for wave 3', () => {
    const comp = getWaveComposition(3);
    expect(comp.totalCount).toBe(9);
    expect(comp.bruteCount).toBe(0);
    expect(comp.basicCount).toBe(9);
  });

  it('returns correct composition for wave 4 (first brutes)', () => {
    const comp = getWaveComposition(4);
    expect(comp.totalCount).toBe(11);
    expect(comp.bruteCount).toBe(1);
    expect(comp.basicCount).toBe(10);
  });

  it('returns correct composition for wave 5', () => {
    const comp = getWaveComposition(5);
    expect(comp.totalCount).toBe(13);
    expect(comp.bruteCount).toBe(2);
    expect(comp.basicCount).toBe(11);
  });

  it('returns correct composition for wave 10', () => {
    const comp = getWaveComposition(10);
    expect(comp.totalCount).toBe(23);
    expect(comp.bruteCount).toBe(7);
    expect(comp.basicCount).toBe(16);
  });

  it('spawn interval is clamped between 0.3 and 2.0', () => {
    for (let wave = 1; wave <= 30; wave++) {
      const comp = getWaveComposition(wave);
      expect(comp.spawnInterval).toBeGreaterThanOrEqual(0.3);
      expect(comp.spawnInterval).toBeLessThanOrEqual(2.0);
    }
  });

  it('spawn interval decreases as wave number increases', () => {
    const comp1 = getWaveComposition(1);
    const comp5 = getWaveComposition(5);
    expect(comp5.spawnInterval).toBeLessThanOrEqual(comp1.spawnInterval);
  });
});

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(1.0, 0.3, 2.0)).toBe(1.0);
  });

  it('returns min when value is below min', () => {
    expect(clamp(0.1, 0.3, 2.0)).toBe(0.3);
  });

  it('returns max when value is above max', () => {
    expect(clamp(3.0, 0.3, 2.0)).toBe(2.0);
  });
});

describe('selectSpawnEdges', () => {
  it('selects at least 2 edges', () => {
    // Use deterministic rng
    let callCount = 0;
    const rng = () => {
      callCount++;
      return 0.5;
    };
    const edges = selectSpawnEdges(rng);
    expect(edges.length).toBeGreaterThanOrEqual(2);
  });

  it('selects at most 4 edges', () => {
    const rng = () => 0.99;
    const edges = selectSpawnEdges(rng);
    expect(edges.length).toBeLessThanOrEqual(4);
  });

  it('returns only valid edge values', () => {
    const validEdges: SpawnEdge[] = ['top', 'bottom', 'left', 'right'];
    for (let i = 0; i < 20; i++) {
      const edges = selectSpawnEdges();
      for (const edge of edges) {
        expect(validEdges).toContain(edge);
      }
    }
  });

  it('returns unique edges (no duplicates)', () => {
    for (let i = 0; i < 20; i++) {
      const edges = selectSpawnEdges();
      const unique = new Set(edges);
      expect(unique.size).toBe(edges.length);
    }
  });
});

describe('getSpawnPosition', () => {
  const gridWidth = 20;
  const gridHeight = 20;

  it('top edge: row is 0, col is within grid', () => {
    const rng = () => 0.5;
    const pos = getSpawnPosition('top', gridWidth, gridHeight, rng);
    expect(pos.row).toBe(0);
    expect(pos.col).toBeGreaterThanOrEqual(0);
    expect(pos.col).toBeLessThan(gridWidth);
  });

  it('bottom edge: row is gridHeight - 1, col is within grid', () => {
    const rng = () => 0.5;
    const pos = getSpawnPosition('bottom', gridWidth, gridHeight, rng);
    expect(pos.row).toBe(gridHeight - 1);
    expect(pos.col).toBeGreaterThanOrEqual(0);
    expect(pos.col).toBeLessThan(gridWidth);
  });

  it('left edge: col is 0, row is within grid', () => {
    const rng = () => 0.5;
    const pos = getSpawnPosition('left', gridWidth, gridHeight, rng);
    expect(pos.col).toBe(0);
    expect(pos.row).toBeGreaterThanOrEqual(0);
    expect(pos.row).toBeLessThan(gridHeight);
  });

  it('right edge: col is gridWidth - 1, row is within grid', () => {
    const rng = () => 0.5;
    const pos = getSpawnPosition('right', gridWidth, gridHeight, rng);
    expect(pos.col).toBe(gridWidth - 1);
    expect(pos.row).toBeGreaterThanOrEqual(0);
    expect(pos.row).toBeLessThan(gridHeight);
  });
});

describe('createEnemyEntity', () => {
  it('creates a basic enemy with correct stats', () => {
    const enemy = createEnemyEntity('basic_enemy', { row: 0, col: 0 }, 'test-id');
    expect(enemy.type).toBe('basic_enemy');
    expect(enemy.maxHealth).toBe(GameConfig.enemies.basic.health);
    expect(enemy.currentHealth).toBe(GameConfig.enemies.basic.health);
    expect(enemy.speed).toBe(GameConfig.enemies.basic.speed);
    expect(enemy.damage).toBe(GameConfig.enemies.basic.damage);
    expect(enemy.bounty).toBe(GameConfig.enemies.basic.bounty);
    expect(enemy.path).toBeNull();
    expect(enemy.pathIndex).toBe(0);
    expect(enemy.interpolation).toBe(0);
    expect(enemy.isAttackingBarrier).toBe(false);
  });

  it('creates a brute enemy with correct stats', () => {
    const enemy = createEnemyEntity('brute_enemy', { row: 5, col: 5 }, 'brute-id');
    expect(enemy.type).toBe('brute_enemy');
    expect(enemy.maxHealth).toBe(GameConfig.enemies.brute.health);
    expect(enemy.currentHealth).toBe(GameConfig.enemies.brute.health);
    expect(enemy.speed).toBe(GameConfig.enemies.brute.speed);
    expect(enemy.damage).toBe(GameConfig.enemies.brute.damage);
    expect(enemy.structureDamage).toBe(GameConfig.enemies.brute.structureDamage);
    expect(enemy.bounty).toBe(GameConfig.enemies.brute.bounty);
  });

  it('sets position and world position correctly', () => {
    const pos = { row: 3, col: 7 };
    const enemy = createEnemyEntity('basic_enemy', pos, 'pos-test');
    expect(enemy.position).toEqual(pos);
    expect(enemy.worldPosition.x).toBe(7 * GameConfig.grid.cellSize + GameConfig.grid.cellSize / 2);
    expect(enemy.worldPosition.z).toBe(3 * GameConfig.grid.cellSize + GameConfig.grid.cellSize / 2);
  });
});

describe('SpawnSystem', () => {
  // Helper to create a mock pathfinding system
  function createMockPathfinding() {
    return {
      findPathToCore: (from: any) => ({
        waypoints: [from, { row: 10, col: 10 }],
        totalCost: 10,
      }),
      markDirty: () => {},
      isDirty: () => false,
      update: () => {},
      isCoreSealedOff: () => false,
      getWalkabilityGrid: () => [],
    } as any;
  }

  function createMockEntityStore() {
    return {
      structures: new Map(),
      enemies: new Map(),
      projectiles: new Map(),
      criticalResource: {
        id: 'cr',
        type: 'critical_resource' as const,
        position: { row: 9, col: 9 },
        worldPosition: { x: 9.5, y: 0, z: 9.5 },
        maxHealth: 100,
        currentHealth: 100,
        cells: [],
      },
    };
  }

  it('beginWave sets up spawn state', () => {
    const store = createMockEntityStore();
    const pathfinding = createMockPathfinding();
    const system = new SpawnSystem(store, pathfinding, 20, 20, () => 0.5);

    system.beginWave(1);
    expect(system.isActive()).toBe(true);
    expect(system.getEnemiesRemainingToSpawn()).toBe(5);
  });

  it('update spawns enemies over time', () => {
    const store = createMockEntityStore();
    const pathfinding = createMockPathfinding();
    const system = new SpawnSystem(store, pathfinding, 20, 20, () => 0.5);

    system.beginWave(1);
    const interval = getWaveComposition(1).spawnInterval;

    // After one interval, should spawn one enemy
    system.update(interval);
    expect(store.enemies.size).toBe(1);

    // After another interval, should spawn another
    system.update(interval);
    expect(store.enemies.size).toBe(2);
  });

  it('spawning becomes inactive after all enemies are spawned', () => {
    const store = createMockEntityStore();
    const pathfinding = createMockPathfinding();
    const system = new SpawnSystem(store, pathfinding, 20, 20, () => 0.5);

    system.beginWave(1);
    const comp = getWaveComposition(1);

    // Spawn all enemies
    system.update(comp.spawnInterval * (comp.totalCount + 1));
    expect(system.isActive()).toBe(false);
    expect(store.enemies.size).toBe(comp.totalCount);
  });

  it('reset clears spawn state', () => {
    const store = createMockEntityStore();
    const pathfinding = createMockPathfinding();
    const system = new SpawnSystem(store, pathfinding, 20, 20, () => 0.5);

    system.beginWave(1);
    system.reset();
    expect(system.isActive()).toBe(false);
    expect(system.getEnemiesRemainingToSpawn()).toBe(0);
  });
});
