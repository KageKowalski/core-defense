/**
 * CombatSystem - Manages tower targeting, projectile creation, and damage application.
 * Implements priority-based targeting, fire cooldowns, and AOE damage.
 */

import { GridPosition, WorldPosition, EntityId, gridToWorld } from '../models/grid';
import { Tower, Enemy, Projectile, Structure } from '../models/entities';
import { GameConfig } from '../models/config';
import { EntityStore, addEntity, removeEntity, getEnemiesInRange } from '../models/entity-store';
import { Logger } from '../utils/logger';

const log = Logger.create('Combat');

export type CombatEvent =
  | { type: 'enemy_destroyed'; enemyId: string; killedByTower: boolean }
  | { type: 'projectile_hit'; projectileId: string; targetId: string; damage: number }
  | { type: 'aoe_hit'; projectileId: string; affectedEnemyIds: string[]; damage: number };

/**
 * Calculates Euclidean distance between two grid positions (in grid cells).
 */
export function gridDistance(a: GridPosition, b: GridPosition): number {
  return Math.sqrt((a.row - b.row) ** 2 + (a.col - b.col) ** 2);
}

/**
 * Calculates Euclidean distance between two world positions.
 */
export function worldDistance(a: WorldPosition, b: WorldPosition): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Selects a target for a tower based on its targeting priority.
 * - Basic Tower / AOE Tower: closest to core by path distance (path.totalCost)
 * - Sniper Tower: highest current health
 *
 * Returns null if no valid target is in range.
 */
export function selectTarget(tower: Tower, enemies: Enemy[]): Enemy | null {
  // Filter enemies within range
  const inRange = enemies.filter(e => gridDistance(tower.position, e.position) <= tower.range);

  if (inRange.length === 0) return null;

  switch (tower.targetingPriority) {
    case 'closest_to_core':
      // Target enemy closest to core by remaining path distance
      return inRange.reduce((best, e) => {
        const eCost = e.path ? e.path.totalCost - e.pathIndex : Infinity;
        const bestCost = best.path ? best.path.totalCost - best.pathIndex : Infinity;
        return eCost < bestCost ? e : best;
      });

    case 'highest_health':
      // Target enemy with highest current health
      return inRange.reduce((best, e) =>
        e.currentHealth > best.currentHealth ? e : best
      );

    default:
      return inRange[0];
  }
}

/**
 * Creates a projectile entity targeting an enemy.
 */
export function createProjectile(tower: Tower, target: Enemy): Projectile {
  const id = crypto.randomUUID();
  const isAOE = tower.type === 'aoe_tower';
  const aoeRadius = isAOE ? (tower.aoeRadius ?? GameConfig.structures.aoe_tower.aoeRadius) : 0;

  const projectile: Projectile = {
    id,
    type: 'projectile',
    position: { ...tower.position },
    worldPosition: { ...tower.worldPosition },
    sourceId: tower.id,
    targetId: target.id,
    damage: tower.damage,
    speed: 10, // Projectile speed in cells/sec
    isAOE,
    aoeRadius,
    targetPosition: { ...target.worldPosition },
  };

  return projectile;
}

/**
 * Applies AOE damage to all enemies within radius of the impact point.
 * Uses Euclidean distance in grid cells for radius check.
 * Includes the primary target.
 */
export function applyAOEDamage(
  impactPosition: GridPosition,
  radius: number,
  damage: number,
  enemies: Enemy[]
): Enemy[] {
  const affected: Enemy[] = [];

  for (const enemy of enemies) {
    const dist = gridDistance(impactPosition, enemy.position);
    if (dist <= radius) {
      enemy.currentHealth -= damage;
      affected.push(enemy);
    }
  }

  return affected;
}

/**
 * CombatSystem class that manages the tower combat loop.
 */
export class CombatSystem {
  private entityStore: EntityStore;

  constructor(entityStore: EntityStore) {
    this.entityStore = entityStore;
  }

  /**
   * Updates all towers: decrements cooldowns, selects targets, fires projectiles.
   * @param dt - Time delta in seconds
   * @returns Array of combat events generated this tick
   */
  update(dt: number): CombatEvent[] {
    const events: CombatEvent[] = [];
    const enemies = Array.from(this.entityStore.enemies.values());

    // Update tower targeting and firing
    for (const tower of this.entityStore.structures.values()) {
      if (tower.type === 'barrier') continue; // Barriers don't fire

      const towerEntity = tower as Tower;
      this.updateTower(dt, towerEntity, enemies);
    }

    // Update projectiles
    const projectileEvents = this.updateProjectiles(dt);
    events.push(...projectileEvents);

    return events;
  }

