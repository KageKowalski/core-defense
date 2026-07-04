import { describe, it, expect } from 'vitest';
import { createEntityStore, addEntity, removeEntity, getById, getEnemiesInRange, getActiveEnemyCount } from './entity-store';
import { CriticalResource, Enemy, Structure, Projectile } from './entities';

function makeCriticalResource(): CriticalResource {
  return {
    id: 'cr-1',
    type: 'critical_resource',
    position: { row: 9, col: 9 },
    worldPosition: { x: 9.5, y: 0, z: 9.5 },
    maxHealth: 100,
    currentHealth: 100,
    cells: [
      { row: 9, col: 9 },
      { row: 9, col: 10 },
      { row: 10, col: 9 },
      { row: 10, col: 10 },
    ],
  };
}

function makeEnemy(id: string, row: number, col: number): Enemy {
  return {
    id,
    type: 'basic_enemy',
    position: { row, col },
    worldPosition: { x: col + 0.5, y: 0, z: row + 0.5 },
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

function makeBarrier(id: string, row: number, col: number): Structure {
  return {
    id,
    type: 'barrier',
    position: { row, col },
    worldPosition: { x: col + 0.5, y: 0, z: row + 0.5 },
    maxHealth: 150,
    currentHealth: 150,
    originalCost: 10,
  };
}

describe('EntityStore', () => {
  it('should create with empty collections', () => {
    const store = createEntityStore(makeCriticalResource());
    expect(store.structures.size).toBe(0);
    expect(store.enemies.size).toBe(0);
    expect(store.projectiles.size).toBe(0);
    expect(store.criticalResource.id).toBe('cr-1');
  });

  it('should add structures', () => {
    const store = createEntityStore(makeCriticalResource());
    const barrier = makeBarrier('b-1', 5, 5);
    addEntity(store, barrier);
    expect(store.structures.size).toBe(1);
    expect(store.structures.get('b-1')).toBe(barrier);
  });

  it('should add enemies', () => {
    const store = createEntityStore(makeCriticalResource());
    const enemy = makeEnemy('e-1', 0, 0);
    addEntity(store, enemy);
    expect(store.enemies.size).toBe(1);
    expect(store.enemies.get('e-1')).toBe(enemy);
  });

  it('should remove entities', () => {
    const store = createEntityStore(makeCriticalResource());
    addEntity(store, makeBarrier('b-1', 3, 3));
    addEntity(store, makeEnemy('e-1', 0, 0));

    expect(removeEntity(store, 'b-1')).toBe(true);
    expect(store.structures.size).toBe(0);

    expect(removeEntity(store, 'e-1')).toBe(true);
    expect(store.enemies.size).toBe(0);

    expect(removeEntity(store, 'nonexistent')).toBe(false);
  });

  it('should get entity by ID', () => {
    const store = createEntityStore(makeCriticalResource());
    const barrier = makeBarrier('b-1', 5, 5);
    addEntity(store, barrier);

    expect(getById(store, 'b-1')).toBe(barrier);
    expect(getById(store, 'cr-1')).toBe(store.criticalResource);
    expect(getById(store, 'nonexistent')).toBeNull();
  });

  it('should get active enemy count', () => {
    const store = createEntityStore(makeCriticalResource());
    addEntity(store, makeEnemy('e-1', 0, 0));
    addEntity(store, makeEnemy('e-2', 1, 1));
    expect(getActiveEnemyCount(store)).toBe(2);
  });
});

describe('getEnemiesInRange', () => {
  it('should return enemies within Euclidean distance', () => {
    const store = createEntityStore(makeCriticalResource());
    addEntity(store, makeEnemy('e-1', 5, 5)); // distance 0 from (5,5)
    addEntity(store, makeEnemy('e-2', 6, 5)); // distance 1 from (5,5)
    addEntity(store, makeEnemy('e-3', 8, 5)); // distance 3 from (5,5)
    addEntity(store, makeEnemy('e-4', 10, 10)); // distance ~7.07 from (5,5)

    const inRange = getEnemiesInRange(store, { row: 5, col: 5 }, 3);
    expect(inRange.length).toBe(3);
    expect(inRange.map(e => e.id).sort()).toEqual(['e-1', 'e-2', 'e-3']);
  });

  it('should return empty array when no enemies in range', () => {
    const store = createEntityStore(makeCriticalResource());
    addEntity(store, makeEnemy('e-1', 15, 15));

    const inRange = getEnemiesInRange(store, { row: 0, col: 0 }, 3);
    expect(inRange.length).toBe(0);
  });

  it('should use Euclidean distance correctly (diagonal)', () => {
    const store = createEntityStore(makeCriticalResource());
    // Enemy at (1,1) is sqrt(2) ≈ 1.414 from (0,0)
    addEntity(store, makeEnemy('e-1', 1, 1));

    expect(getEnemiesInRange(store, { row: 0, col: 0 }, 1).length).toBe(0);
    expect(getEnemiesInRange(store, { row: 0, col: 0 }, 1.5).length).toBe(1);
  });
});
