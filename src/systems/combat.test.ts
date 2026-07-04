/**
 * Unit tests for the CombatSystem.
 */

import { describe, it, expect } from 'vitest';
import {
  selectTarget,
  createProjectile,
  applyAOEDamage,
  gridDistance,
  worldDistance,
  CombatSystem,
} from './combat';
import { Tower, Enemy, Projectile } from '../models/entities';
import { GridPosition, WorldPosition } from '../models/grid';
import { GameConfig } from '../models/config';
import { createEntityStore, EntityStore, addEntity } from '../models/entity-store';
import { createEnemyEntity } from './spawning';

// Helper to create a test tower
function createTestTower(
  type: 'basic_tower' | 'sniper_tower' | 'aoe_tower',
  position: GridPosition,
  overrides?: Partial<Tower>
): Tower {
  const config = GameConfig.structures[type];
  const tower: Tower = {
    id: `tower-${type}`,
    type,
    position,
    worldPosition: { x: position.col + 0.5, y: 0, z: position.row + 0.5 },
    maxHealth: config.maxHealth,
    currentHealth: config.maxHealth,
    originalCost: config.cost,
    range: config.range,
    damage: config.damage,
    fireRate: config.fireRate,
    fireCooldown: 0,
    targetId: null,
    targetingPriority: config.targetingPriority,
    ...('aoeRadius' in config ? { aoeRadius: config.aoeRadius } : {}),
    ...overrides,
  };
  return tower;
}

// Helper to create a test enemy with path
function createTestEnemyWithPath(
  id: string,
  position: GridPosition,
  pathCost: number,
  pathIndex: number = 0,
  health?: number
): Enemy {
  const enemy = createEnemyEntity('basic_enemy', position, id);
  const waypoints: GridPosition[] = [];
  for (let i = 0; i <= pathCost; i++) {
    waypoints.push({ row: position.row + i, col: position.col });
  }
  enemy.path = { waypoints, totalCost: pathCost };
  enemy.pathIndex = pathIndex;
  if (health !== undefined) {
    enemy.currentHealth = health;
  }
  return enemy;
}

describe('gridDistance', () => {
  it('returns 0 for same position', () => {
    expect(gridDistance({ row: 5, col: 5 }, { row: 5, col: 5 })).toBe(0);
  });

  it('returns 1 for adjacent positions (horizontal)', () => {
    expect(gridDistance({ row: 5, col: 5 }, { row: 5, col: 6 })).toBe(1);
  });

  it('returns 1 for adjacent positions (vertical)', () => {
    expect(gridDistance({ row: 5, col: 5 }, { row: 6, col: 5 })).toBe(1);
  });

  it('returns correct diagonal distance', () => {
    const dist = gridDistance({ row: 0, col: 0 }, { row: 3, col: 4 });
    expect(dist).toBeCloseTo(5);
  });
});

describe('worldDistance', () => {
  it('returns 0 for same position', () => {
    expect(worldDistance({ x: 1, y: 0, z: 1 }, { x: 1, y: 0, z: 1 })).toBe(0);
  });

  it('calculates 3D distance correctly', () => {
    const dist = worldDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 });
    expect(dist).toBeCloseTo(5);
  });
});

describe('selectTarget', () => {
  describe('closest_to_core priority (Basic/AOE Tower)', () => {
    it('selects enemy with shortest remaining path to core', () => {
      const tower = createTestTower('basic_tower', { row: 5, col: 5 });

      const enemy1 = createTestEnemyWithPath('e1', { row: 5, col: 6 }, 10, 2); // remaining: 8
      const enemy2 = createTestEnemyWithPath('e2', { row: 5, col: 7 }, 5, 1); // remaining: 4
      const enemy3 = createTestEnemyWithPath('e3', { row: 4, col: 5 }, 15, 5); // remaining: 10

      const target = selectTarget(tower, [enemy1, enemy2, enemy3]);
      expect(target?.id).toBe('e2');
    });

    it('returns null when no enemies in range', () => {
      const tower = createTestTower('basic_tower', { row: 5, col: 5 });
      // Place enemy far outside range (range = 3)
      const enemy = createTestEnemyWithPath('e1', { row: 15, col: 15 }, 10);

      const target = selectTarget(tower, [enemy]);
      expect(target).toBeNull();
    });

    it('considers only enemies within range', () => {
      const tower = createTestTower('basic_tower', { row: 5, col: 5 });

      // In range (distance ~2.2)
      const inRange = createTestEnemyWithPath('in', { row: 6, col: 7 }, 10, 5);
      // Out of range (distance ~5.6)
      const outRange = createTestEnemyWithPath('out', { row: 9, col: 9 }, 3, 0);

      const target = selectTarget(tower, [inRange, outRange]);
      expect(target?.id).toBe('in');
    });
  });

  describe('highest_health priority (Sniper Tower)', () => {
    it('selects enemy with highest current health', () => {
      const tower = createTestTower('sniper_tower', { row: 5, col: 5 });

      const enemy1 = createTestEnemyWithPath('e1', { row: 5, col: 6 }, 10, 0, 30);
      const enemy2 = createTestEnemyWithPath('e2', { row: 5, col: 7 }, 10, 0, 50);
      const enemy3 = createTestEnemyWithPath('e3', { row: 4, col: 5 }, 10, 0, 20);

      const target = selectTarget(tower, [enemy1, enemy2, enemy3]);
      expect(target?.id).toBe('e2');
    });

    it('sniper tower has range 6', () => {
      const tower = createTestTower('sniper_tower', { row: 5, col: 5 });

      // Enemy at distance ~5.6 (within range 6)
      const farEnemy = createTestEnemyWithPath('far', { row: 9, col: 9 }, 10, 0, 100);

      const target = selectTarget(tower, [farEnemy]);
      expect(target?.id).toBe('far');
    });
  });

  describe('AOE tower targeting', () => {
    it('aoe tower uses closest_to_core priority', () => {
      const tower = createTestTower('aoe_tower', { row: 5, col: 5 });

      const enemy1 = createTestEnemyWithPath('e1', { row: 5, col: 6 }, 10, 8); // remaining: 2
      const enemy2 = createTestEnemyWithPath('e2', { row: 5, col: 4 }, 10, 3); // remaining: 7

      const target = selectTarget(tower, [enemy1, enemy2]);
      expect(target?.id).toBe('e1');
    });
  });

  describe('towers remain idle with no enemies', () => {
    it('returns null for empty enemy list', () => {
      const tower = createTestTower('basic_tower', { row: 5, col: 5 });
      const target = selectTarget(tower, []);
      expect(target).toBeNull();
    });
  });
});

