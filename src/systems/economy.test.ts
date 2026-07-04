/**
 * Unit tests for EconomySystem
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EconomySystem } from './economy';
import { GameConfig } from '../models/config';

describe('EconomySystem', () => {
  let economy: EconomySystem;

  beforeEach(() => {
    economy = new EconomySystem();
  });

  describe('initialization', () => {
    it('should start with default starting gold (100)', () => {
      expect(economy.getGold()).toBe(GameConfig.startingGold);
      expect(economy.getGold()).toBe(100);
    });

    it('should allow custom starting gold', () => {
      const custom = new EconomySystem(500);
      expect(custom.getGold()).toBe(500);
    });
  });

  describe('canAfford', () => {
    it('should return true when gold is sufficient', () => {
      expect(economy.canAfford(50)).toBe(true);
      expect(economy.canAfford(100)).toBe(true);
    });

    it('should return false when gold is insufficient', () => {
      expect(economy.canAfford(101)).toBe(false);
      expect(economy.canAfford(200)).toBe(false);
    });

    it('should return true for zero cost', () => {
      expect(economy.canAfford(0)).toBe(true);
    });
  });

  describe('deduct', () => {
    it('should deduct amount and return true when affordable', () => {
      const result = economy.deduct(30);
      expect(result).toBe(true);
      expect(economy.getGold()).toBe(70);
    });

    it('should reject and preserve gold when insufficient', () => {
      const result = economy.deduct(150);
      expect(result).toBe(false);
      expect(economy.getGold()).toBe(100);
    });

    it('should allow deducting exact amount', () => {
      const result = economy.deduct(100);
      expect(result).toBe(true);
      expect(economy.getGold()).toBe(0);
    });

    it('should reject negative amounts', () => {
      const result = economy.deduct(-10);
      expect(result).toBe(false);
      expect(economy.getGold()).toBe(100);
    });

    it('should allow deducting zero', () => {
      const result = economy.deduct(0);
      expect(result).toBe(true);
      expect(economy.getGold()).toBe(100);
    });
  });

  describe('credit', () => {
    it('should add gold to total', () => {
      economy.credit(50);
      expect(economy.getGold()).toBe(150);
    });

    it('should ignore negative credits', () => {
      economy.credit(-10);
      expect(economy.getGold()).toBe(100);
    });

    it('should allow zero credit', () => {
      economy.credit(0);
      expect(economy.getGold()).toBe(100);
    });
  });

  describe('calculateSellValue', () => {
    it('should calculate sell value for full health structure', () => {
      // floor(100/100 * 10 * 0.5) = floor(5) = 5
      const value = economy.calculateSellValue({
        currentHealth: 100,
        maxHealth: 100,
        originalCost: 10,
      });
      expect(value).toBe(5);
    });

    it('should calculate sell value for full health barrier', () => {
      // floor(150/150 * 10 * 0.5) = floor(5) = 5
      const value = economy.calculateSellValue({
        currentHealth: GameConfig.structures.barrier.maxHealth,
        maxHealth: GameConfig.structures.barrier.maxHealth,
        originalCost: GameConfig.structures.barrier.cost,
      });
      expect(value).toBe(5);
    });

    it('should calculate sell value for full health basic tower', () => {
      // floor(50/50 * 25 * 0.5) = floor(12.5) = 12
      const value = economy.calculateSellValue({
        currentHealth: GameConfig.structures.basic_tower.maxHealth,
        maxHealth: GameConfig.structures.basic_tower.maxHealth,
        originalCost: GameConfig.structures.basic_tower.cost,
      });
      expect(value).toBe(12);
    });

    it('should calculate sell value for damaged structure', () => {
      // floor(75/150 * 10 * 0.5) = floor(2.5) = 2
      const value = economy.calculateSellValue({
        currentHealth: 75,
        maxHealth: 150,
        originalCost: 10,
      });
      expect(value).toBe(2);
    });

    it('should return 0 for structure with 0 health', () => {
      const value = economy.calculateSellValue({
        currentHealth: 0,
        maxHealth: 100,
        originalCost: 50,
      });
      expect(value).toBe(0);
    });

    it('should return 0 for invalid maxHealth', () => {
      const value = economy.calculateSellValue({
        currentHealth: 50,
        maxHealth: 0,
        originalCost: 50,
      });
      expect(value).toBe(0);
    });

    it('should floor the result', () => {
      // floor(1/3 * 10 * 0.5) = floor(1.666...) = 1
      const value = economy.calculateSellValue({
        currentHealth: 1,
        maxHealth: 3,
        originalCost: 10,
      });
      expect(value).toBe(1);
    });
  });

  describe('calculateRepairCost', () => {
    it('should calculate repair cost for damaged barrier', () => {
      // ceil(((150-75)/150) * 10 * 0.7) = ceil(0.5 * 10 * 0.7) = ceil(3.5) = 4
      const cost = economy.calculateRepairCost({
        currentHealth: 75,
        maxHealth: 150,
        originalCost: 10,
      });
      expect(cost).toBe(4);
    });

    it('should return 0 for full health structure', () => {
      const cost = economy.calculateRepairCost({
        currentHealth: 100,
        maxHealth: 100,
        originalCost: 50,
      });
      expect(cost).toBe(0);
    });

    it('should calculate max repair cost for nearly dead structure', () => {
      // ceil(((100-1)/100) * 50 * 0.7) = ceil(0.99 * 50 * 0.7) = ceil(34.65) = 35
      const cost = economy.calculateRepairCost({
        currentHealth: 1,
        maxHealth: 100,
        originalCost: 50,
      });
      expect(cost).toBe(35);
    });

    it('should ceil the result', () => {
      // ceil(((50-25)/50) * 25 * 0.7) = ceil(0.5 * 25 * 0.7) = ceil(8.75) = 9
      const cost = economy.calculateRepairCost({
        currentHealth: 25,
        maxHealth: 50,
        originalCost: 25,
      });
      expect(cost).toBe(9);
    });

    it('should return 0 for invalid maxHealth', () => {
      const cost = economy.calculateRepairCost({
        currentHealth: 50,
        maxHealth: 0,
        originalCost: 50,
      });
      expect(cost).toBe(0);
    });

    it('should calculate correctly for basic tower', () => {
      // ceil(((50-25)/50) * 25 * 0.7) = ceil(0.5 * 25 * 0.7) = ceil(8.75) = 9
      const cost = economy.calculateRepairCost({
        currentHealth: 25,
        maxHealth: GameConfig.structures.basic_tower.maxHealth,
        originalCost: GameConfig.structures.basic_tower.cost,
      });
      expect(cost).toBe(9);
    });
  });

  describe('getWaveBonusAmount', () => {
    it('should return 20 for wave 1', () => {
      expect(economy.getWaveBonusAmount(1)).toBe(20);
    });

    it('should return 25 for wave 2', () => {
      expect(economy.getWaveBonusAmount(2)).toBe(25);
    });

    it('should return 30 for wave 3', () => {
      expect(economy.getWaveBonusAmount(3)).toBe(30);
    });

    it('should increase by 5 per wave', () => {
      for (let wave = 1; wave <= 10; wave++) {
        expect(economy.getWaveBonusAmount(wave)).toBe(20 + (wave - 1) * 5);
      }
    });

    it('should be monotonically increasing', () => {
      for (let wave = 2; wave <= 20; wave++) {
        expect(economy.getWaveBonusAmount(wave)).toBeGreaterThan(economy.getWaveBonusAmount(wave - 1));
      }
    });
  });

  describe('getEnemyBounty', () => {
    it('should return 5 for basic enemies', () => {
      expect(economy.getEnemyBounty('basic_enemy')).toBe(5);
    });

    it('should return 15 for brute enemies', () => {
      expect(economy.getEnemyBounty('brute_enemy')).toBe(15);
    });
  });

  describe('awardBounty', () => {
    it('should credit basic enemy bounty (5 gold)', () => {
      const bounty = economy.awardBounty('basic_enemy');
      expect(bounty).toBe(5);
      expect(economy.getGold()).toBe(105);
    });

    it('should credit brute enemy bounty (15 gold)', () => {
      const bounty = economy.awardBounty('brute_enemy');
      expect(bounty).toBe(15);
      expect(economy.getGold()).toBe(115);
    });
  });

  describe('awardWaveBonus', () => {
    it('should credit wave 1 bonus (20 gold)', () => {
      const bonus = economy.awardWaveBonus(1);
      expect(bonus).toBe(20);
      expect(economy.getGold()).toBe(120);
    });

    it('should credit wave 5 bonus (40 gold)', () => {
      const bonus = economy.awardWaveBonus(5);
      expect(bonus).toBe(40);
      expect(economy.getGold()).toBe(140);
    });
  });

  describe('reset', () => {
    it('should reset to starting gold', () => {
      economy.deduct(50);
      economy.reset();
      expect(economy.getGold()).toBe(GameConfig.startingGold);
    });

    it('should reset to custom amount', () => {
      economy.deduct(50);
      economy.reset(200);
      expect(economy.getGold()).toBe(200);
    });
  });

  describe('setGold', () => {
    it('should set gold to specified amount', () => {
      economy.setGold(999);
      expect(economy.getGold()).toBe(999);
    });
  });
});
