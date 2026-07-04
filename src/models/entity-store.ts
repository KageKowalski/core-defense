/**
 * EntityStore - Map-based storage for all game entities with add/remove/query operations.
 */

import { EntityId, GridPosition } from './grid';
import { Structure, Enemy, Projectile, CriticalResource, Entity } from './entities';
import { Logger } from '../utils/logger';

const log = Logger.create('Entity');

export interface EntityStore {
  structures: Map<EntityId, Structure>;
  enemies: Map<EntityId, Enemy>;
  projectiles: Map<EntityId, Projectile>;
  criticalResource: CriticalResource;
}

/**
 * Creates a new EntityStore with empty collections and the given Critical Resource.
 */
export function createEntityStore(criticalResource: CriticalResource): EntityStore {
  return {
    structures: new Map(),
    enemies: new Map(),
    projectiles: new Map(),
    criticalResource,
  };
}

/**
 * Adds an entity to the appropriate collection in the store.
 */
export function addEntity(store: EntityStore, entity: Entity): void {
  switch (entity.type) {
    case 'barrier':
    case 'basic_tower':
    case 'sniper_tower':
    case 'aoe_tower':
      store.structures.set(entity.id, entity as Structure);
      log.debug('Structure added', { id: entity.id.slice(0, 8), type: entity.type });
      break;
    case 'basic_enemy':
    case 'brute_enemy':
      store.enemies.set(entity.id, entity as Enemy);
      log.debug('Enemy added', { id: entity.id.slice(0, 8), type: entity.type, totalEnemies: store.enemies.size });
      break;
    case 'projectile':
      store.projectiles.set(entity.id, entity as Projectile);
      break;
    case 'critical_resource':
      store.criticalResource = entity as CriticalResource;
      break;
  }
}

/**
 * Removes an entity from the store by ID.
 * Returns true if the entity was found and removed.
 */
export function removeEntity(store: EntityStore, entityId: EntityId): boolean {
  if (store.structures.has(entityId)) {
    const entity = store.structures.get(entityId)!;
    store.structures.delete(entityId);
    log.debug('Structure removed', { id: entityId.slice(0, 8), type: entity.type, remaining: store.structures.size });
    return true;
  }
  if (store.enemies.has(entityId)) {
    const entity = store.enemies.get(entityId)!;
    store.enemies.delete(entityId);
    log.debug('Enemy removed', { id: entityId.slice(0, 8), type: entity.type, remaining: store.enemies.size });
    return true;
  }
  if (store.projectiles.has(entityId)) {
    store.projectiles.delete(entityId);
    return true;
  }
  log.warn('Attempted to remove non-existent entity', { id: entityId.slice(0, 8) });
  return false;
}

/**
 * Gets an entity by ID from any collection.
 */
export function getById(store: EntityStore, entityId: EntityId): Entity | null {
  if (store.structures.has(entityId)) return store.structures.get(entityId)!;
  if (store.enemies.has(entityId)) return store.enemies.get(entityId)!;
  if (store.projectiles.has(entityId)) return store.projectiles.get(entityId)!;
  if (store.criticalResource.id === entityId) return store.criticalResource;
  return null;
}

/**
 * Returns all enemies within the given Euclidean distance (in grid cells) of a position.
 */
export function getEnemiesInRange(store: EntityStore, position: GridPosition, range: number): Enemy[] {
  const result: Enemy[] = [];
  for (const enemy of store.enemies.values()) {
    const dx = enemy.position.col - position.col;
    const dy = enemy.position.row - position.row;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= range) {
      result.push(enemy);
    }
  }
  return result;
}

/**
 * Returns the count of active (alive) enemies.
 */
export function getActiveEnemyCount(store: EntityStore): number {
  return store.enemies.size;
}
