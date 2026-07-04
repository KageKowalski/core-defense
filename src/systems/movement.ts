/**
 * Movement System - Handles enemy movement along path waypoints.
 * Implements interpolation for smooth rendering, barrier attacks for Brutes,
 * and detection of enemies reaching the Critical Resource.
 */

import { GridPosition, gridToWorld, WorldPosition } from '../models/grid';
import { Enemy, Structure } from '../models/entities';
import { GameConfig } from '../models/config';

export type MovementEvent =
  | { type: 'reached_core'; enemyId: string; damage: number }
  | { type: 'barrier_destroyed'; enemyId: string; barrierId: string }
  | { type: 'barrier_damaged'; enemyId: string; barrierId: string; damage: number };

/**
 * Linearly interpolates between two world positions.
 */
export function lerpWorldPosition(a: WorldPosition, b: WorldPosition, t: number): WorldPosition {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/**
 * Checks if a grid position is a core cell (any of the 4 center cells).
 */
export function isCoreAdjacentOrCore(
  position: GridPosition,
  gridWidth: number,
  gridHeight: number
): boolean {
  const centerRow = gridHeight / 2 - 1;
  const centerCol = gridWidth / 2 - 1;

  return (
    (position.row === centerRow || position.row === centerRow + 1) &&
    (position.col === centerCol || position.col === centerCol + 1)
  );
}

/**
 * Updates an enemy's movement along its path.
 * Returns movement events (reached core, barrier damaged/destroyed).
 *
 * @param dt - Time delta in seconds
 * @param enemy - The enemy to update
 * @param getBarrierAtPosition - Function to get a barrier at a given position (if any)
 * @param coreCells - Array of positions that are core cells
 */
export function updateEnemyMovement(
  dt: number,
  enemy: Enemy,
  getBarrierAtPosition?: (pos: GridPosition) => Structure | null,
  coreCells?: GridPosition[]
): MovementEvent[] {
  const events: MovementEvent[] = [];

  if (!enemy.path || enemy.path.waypoints.length === 0) {
    return events;
  }

  // If attacking a barrier, handle barrier attack
  if (enemy.isAttackingBarrier) {
    const barrierEvents = updateBarrierAttack(dt, enemy, getBarrierAtPosition);
    return barrierEvents;
  }

  // Check if already at end of path
  if (enemy.pathIndex >= enemy.path.waypoints.length - 1) {
    // Enemy has reached the end of its path
    // Check if this is a core-adjacent cell
    const finalPos = enemy.path.waypoints[enemy.path.waypoints.length - 1];
    if (coreCells && coreCells.some(c => c.row === finalPos.row && c.col === finalPos.col)) {
      // Already at core - this shouldn't normally happen, but handle gracefully
    }
    return events;
  }

  const currentWaypoint = enemy.path.waypoints[enemy.pathIndex];
  const nextWaypoint = enemy.path.waypoints[enemy.pathIndex + 1];

  // Calculate movement this tick (cells per second * seconds = cells moved)
  const moveDistance = enemy.speed * dt;
  enemy.interpolation += moveDistance;

  // Process waypoint transitions
  while (enemy.interpolation >= 1.0 && enemy.pathIndex < enemy.path.waypoints.length - 1) {
    enemy.interpolation -= 1.0;
    enemy.pathIndex++;
    enemy.position = enemy.path.waypoints[enemy.pathIndex];

    // Check if reached core (this is the last waypoint and it's adjacent to core)
    if (enemy.pathIndex >= enemy.path.waypoints.length - 1) {
      if (coreCells && coreCells.some(c => c.row === enemy.position.row && c.col === enemy.position.col)) {
        events.push({
          type: 'reached_core',
          enemyId: enemy.id,
          damage: enemy.damage,
        });
        return events;
      }
      // Reached end of path (core-adjacent)
      events.push({
        type: 'reached_core',
        enemyId: enemy.id,
        damage: enemy.damage,
      });
      return events;
    }

    // Check if next cell has a barrier (Brute anti-blocking attack)
    if (
      enemy.type === 'brute_enemy' &&
      enemy.pathIndex < enemy.path.waypoints.length - 1 &&
      getBarrierAtPosition
    ) {
      const ahead = enemy.path.waypoints[enemy.pathIndex + 1];
      const barrier = getBarrierAtPosition(ahead);
      if (barrier) {
        enemy.isAttackingBarrier = true;
        enemy.attackCooldown = 0;
        break;
      }
    }
  }

  // Interpolate world position for smooth rendering
  if (enemy.pathIndex < enemy.path.waypoints.length - 1) {
    const currWp = enemy.path.waypoints[enemy.pathIndex];
    const nextWp = enemy.path.waypoints[enemy.pathIndex + 1];
    const currWorld = gridToWorld(currWp, GameConfig.grid.cellSize);
    const nextWorld = gridToWorld(nextWp, GameConfig.grid.cellSize);
    enemy.worldPosition = lerpWorldPosition(currWorld, nextWorld, Math.min(enemy.interpolation, 1.0));
  } else {
    enemy.worldPosition = gridToWorld(enemy.position, GameConfig.grid.cellSize);
  }

  return events;
}

/**
 * Updates a Brute enemy's barrier attack.
 * Brutes attack at 1 hit/sec dealing structureDamage (25) per hit.
 */
function updateBarrierAttack(
  dt: number,
  enemy: Enemy,
  getBarrierAtPosition?: (pos: GridPosition) => Structure | null
): MovementEvent[] {
  const events: MovementEvent[] = [];

  if (!enemy.path || !getBarrierAtPosition) {
    enemy.isAttackingBarrier = false;
    return events;
  }

  enemy.attackCooldown -= dt;

  if (enemy.attackCooldown <= 0) {
    // Find the barrier we're attacking (next waypoint)
    if (enemy.pathIndex < enemy.path.waypoints.length - 1) {
      const barrierPos = enemy.path.waypoints[enemy.pathIndex + 1];
      const barrier = getBarrierAtPosition(barrierPos);

      if (barrier) {
        // Deal damage to barrier
        barrier.currentHealth -= enemy.structureDamage;

        if (barrier.currentHealth <= 0) {
          barrier.currentHealth = 0;
          // Barrier destroyed - exit attack mode
          enemy.isAttackingBarrier = false;
          events.push({
            type: 'barrier_destroyed',
            enemyId: enemy.id,
            barrierId: barrier.id,
          });
        } else {
          events.push({
            type: 'barrier_damaged',
            enemyId: enemy.id,
            barrierId: barrier.id,
            damage: enemy.structureDamage,
          });
        }
      } else {
        // Barrier no longer exists - exit attack mode
        enemy.isAttackingBarrier = false;
      }
    } else {
      // No more waypoints - exit attack mode
      enemy.isAttackingBarrier = false;
    }

    // Reset cooldown to 1 second (1 hit/sec)
    enemy.attackCooldown = 1.0;
  }

  return events;
}
