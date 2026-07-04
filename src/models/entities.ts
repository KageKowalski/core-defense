/**
 * Entity Models - All entity type interfaces for Core Defense.
 */

import { EntityId, GridPosition, WorldPosition } from './grid';

export type EntityType =
  | 'barrier'
  | 'basic_tower'
  | 'sniper_tower'
  | 'aoe_tower'
  | 'basic_enemy'
  | 'brute_enemy'
  | 'critical_resource'
  | 'projectile';

export type StructureType = 'barrier' | 'basic_tower' | 'sniper_tower' | 'aoe_tower';

export type TargetingPriority = 'closest_to_core' | 'highest_health' | 'closest_to_tower';

// --- Base Entity ---
export interface Entity {
  id: EntityId;
  type: EntityType;
  position: GridPosition;
  worldPosition: WorldPosition;
}

// --- Structures ---
export interface Structure extends Entity {
  type: StructureType;
  maxHealth: number;
  currentHealth: number;
  originalCost: number;
}

export interface Barrier extends Structure {
  type: 'barrier';
}

export interface Tower extends Structure {
  type: 'basic_tower' | 'sniper_tower' | 'aoe_tower';
  range: number;
  damage: number;
  fireRate: number;
  fireCooldown: number;
  targetId: EntityId | null;
  targetingPriority: TargetingPriority;
  aoeRadius?: number;
}

// --- Path ---
export interface Path {
  waypoints: GridPosition[];
  totalCost: number;
}

// --- Enemies ---
export interface Enemy extends Entity {
  type: 'basic_enemy' | 'brute_enemy';
  maxHealth: number;
  currentHealth: number;
  speed: number;
  damage: number;
  structureDamage: number;
  bounty: number;
  path: Path | null;
  pathIndex: number;
  interpolation: number;
  isAttackingBarrier: boolean;
  attackCooldown: number;
}

export interface BasicEnemy extends Enemy {
  type: 'basic_enemy';
}

export interface BruteEnemy extends Enemy {
  type: 'brute_enemy';
}

// --- Critical Resource ---
export interface CriticalResource extends Entity {
  type: 'critical_resource';
  maxHealth: number;
  currentHealth: number;
  cells: GridPosition[];
}

// --- Projectile ---
export interface Projectile extends Entity {
  type: 'projectile';
  sourceId: EntityId;
  targetId: EntityId;
  damage: number;
  speed: number;
  isAOE: boolean;
  aoeRadius: number;
  targetPosition: WorldPosition;
}