describe('createProjectile', () => {
  it('creates a projectile from tower to target', () => {
    const tower = createTestTower('basic_tower', { row: 5, col: 5 });
    const enemy = createTestEnemyWithPath('e1', { row: 6, col: 5 }, 10);

    const projectile = createProjectile(tower, enemy);
    expect(projectile.type).toBe('projectile');
    expect(projectile.sourceId).toBe(tower.id);
    expect(projectile.targetId).toBe(enemy.id);
    expect(projectile.damage).toBe(tower.damage);
    expect(projectile.isAOE).toBe(false);
    expect(projectile.aoeRadius).toBe(0);
  });

  it('creates AOE projectile for AOE tower', () => {
    const tower = createTestTower('aoe_tower', { row: 5, col: 5 });
    const enemy = createTestEnemyWithPath('e1', { row: 6, col: 5 }, 10);

    const projectile = createProjectile(tower, enemy);
    expect(projectile.isAOE).toBe(true);
    expect(projectile.aoeRadius).toBe(GameConfig.structures.aoe_tower.aoeRadius);
  });

  it('projectile starts at tower position', () => {
    const tower = createTestTower('basic_tower', { row: 5, col: 5 });
    const enemy = createTestEnemyWithPath('e1', { row: 6, col: 5 }, 10);

    const projectile = createProjectile(tower, enemy);
    expect(projectile.worldPosition).toEqual(tower.worldPosition);
  });
});

describe('applyAOEDamage', () => {
  it('damages all enemies within radius', () => {
    const impactPos: GridPosition = { row: 5, col: 5 };
    const enemies = [
      createTestEnemyWithPath('e1', { row: 5, col: 5 }, 10), // distance 0
      createTestEnemyWithPath('e2', { row: 5, col: 6 }, 10), // distance 1
      createTestEnemyWithPath('e3', { row: 6, col: 5 }, 10), // distance 1
    ];

    const affected = applyAOEDamage(impactPos, 1, 20, enemies);
    expect(affected.length).toBe(3);
    expect(enemies[0].currentHealth).toBe(GameConfig.enemies.basic.health - 20);
    expect(enemies[1].currentHealth).toBe(GameConfig.enemies.basic.health - 20);
    expect(enemies[2].currentHealth).toBe(GameConfig.enemies.basic.health - 20);
  });

  it('does not damage enemies outside radius', () => {
    const impactPos: GridPosition = { row: 5, col: 5 };
    const enemies = [
      createTestEnemyWithPath('e1', { row: 5, col: 5 }, 10), // distance 0 - in
      createTestEnemyWithPath('e2', { row: 5, col: 7 }, 10), // distance 2 - out
      createTestEnemyWithPath('e3', { row: 7, col: 5 }, 10), // distance 2 - out
    ];

    const affected = applyAOEDamage(impactPos, 1, 20, enemies);
    expect(affected.length).toBe(1);
    expect(affected[0].id).toBe('e1');
    expect(enemies[1].currentHealth).toBe(GameConfig.enemies.basic.health); // unchanged
    expect(enemies[2].currentHealth).toBe(GameConfig.enemies.basic.health); // unchanged
  });

  it('includes primary target in AOE damage', () => {
    const impactPos: GridPosition = { row: 5, col: 5 };
    const primary = createTestEnemyWithPath('primary', { row: 5, col: 5 }, 10);
    const nearby = createTestEnemyWithPath('nearby', { row: 5, col: 6 }, 10);

    const affected = applyAOEDamage(impactPos, 1, 20, [primary, nearby]);
    expect(affected).toContainEqual(expect.objectContaining({ id: 'primary' }));
  });

  it('uses Euclidean distance for radius check', () => {
    const impactPos: GridPosition = { row: 5, col: 5 };
    // Diagonal distance = sqrt(2) ≈ 1.41, which is > 1
    const diagonalEnemy = createTestEnemyWithPath('diag', { row: 6, col: 6 }, 10);

    const affected = applyAOEDamage(impactPos, 1, 20, [diagonalEnemy]);
    expect(affected.length).toBe(0); // Outside 1-cell radius
  });

  it('enemy at exactly radius distance is included', () => {
    const impactPos: GridPosition = { row: 5, col: 5 };
    const edgeEnemy = createTestEnemyWithPath('edge', { row: 5, col: 6 }, 10); // distance exactly 1

    const affected = applyAOEDamage(impactPos, 1, 20, [edgeEnemy]);
    expect(affected.length).toBe(1);
  });
});

