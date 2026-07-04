/**
 * Unit tests for the PlacementSystem - structure placement, selling, and repair.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { placeStructure, sellStructure, repairStructure, createStructureEntity } from './placement';
import { createGrid, initializeCriticalResource, Grid } from '../models/grid';
import { createEntityStore, EntityStore } from '../models/entity-store';
import { EconomySystem } from './economy';
import { CriticalResource } from '../models/entities';
import { GameConfig } from '../models/config';
import { GamePhase } from './state';

describe('PlacementSystem', () => {
  let grid: Grid;
  let entityStore: EntityStore;
  let economy: EconomySystem;
  let crId: string;

  beforeEach(() => {
    grid = createGrid(20, 20);
    crId = 'cr-001';
    const crPositions = initializeCriticalResource(grid, crId);
    const criticalResource: CriticalResource = {
      id: crId,
      type: 'critical_resource',
      position: crPositions[0],
      worldPosition: { x: 10, y: 0, z: 10 },
      maxHealth: 100,
      currentHealth: 100,
      cells: crPositions,
    };
    entityStore = createEntityStore(criticalResource);
    economy = new EconomySystem(GameConfig.startingGold); // 100 gold
  });

  describe('placeStructure', () => {
    it('should place a barrier on an open cell with sufficient gold', () => {
      const result = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entityId).toBeDefined();
        expect(result.entityId.length).toBeGreaterThan(0);
      }
      // Gold should be deducted
      expect(economy.getGold()).toBe(100 - GameConfig.structures.barrier.cost);
      // Cell should be occupied
      expect(grid.cells[0][0].occupant).not.toBeNull();
      expect(grid.cells[0][0].isWalkable).toBe(false);
    });

    it('should place a basic_tower on an open cell with sufficient gold', () => {
      const result = placeStructure(grid, entityStore, economy, { row: 5, col: 5 }, 'basic_tower');
      expect(result.success).toBe(true);
      expect(economy.getGold()).toBe(100 - GameConfig.structures.basic_tower.cost);
      // Structure should be in entity store
      if (result.success) {
        const structure = entityStore.structures.get(result.entityId);
        expect(structure).toBeDefined();
        expect(structure!.type).toBe('basic_tower');
        expect(structure!.maxHealth).toBe(GameConfig.structures.basic_tower.maxHealth);
      }
    });

    it('should reject placement on an occupied cell', () => {
      // Place first structure
      placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      const goldAfterFirst = economy.getGold();

      // Try to place on same cell
      const result = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('Cell is occupied');
      }
      // Gold should not change
      expect(economy.getGold()).toBe(goldAfterFirst);
    });

    it('should reject placement on a core cell (occupied by Critical Resource)', () => {
      // Core cells are at (9,9), (9,10), (10,9), (10,10) for a 20x20 grid
      // They are occupied by the Critical Resource, so occupant check catches first
      const result = placeStructure(grid, entityStore, economy, { row: 9, col: 9 }, 'barrier');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('Cell is occupied');
      }
      // Gold should not change
      expect(economy.getGold()).toBe(100);
    });

    it('should reject placement on a core cell even without occupant (isCoreCell check)', () => {
      // Manually create a scenario where a core cell has no occupant but isCoreCell is true
      // This covers the case where the core cell flag is checked independently
      const cell = grid.cells[9][9];
      cell.occupant = null; // Remove CR occupant manually
      // isCoreCell is still true
      const result = placeStructure(grid, entityStore, economy, { row: 9, col: 9 }, 'barrier');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('Cannot place on core cell');
      }
      // Gold should not change
      expect(economy.getGold()).toBe(100);
    });

    it('should reject placement with insufficient gold', () => {
      // Set gold to less than barrier cost (10)
      economy = new EconomySystem(5);
      const result = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('Insufficient gold');
      }
      // Gold should not change
      expect(economy.getGold()).toBe(5);
    });

    it('should prioritize occupied-cell rejection over insufficient-gold', () => {
      // Place a structure first
      economy = new EconomySystem(200);
      placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');

      // Now try with insufficient gold on the same occupied cell
      economy = new EconomySystem(0);
      const result = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'basic_tower');
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should say "Cell is occupied" not "Insufficient gold"
        expect(result.reason).toBe('Cell is occupied');
      }
    });

    it('should reject placement out of bounds', () => {
      const result = placeStructure(grid, entityStore, economy, { row: -1, col: 0 }, 'barrier');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('Position out of bounds');
      }
    });

    it('should create a tower with correct stats from GameConfig', () => {
      const result = placeStructure(grid, entityStore, economy, { row: 3, col: 3 }, 'sniper_tower');
      expect(result.success).toBe(true);
      if (result.success) {
        const tower = entityStore.structures.get(result.entityId) as any;
        expect(tower.type).toBe('sniper_tower');
        expect(tower.range).toBe(GameConfig.structures.sniper_tower.range);
        expect(tower.damage).toBe(GameConfig.structures.sniper_tower.damage);
        expect(tower.fireRate).toBe(GameConfig.structures.sniper_tower.fireRate);
        expect(tower.targetingPriority).toBe(GameConfig.structures.sniper_tower.targetingPriority);
        expect(tower.originalCost).toBe(GameConfig.structures.sniper_tower.cost);
      }
    });

    it('should create an aoe_tower with aoeRadius', () => {
      const result = placeStructure(grid, entityStore, economy, { row: 2, col: 2 }, 'aoe_tower');
      expect(result.success).toBe(true);
      if (result.success) {
        const tower = entityStore.structures.get(result.entityId) as any;
        expect(tower.type).toBe('aoe_tower');
        expect(tower.aoeRadius).toBe(GameConfig.structures.aoe_tower.aoeRadius);
      }
    });
  });

  describe('sellStructure', () => {
    it('should sell a structure and credit correct gold value', () => {
      // Place a barrier at full health
      const placeResult = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(placeResult.success).toBe(true);
      if (!placeResult.success) return;

      const goldAfterPlace = economy.getGold();
      const entityId = placeResult.entityId;

      // Sell it
      const sellResult = sellStructure(grid, entityStore, economy, entityId, 'preparation');
      expect(sellResult.success).toBe(true);
      if (sellResult.success) {
        // Sell value at full health: floor((150/150) * 10 * 0.5) = 5
        const expectedSellValue = Math.floor((150 / 150) * 10 * 0.5);
        expect(sellResult.goldCredited).toBe(expectedSellValue);
        expect(economy.getGold()).toBe(goldAfterPlace + expectedSellValue);
      }

      // Cell should be freed
      expect(grid.cells[0][0].occupant).toBeNull();
      expect(grid.cells[0][0].isWalkable).toBe(true);

      // Entity should be removed from store
      expect(entityStore.structures.has(entityId)).toBe(false);
    });

    it('should sell a damaged structure with reduced gold value', () => {
      // Place a barrier
      const placeResult = placeStructure(grid, entityStore, economy, { row: 1, col: 1 }, 'barrier');
      expect(placeResult.success).toBe(true);
      if (!placeResult.success) return;

      const entityId = placeResult.entityId;
      // Damage the barrier to half health
      const structure = entityStore.structures.get(entityId)!;
      structure.currentHealth = 75; // Half of 150

      const goldBeforeSell = economy.getGold();

      const sellResult = sellStructure(grid, entityStore, economy, entityId, 'preparation');
      expect(sellResult.success).toBe(true);
      if (sellResult.success) {
        // Sell value: floor((75/150) * 10 * 0.5) = floor(2.5) = 2
        const expectedSellValue = Math.floor((75 / 150) * 10 * 0.5);
        expect(sellResult.goldCredited).toBe(expectedSellValue);
        expect(economy.getGold()).toBe(goldBeforeSell + expectedSellValue);
      }
    });

    it('should reject selling during combat phase', () => {
      const placeResult = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(placeResult.success).toBe(true);
      if (!placeResult.success) return;

      const sellResult = sellStructure(grid, entityStore, economy, placeResult.entityId, 'combat');
      expect(sellResult.success).toBe(false);
      if (!sellResult.success) {
        expect(sellResult.reason).toBe('Can only sell during preparation phase');
      }
    });

    it('should reject selling during game_over phase', () => {
      const placeResult = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(placeResult.success).toBe(true);
      if (!placeResult.success) return;

      const sellResult = sellStructure(grid, entityStore, economy, placeResult.entityId, 'game_over');
      expect(sellResult.success).toBe(false);
      if (!sellResult.success) {
        expect(sellResult.reason).toBe('Can only sell during preparation phase');
      }
    });

    it('should reject selling a non-existent structure', () => {
      const sellResult = sellStructure(grid, entityStore, economy, 'non-existent-id', 'preparation');
      expect(sellResult.success).toBe(false);
      if (!sellResult.success) {
        expect(sellResult.reason).toBe('Structure not found');
      }
    });
  });

  describe('repairStructure', () => {
    it('should repair a damaged structure with correct cost deduction and health restoration', () => {
      // Place a barrier
      const placeResult = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(placeResult.success).toBe(true);
      if (!placeResult.success) return;

      const entityId = placeResult.entityId;
      // Damage the barrier
      const structure = entityStore.structures.get(entityId)!;
      structure.currentHealth = 100; // Damaged from 150 to 100

      const goldBeforeRepair = economy.getGold();

      const repairResult = repairStructure(entityStore, economy, entityId, 'preparation');
      expect(repairResult.success).toBe(true);
      if (repairResult.success) {
        // Repair cost: ceil(((150-100)/150) * 10 * 0.7) = ceil((50/150) * 7) = ceil(2.333...) = 3
        const expectedCost = Math.ceil(((150 - 100) / 150) * 10 * 0.7);
        expect(repairResult.repairCost).toBe(expectedCost);
        expect(economy.getGold()).toBe(goldBeforeRepair - expectedCost);
      }

      // Health should be restored
      expect(structure.currentHealth).toBe(structure.maxHealth);
    });

    it('should reject repair if structure is at full health', () => {
      // Place a barrier (full health)
      const placeResult = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(placeResult.success).toBe(true);
      if (!placeResult.success) return;

      const goldBefore = economy.getGold();
      const repairResult = repairStructure(entityStore, economy, placeResult.entityId, 'preparation');
      expect(repairResult.success).toBe(false);
      if (!repairResult.success) {
        expect(repairResult.reason).toBe('Structure is at full health');
      }
      // Gold should not change
      expect(economy.getGold()).toBe(goldBefore);
    });

    it('should reject repair with insufficient gold', () => {
      // Place a barrier with lots of gold
      economy = new EconomySystem(200);
      const placeResult = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(placeResult.success).toBe(true);
      if (!placeResult.success) return;

      const entityId = placeResult.entityId;
      // Damage heavily
      const structure = entityStore.structures.get(entityId)!;
      structure.currentHealth = 1;

      // Set gold to very low amount
      economy = new EconomySystem(0);
      // We need the economy to be attached - but since repair checks canAfford we just need to use a fresh one with 0 gold
      // Repair cost: ceil(((150-1)/150) * 10 * 0.7) = ceil(6.953...) = 7
      const repairResult = repairStructure(entityStore, economy, entityId, 'preparation');
      expect(repairResult.success).toBe(false);
      if (!repairResult.success) {
        expect(repairResult.reason).toBe('Insufficient gold');
      }
    });

    it('should reject repair during combat phase', () => {
      // Place and damage a barrier
      const placeResult = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(placeResult.success).toBe(true);
      if (!placeResult.success) return;

      const structure = entityStore.structures.get(placeResult.entityId)!;
      structure.currentHealth = 50;

      const repairResult = repairStructure(entityStore, economy, placeResult.entityId, 'combat');
      expect(repairResult.success).toBe(false);
      if (!repairResult.success) {
        expect(repairResult.reason).toBe('Can only repair during preparation phase');
      }
    });

    it('should reject repair during game_over phase', () => {
      const placeResult = placeStructure(grid, entityStore, economy, { row: 0, col: 0 }, 'barrier');
      expect(placeResult.success).toBe(true);
      if (!placeResult.success) return;

      const structure = entityStore.structures.get(placeResult.entityId)!;
      structure.currentHealth = 50;

      const repairResult = repairStructure(entityStore, economy, placeResult.entityId, 'game_over');
      expect(repairResult.success).toBe(false);
      if (!repairResult.success) {
        expect(repairResult.reason).toBe('Can only repair during preparation phase');
      }
    });

    it('should reject repair of a non-existent structure', () => {
      const repairResult = repairStructure(entityStore, economy, 'non-existent-id', 'preparation');
      expect(repairResult.success).toBe(false);
      if (!repairResult.success) {
        expect(repairResult.reason).toBe('Structure not found');
      }
    });
  });

  describe('createStructureEntity', () => {
    it('should create a barrier with correct properties', () => {
      const barrier = createStructureEntity('test-id', { row: 5, col: 5 }, 'barrier');
      expect(barrier.id).toBe('test-id');
      expect(barrier.type).toBe('barrier');
      expect(barrier.position).toEqual({ row: 5, col: 5 });
      expect(barrier.maxHealth).toBe(GameConfig.structures.barrier.maxHealth);
      expect(barrier.currentHealth).toBe(GameConfig.structures.barrier.maxHealth);
      expect(barrier.originalCost).toBe(GameConfig.structures.barrier.cost);
    });

    it('should create a basic_tower with range, damage, fireRate', () => {
      const tower = createStructureEntity('tower-id', { row: 3, col: 3 }, 'basic_tower') as any;
      expect(tower.type).toBe('basic_tower');
      expect(tower.range).toBe(GameConfig.structures.basic_tower.range);
      expect(tower.damage).toBe(GameConfig.structures.basic_tower.damage);
      expect(tower.fireRate).toBe(GameConfig.structures.basic_tower.fireRate);
      expect(tower.fireCooldown).toBe(0);
      expect(tower.targetId).toBeNull();
      expect(tower.targetingPriority).toBe('closest_to_core');
    });
  });
});
