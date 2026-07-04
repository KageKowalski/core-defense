/**
 * PlacementSystem - Handles structure placement, selling, and repair.
 * Validates grid state, gold sufficiency, and phase constraints.
 */

import { Grid, GridPosition, EntityId, gridToWorld } from '../models/grid';
import { Structure, StructureType, Barrier, Tower } from '../models/entities';
import { GameConfig } from '../models/config';
import { EconomySystem } from './economy';
import { EntityStore, addEntity, removeEntity } from '../models/entity-store';
import { GamePhase } from './state';

export type PlacementResult =
  | { success: true; entityId: EntityId }
  | { success: false; reason: string };

export type SellResult =
  | { success: true; goldCredited: number }
  | { success: false; reason: string };

export type RepairResult =
  | { success: true; repairCost: number }
  | { success: false; reason: string };

/**
 * Generates a UUID for entity identification.
 */
export function generateEntityId(): EntityId {
  return crypto.randomUUID();
}

/**
 * Validates whether a structure can be placed at the given grid position.
 * Priority: occupied-cell rejection takes precedence over insufficient-gold.
 */
export function validatePlacement(
  grid: Grid,
  position: GridPosition,
  structureType: StructureType,
  gold: number
): PlacementResult {
  const { row, col } = position;

  // Bounds check
  if (row < 0 || row >= grid.height || col < 0 || col >= grid.width) {
    return { success: false, reason: 'Position out of bounds' };
  }

  const cell = grid.cells[row][col];

  // Priority 1: Check if cell is occupied (by structure or Critical Resource)
  if (cell.occupant !== null) {
    return { success: false, reason: 'Cell is occupied' };
  }

  // Priority 1b: Check if cell is a core cell
  if (cell.isCoreCell) {
    return { success: false, reason: 'Cannot place on core cell' };
  }

  // Priority 2: Check gold sufficiency
  const cost = GameConfig.structures[structureType].cost;
  if (gold < cost) {
    return { success: false, reason: 'Insufficient gold' };
  }

  return { success: true, entityId: '' }; // entityId placeholder for validation-only
}

/**
 * Places a structure on the grid.
 * Validates cell availability and gold, then creates the entity.
 */
export function placeStructure(
  grid: Grid,
  entityStore: EntityStore,
  economy: EconomySystem,
  position: GridPosition,
  structureType: StructureType
): PlacementResult {
  const { row, col } = position;

  // Bounds check
  if (row < 0 || row >= grid.height || col < 0 || col >= grid.width) {
    return { success: false, reason: 'Position out of bounds' };
  }

  const cell = grid.cells[row][col];

  // Priority 1: Check if cell is occupied (by structure or Critical Resource)
  if (cell.occupant !== null) {
    return { success: false, reason: 'Cell is occupied' };
  }

  // Priority 1b: Check if cell is a core cell
  if (cell.isCoreCell) {
    return { success: false, reason: 'Cannot place on core cell' };
  }

  // Priority 2: Check gold sufficiency
  const cost = GameConfig.structures[structureType].cost;
  if (!economy.canAfford(cost)) {
    return { success: false, reason: 'Insufficient gold' };
  }

  // Create the structure entity
  const entityId = generateEntityId();
  const structure = createStructureEntity(entityId, position, structureType);

  // Deduct gold
  economy.deduct(cost);

  // Mark cell as occupied and non-walkable
  cell.occupant = entityId;
  cell.isWalkable = false;

  // Add to entity store
  addEntity(entityStore, structure);

  return { success: true, entityId };
}

/**
 * Creates a structure entity based on type with appropriate stats from GameConfig.
 */
export function createStructureEntity(
  entityId: EntityId,
  position: GridPosition,
  structureType: StructureType
): Structure {
  const worldPosition = gridToWorld(position, GameConfig.grid.cellSize);
  const config = GameConfig.structures[structureType];

  switch (structureType) {
    case 'barrier': {
      const barrier: Barrier = {
        id: entityId,
        type: 'barrier',
        position,
        worldPosition,
        maxHealth: config.maxHealth,
        currentHealth: config.maxHealth,
        originalCost: config.cost,
      };
      return barrier;
    }
    case 'basic_tower':
    case 'sniper_tower':
    case 'aoe_tower': {
      const towerConfig = GameConfig.structures[structureType];
      const tower: Tower = {
        id: entityId,
        type: structureType,
        position,
        worldPosition,
        maxHealth: towerConfig.maxHealth,
        currentHealth: towerConfig.maxHealth,
        originalCost: towerConfig.cost,
        range: 'range' in towerConfig ? towerConfig.range : 3,
        damage: 'damage' in towerConfig ? towerConfig.damage : 15,
        fireRate: 'fireRate' in towerConfig ? towerConfig.fireRate : 1,
        fireCooldown: 0,
        targetId: null,
        targetingPriority: 'targetingPriority' in towerConfig ? towerConfig.targetingPriority : 'closest_to_core',
        aoeRadius: 'aoeRadius' in towerConfig ? (towerConfig as typeof GameConfig.structures.aoe_tower).aoeRadius : undefined,
      };
      return tower;
    }
  }
}

/**
 * Sells a structure: removes it from the grid, credits sell value, frees the cell.
 * Only allowed during Preparation Phase.
 */
export function sellStructure(
  grid: Grid,
  entityStore: EntityStore,
  economy: EconomySystem,
  entityId: EntityId,
  phase: GamePhase
): SellResult {
  // Phase check
  if (phase !== 'preparation') {
    return { success: false, reason: 'Can only sell during preparation phase' };
  }

  // Find the structure
  const structure = entityStore.structures.get(entityId);
  if (!structure) {
    return { success: false, reason: 'Structure not found' };
  }

  // Calculate sell value
  const sellValue = economy.calculateSellValue(structure);

  // Remove from grid
  const { row, col } = structure.position;
  const cell = grid.cells[row][col];
  cell.occupant = null;
  cell.isWalkable = true;

  // Remove from entity store
  removeEntity(entityStore, entityId);

  // Credit gold
  economy.credit(sellValue);

  return { success: true, goldCredited: sellValue };
}

/**
 * Repairs a structure: validates damage state and gold, restores to max health.
 * Only allowed during Preparation Phase.
 */
export function repairStructure(
  entityStore: EntityStore,
  economy: EconomySystem,
  entityId: EntityId,
  phase: GamePhase
): RepairResult {
  // Phase check
  if (phase !== 'preparation') {
    return { success: false, reason: 'Can only repair during preparation phase' };
  }

  // Find the structure
  const structure = entityStore.structures.get(entityId);
  if (!structure) {
    return { success: false, reason: 'Structure not found' };
  }

  // Check if structure is already at full health
  if (structure.currentHealth >= structure.maxHealth) {
    return { success: false, reason: 'Structure is at full health' };
  }

  // Calculate repair cost
  const repairCost = economy.calculateRepairCost(structure);

  // Validate gold sufficiency
  if (!economy.canAfford(repairCost)) {
    return { success: false, reason: 'Insufficient gold' };
  }

  // Deduct gold
  economy.deduct(repairCost);

  // Restore health
  structure.currentHealth = structure.maxHealth;

  return { success: true, repairCost };
}