  /**
   * Updates a single tower: cooldown, target validation, firing.
   */
  private updateTower(dt: number, tower: Tower, enemies: Enemy[]): void {
    // Decrement cooldown
    tower.fireCooldown = Math.max(0, tower.fireCooldown - dt);

    if (tower.fireCooldown > 0) return;

    // Check if current target is still valid
    if (tower.targetId) {
      const target = this.entityStore.enemies.get(tower.targetId);
      if (!target || target.currentHealth <= 0 || gridDistance(tower.position, target.position) > tower.range) {
        tower.targetId = null;
      }
    }

    // Select new target if needed
    if (!tower.targetId) {
      const newTarget = selectTarget(tower, enemies);
      if (!newTarget) return; // No valid target - tower remains idle
      tower.targetId = newTarget.id;
    }

    // Fire projectile
    const target = this.entityStore.enemies.get(tower.targetId);
    if (!target) {
      tower.targetId = null;
      return;
    }

    const projectile = createProjectile(tower, target);
    addEntity(this.entityStore, projectile);
    tower.fireCooldown = 1 / tower.fireRate;

    log.debug('Tower fired', {
      towerId: tower.id.slice(0, 8),
      towerType: tower.type,
      targetId: target.id.slice(0, 8),
      damage: tower.damage,
    });
  }

  /**
   * Updates all projectiles: moves them toward targets, checks for hits.
   */
  private updateProjectiles(dt: number): CombatEvent[] {
    const events: CombatEvent[] = [];
    const projectilesToRemove: string[] = [];

    for (const projectile of this.entityStore.projectiles.values()) {
      const target = this.entityStore.enemies.get(projectile.targetId);

      // If target no longer exists, dissipate projectile
      if (!target) {
        projectilesToRemove.push(projectile.id);
        continue;
      }

      // Update target position (track the target)
      projectile.targetPosition = { ...target.worldPosition };

      // Move projectile toward target
      const dx = projectile.targetPosition.x - projectile.worldPosition.x;
      const dy = projectile.targetPosition.y - projectile.worldPosition.y;
      const dz = projectile.targetPosition.z - projectile.worldPosition.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const moveAmount = projectile.speed * dt;

      if (dist <= moveAmount || dist < 0.1) {
        // Hit!
        projectilesToRemove.push(projectile.id);

        if (projectile.isAOE) {
          // AOE damage
          const enemies = Array.from(this.entityStore.enemies.values());
          const affected = applyAOEDamage(
            target.position,
            projectile.aoeRadius,
            projectile.damage,
            enemies
          );
          const affectedIds = affected.map(e => e.id);
          events.push({
            type: 'aoe_hit',
            projectileId: projectile.id,
            affectedEnemyIds: affectedIds,
            damage: projectile.damage,
          });

          log.debug('AOE hit', {
            affectedCount: affectedIds.length,
            damage: projectile.damage,
            radius: projectile.aoeRadius,
          });

          // Check for destroyed enemies
          for (const enemy of affected) {
            if (enemy.currentHealth <= 0) {
              log.info('Enemy destroyed (AOE)', {
                enemyId: enemy.id.slice(0, 8),
                enemyType: enemy.type,
              });
              events.push({
                type: 'enemy_destroyed',
                enemyId: enemy.id,
                killedByTower: true,
              });
            }
          }
        } else {
          // Single target damage
          target.currentHealth -= projectile.damage;
          events.push({
            type: 'projectile_hit',
            projectileId: projectile.id,
            targetId: target.id,
            damage: projectile.damage,
          });

          if (target.currentHealth <= 0) {
            log.info('Enemy destroyed', {
              enemyId: target.id.slice(0, 8),
              enemyType: target.type,
              overkill: Math.abs(target.currentHealth),
            });
            events.push({
              type: 'enemy_destroyed',
              enemyId: target.id,
              killedByTower: true,
            });
          }
        }
      } else {
        // Move toward target
        const ratio = moveAmount / dist;
        projectile.worldPosition.x += dx * ratio;
        projectile.worldPosition.y += dy * ratio;
        projectile.worldPosition.z += dz * ratio;
      }
    }

    // Remove hit/dissipated projectiles
    for (const id of projectilesToRemove) {
      removeEntity(this.entityStore, id);
    }

    return events;
  }
}