describe('CombatSystem', () => {
  function createTestStore(): EntityStore {
    const cr = {
      id: 'cr',
      type: 'critical_resource' as const,
      position: { row: 9, col: 9 },
      worldPosition: { x: 9.5, y: 0, z: 9.5 },
      maxHealth: 100,
      currentHealth: 100,
      cells: [],
    };
    return createEntityStore(cr);
  }

  it('tower fires at enemy in range', () => {
    const store = createTestStore();
    const tower = createTestTower('basic_tower', { row: 5, col: 5 });
    const enemy = createTestEnemyWithPath('e1', { row: 5, col: 6 }, 10);
    enemy.worldPosition = { x: 6.5, y: 0, z: 5.5 };

    addEntity(store, tower);
    addEntity(store, enemy);

    const system = new CombatSystem(store);
    system.update(0.016); // One frame

    // Should have created a projectile
    expect(store.projectiles.size).toBe(1);
  });

  it('tower respects fire cooldown', () => {
    const store = createTestStore();
    const tower = createTestTower('basic_tower', { row: 5, col: 5 });
    tower.fireCooldown = 0.5; // Still on cooldown

    const enemy = createTestEnemyWithPath('e1', { row: 5, col: 6 }, 10);
    enemy.worldPosition = { x: 6.5, y: 0, z: 5.5 };

    addEntity(store, tower);
    addEntity(store, enemy);

    const system = new CombatSystem(store);
    system.update(0.1); // Not enough to overcome cooldown

    expect(store.projectiles.size).toBe(0);
  });

  it('tower re-selects target when current target is out of range', () => {
    const store = createTestStore();
    const tower = createTestTower('basic_tower', { row: 5, col: 5 });
    tower.targetId = 'old-target'; // Target that doesn't exist

    const enemy = createTestEnemyWithPath('e1', { row: 5, col: 6 }, 10);
    enemy.worldPosition = { x: 6.5, y: 0, z: 5.5 };

    addEntity(store, tower);
    addEntity(store, enemy);

    const system = new CombatSystem(store);
    system.update(0.016);

    // Should have selected new target and fired
    expect(store.projectiles.size).toBe(1);
    expect(tower.targetId).toBe('e1');
  });

  it('tower does not fire when no enemy is in range', () => {
    const store = createTestStore();
    const tower = createTestTower('basic_tower', { row: 5, col: 5 });
    // Place enemy far away (out of range 3)
    const enemy = createTestEnemyWithPath('e1', { row: 15, col: 15 }, 10);
    enemy.worldPosition = { x: 15.5, y: 0, z: 15.5 };

    addEntity(store, tower);
    addEntity(store, enemy);

    const system = new CombatSystem(store);
    system.update(0.016);

    expect(store.projectiles.size).toBe(0);
  });

  it('cooldown is set to 1/fireRate after firing', () => {
    const store = createTestStore();
    const tower = createTestTower('basic_tower', { row: 5, col: 5 });
    const enemy = createTestEnemyWithPath('e1', { row: 5, col: 6 }, 10);
    enemy.worldPosition = { x: 6.5, y: 0, z: 5.5 };

    addEntity(store, tower);
    addEntity(store, enemy);

    const system = new CombatSystem(store);
    system.update(0.016);

    expect(tower.fireCooldown).toBeCloseTo(1 / GameConfig.structures.basic_tower.fireRate);
  });

  it('projectile dissipates when target is destroyed', () => {
    const store = createTestStore();
    const tower = createTestTower('basic_tower', { row: 5, col: 5 });

    addEntity(store, tower);

    // Manually add a projectile targeting a non-existent enemy
    const projectile: Projectile = {
      id: 'proj-1',
      type: 'projectile',
      position: { row: 5, col: 5 },
      worldPosition: { x: 5.5, y: 0, z: 5.5 },
      sourceId: tower.id,
      targetId: 'dead-enemy', // Does not exist
      damage: 15,
      speed: 10,
      isAOE: false,
      aoeRadius: 0,
      targetPosition: { x: 6.5, y: 0, z: 5.5 },
    };
    addEntity(store, projectile);

    const system = new CombatSystem(store);
    system.update(0.016);

    // Projectile should be removed
    expect(store.projectiles.size).toBe(0);
  });
});
