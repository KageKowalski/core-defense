/**
 * Unit tests for the Movement System.
 */

import { describe, it, expect } from 'vitest';
import { updateEnemyMovement, lerpWorldPosition, MovementEvent } from './movement';
import { Enemy, Structure } from '../models/entities';
import { GridPosition } from '../models/grid';
import { GameConfig } from '../models/config';
import { createEnemyEntity } from './spawning';

describe('lerpWorldPosition', () => {
  it('returns start position at t=0', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 10, y: 5, z: 10 };
    const result = lerpWorldPosition(a, b, 0);
    expect(result).toEqual(a);
  });

  it('returns end position at t=1', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 10, y: 5, z: 10 };
    const result = lerpWorldPosition(a, b, 1);
    expect(result).toEqual(b);
  });

  it('returns midpoint at t=0.5', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 10, y: 4, z: 8 };
    const result = lerpWorldPosition(a, b, 0.5);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(2);
    expect(result.z).toBeCloseTo(4);
  });
});

describe('updateEnemyMovement', () => {
  function createTestEnemy(type: 'basic_enemy' | 'brute_enemy', path: GridPosition[]): Enemy {
    const enemy = createEnemyEntity(type, path[0], 'test-enemy');
    enemy.path = { waypoints: path, totalCost: path.length - 1 };
    enemy.pathIndex = 0;
    enemy.interpolation = 0;
    return enemy;
  }

  describe('basic movement', () => {
    it('moves basic enemy at 2 cells/sec', () => {
      const path: GridPosition[] = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
        { row: 3, col: 0 },
      ];
      const enemy = createTestEnemy('basic_enemy', path);

      // After 0.5 seconds at 2 cells/sec = 1 cell moved
      updateEnemyMovement(0.5, enemy);
      expect(enemy.pathIndex).toBe(1);
      expect(enemy.position).toEqual({ row: 1, col: 0 });
    });

    it('moves brute enemy at 1 cell/sec', () => {
      const path: GridPosition[] = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
        { row: 3, col: 0 },
      ];
      const enemy = createTestEnemy('brute_enemy', path);

      // After 0.5 seconds at 1 cell/sec = 0.5 cells (not yet at next waypoint)
      updateEnemyMovement(0.5, enemy);
      expect(enemy.pathIndex).toBe(0);
      expect(enemy.interpolation).toBeCloseTo(0.5);
    });

    it('brute reaches next waypoint after 1 second', () => {
      const path: GridPosition[] = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
      ];
      const enemy = createTestEnemy('brute_enemy', path);

      updateEnemyMovement(1.0, enemy);
      expect(enemy.pathIndex).toBe(1);
      expect(enemy.position).toEqual({ row: 1, col: 0 });
    });
  });

  describe('reaching core', () => {
    it('returns reached_core event when enemy reaches end of path', () => {
      const path: GridPosition[] = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
      ];
      const enemy = createTestEnemy('basic_enemy', path);

      const events = updateEnemyMovement(0.5, enemy);
      expect(events).toContainEqual({
        type: 'reached_core',
        enemyId: 'test-enemy',
        damage: GameConfig.enemies.basic.damage,
      });
    });

    it('brute reaching core deals 25 damage', () => {
      const path: GridPosition[] = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
      ];
      const enemy = createTestEnemy('brute_enemy', path);

      const events = updateEnemyMovement(1.0, enemy);
      expect(events).toContainEqual({
        type: 'reached_core',
        enemyId: 'test-enemy',
        damage: GameConfig.enemies.brute.damage,
      });
    });
  });

  describe('barrier attack (Brute)', () => {
    it('brute switches to attack mode when next waypoint has a barrier', () => {
      const path: GridPosition[] = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 }, // barrier here
        { row: 3, col: 0 },
      ];
      const enemy = createTestEnemy('brute_enemy', path);

      const mockBarrier: Structure = {
        id: 'barrier-1',
        type: 'barrier',
        position: { row: 2, col: 0 },
        worldPosition: { x: 0.5, y: 0, z: 2.5 },
        maxHealth: 150,
        currentHealth: 150,
        originalCost: 10,
      };

      const getBarrier = (pos: GridPosition) => {
        if (pos.row === 2 && pos.col === 0) return mockBarrier;
        return null;
      };

      // Move brute to waypoint 1 (takes 1 second)
      updateEnemyMovement(1.0, enemy, getBarrier);

      // Brute should now be attacking the barrier
      expect(enemy.isAttackingBarrier).toBe(true);
    });

    it('brute deals 25 damage to barrier per hit', () => {
      const path: GridPosition[] = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 }, // barrier
      ];
      const enemy = createTestEnemy('brute_enemy', path);
      enemy.pathIndex = 1;
      enemy.position = { row: 1, col: 0 };
      enemy.isAttackingBarrier = true;
      enemy.attackCooldown = 0; // Ready to attack

      const mockBarrier: Structure = {
        id: 'barrier-1',
        type: 'barrier',
        position: { row: 2, col: 0 },
        worldPosition: { x: 0.5, y: 0, z: 2.5 },
        maxHealth: 150,
        currentHealth: 150,
        originalCost: 10,
      };

      const getBarrier = (pos: GridPosition) => {
        if (pos.row === 2 && pos.col === 0) return mockBarrier;
        return null;
      };

      updateEnemyMovement(0.01, enemy, getBarrier);
      expect(mockBarrier.currentHealth).toBe(125);
    });

    it('barrier destroyed event when health reaches 0', () => {
      const path: GridPosition[] = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
      ];
      const enemy = createTestEnemy('brute_enemy', path);
      enemy.pathIndex = 1;
      enemy.position = { row: 1, col: 0 };
      enemy.isAttackingBarrier = true;
      enemy.attackCooldown = 0;

      const mockBarrier: Structure = {
        id: 'barrier-1',
        type: 'barrier',
        position: { row: 2, col: 0 },
        worldPosition: { x: 0.5, y: 0, z: 2.5 },
        maxHealth: 150,
        currentHealth: 20, // Will be destroyed
        originalCost: 10,
      };

      const getBarrier = (pos: GridPosition) => {
        if (pos.row === 2 && pos.col === 0) return mockBarrier;
        return null;
      };

      const events = updateEnemyMovement(0.01, enemy, getBarrier);
      expect(events).toContainEqual({
        type: 'barrier_destroyed',
        enemyId: 'test-enemy',
        barrierId: 'barrier-1',
      });
      expect(enemy.isAttackingBarrier).toBe(false);
    });

    it('brute attacks at 1 hit per second', () => {
      const path: GridPosition[] = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
      ];
      const enemy = createTestEnemy('brute_enemy', path);
      enemy.pathIndex = 1;
      enemy.position = { row: 1, col: 0 };
      enemy.isAttackingBarrier = true;
      enemy.attackCooldown = 0;

      const mockBarrier: Structure = {
        id: 'barrier-1',
        type: 'barrier',
        position: { row: 2, col: 0 },
        worldPosition: { x: 0.5, y: 0, z: 2.5 },
        maxHealth: 150,
        currentHealth: 150,
        originalCost: 10,
      };

      const getBarrier = (pos: GridPosition) => {
        if (pos.row === 2 && pos.col === 0) return mockBarrier;
        return null;
      };

      // First hit
      updateEnemyMovement(0.01, enemy, getBarrier);
      expect(mockBarrier.currentHealth).toBe(125);

      // Not enough time for second hit (only 0.5s passed)
      updateEnemyMovement(0.5, enemy, getBarrier);
      expect(mockBarrier.currentHealth).toBe(125);

      // After total 1s cooldown, second hit
      updateEnemyMovement(0.5, enemy, getBarrier);
      expect(mockBarrier.currentHealth).toBe(100);
    });
  });

  describe('no path scenarios', () => {
    it('returns empty events when enemy has no path', () => {
      const enemy = createEnemyEntity('basic_enemy', { row: 0, col: 0 }, 'no-path');
      enemy.path = null;

      const events = updateEnemyMovement(1.0, enemy);
      expect(events).toEqual([]);
    });

    it('returns empty events when path is empty', () => {
      const enemy = createEnemyEntity('basic_enemy', { row: 0, col: 0 }, 'empty-path');
      enemy.path = { waypoints: [], totalCost: 0 };

      const events = updateEnemyMovement(1.0, enemy);
      expect(events).toEqual([]);
    });
  });

  describe('interpolation for smooth rendering', () => {
    it('world position is interpolated between waypoints', () => {
      const path: GridPosition[] = [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ];
      const enemy = createTestEnemy('basic_enemy', path);

      // Move 0.25 seconds at 2 cells/sec = 0.5 cells
      updateEnemyMovement(0.25, enemy);

      // Should be halfway between waypoint 0 and 1
      const cellSize = GameConfig.grid.cellSize;
      expect(enemy.worldPosition.x).toBeCloseTo(0.5 * cellSize + cellSize / 2);
    });
  });
});
