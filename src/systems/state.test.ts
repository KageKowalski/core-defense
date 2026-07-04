/**
 * Unit tests for GameStateManager
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateManager, GamePhase } from './state';
import { GameConfig } from '../models/config';

describe('GameStateManager', () => {
  let manager: GameStateManager;

  beforeEach(() => {
    manager = new GameStateManager();
  });

  describe('initialization', () => {
    it('should start in preparation phase', () => {
      expect(manager.getPhase()).toBe('preparation');
    });

    it('should start with starting gold from config (100)', () => {
      expect(manager.getGold()).toBe(GameConfig.startingGold);
      expect(manager.getGold()).toBe(100);
    });

    it('should start at wave 1', () => {
      expect(manager.getWaveNumber()).toBe(1);
    });

    it('should start with full core health', () => {
      expect(manager.getCoreHealth()).toBe(GameConfig.criticalResource.maxHealth);
      expect(manager.getCoreHealth()).toBe(100);
    });

    it('should start with 0 enemies remaining', () => {
      expect(manager.getEnemiesRemaining()).toBe(0);
    });
  });

  describe('START_WAVE action', () => {
    it('should transition from preparation to combat', () => {
      const result = manager.dispatch({ type: 'START_WAVE' });
      expect(result.success).toBe(true);
      expect(manager.getPhase()).toBe('combat');
    });

    it('should set enemies remaining based on wave number', () => {
      // Wave 1: 5 + (1-1)*2 = 5 enemies
      manager.dispatch({ type: 'START_WAVE' });
      expect(manager.getEnemiesRemaining()).toBe(5);
      expect(manager.getTotalEnemiesInWave()).toBe(5);
    });

    it('should fail if not in preparation phase', () => {
      manager.dispatch({ type: 'START_WAVE' }); // go to combat
      const result = manager.dispatch({ type: 'START_WAVE' });
      expect(result.success).toBe(false);
    });
  });

  describe('RESTART_GAME action', () => {
    it('should reset all state to initial values', () => {
      // Make some state changes
      manager.dispatch({ type: 'START_WAVE' });
      manager.dispatch({ type: 'DAMAGE_CORE', amount: 50 });

      const result = manager.dispatch({ type: 'RESTART_GAME' });
      expect(result.success).toBe(true);
      expect(manager.getPhase()).toBe('preparation');
      expect(manager.getGold()).toBe(GameConfig.startingGold);
      expect(manager.getWaveNumber()).toBe(1);
      expect(manager.getCoreHealth()).toBe(GameConfig.criticalResource.maxHealth);
      expect(manager.getEnemiesRemaining()).toBe(0);
    });

    it('should work from game_over phase', () => {
      manager.dispatch({ type: 'START_WAVE' });
      manager.dispatch({ type: 'DAMAGE_CORE', amount: 200 });
      expect(manager.getPhase()).toBe('game_over');

      const result = manager.dispatch({ type: 'RESTART_GAME' });
      expect(result.success).toBe(true);
      expect(manager.getPhase()).toBe('preparation');
    });
  });

  describe('DAMAGE_CORE action', () => {
    it('should reduce core health by the given amount', () => {
      manager.dispatch({ type: 'START_WAVE' });
      const result = manager.dispatch({ type: 'DAMAGE_CORE', amount: 30 });
      expect(result.success).toBe(true);
      expect(manager.getCoreHealth()).toBe(70);
    });

    it('should transition to game_over when health reaches zero', () => {
      manager.dispatch({ type: 'START_WAVE' });
      manager.dispatch({ type: 'DAMAGE_CORE', amount: 100 });
      expect(manager.getPhase()).toBe('game_over');
      expect(manager.getCoreHealth()).toBe(0);
    });

    it('should transition to game_over when health goes below zero', () => {
      manager.dispatch({ type: 'START_WAVE' });
      manager.dispatch({ type: 'DAMAGE_CORE', amount: 150 });
      expect(manager.getPhase()).toBe('game_over');
      expect(manager.getCoreHealth()).toBe(0);
    });

    it('should reject zero or negative damage', () => {
      manager.dispatch({ type: 'START_WAVE' });
      const result = manager.dispatch({ type: 'DAMAGE_CORE', amount: 0 });
      expect(result.success).toBe(false);
    });

    it('should fail when game is already over', () => {
      manager.dispatch({ type: 'START_WAVE' });
      manager.dispatch({ type: 'DAMAGE_CORE', amount: 200 });
      const result = manager.dispatch({ type: 'DAMAGE_CORE', amount: 10 });
      expect(result.success).toBe(false);
    });
  });

  describe('ENEMY_REACHED_CORE action', () => {
    it('should apply damage and decrement enemies remaining', () => {
      manager.dispatch({ type: 'START_WAVE' });
      const result = manager.dispatch({ type: 'ENEMY_REACHED_CORE', entityId: 'e1', damage: 10 });
      expect(result.success).toBe(true);
      expect(manager.getCoreHealth()).toBe(90);
      expect(manager.getEnemiesRemaining()).toBe(4);
    });

    it('should trigger game over if lethal damage', () => {
      manager.dispatch({ type: 'START_WAVE' });
      manager.dispatch({ type: 'ENEMY_REACHED_CORE', entityId: 'e1', damage: 100 });
      expect(manager.getPhase()).toBe('game_over');
    });

    it('should fail outside combat phase', () => {
      const result = manager.dispatch({ type: 'ENEMY_REACHED_CORE', entityId: 'e1', damage: 10 });
      expect(result.success).toBe(false);
    });
  });

  describe('ENEMY_DESTROYED action', () => {
    it('should decrement enemies remaining', () => {
      manager.dispatch({ type: 'START_WAVE' });
      const result = manager.dispatch({ type: 'ENEMY_DESTROYED', entityId: 'e1', killedByTower: true });
      expect(result.success).toBe(true);
      expect(manager.getEnemiesRemaining()).toBe(4);
    });

    it('should not go below zero enemies remaining', () => {
      manager.dispatch({ type: 'START_WAVE' });
      // Kill all 5 enemies
      for (let i = 0; i < 5; i++) {
        manager.dispatch({ type: 'ENEMY_DESTROYED', entityId: `e${i}`, killedByTower: true });
      }
      expect(manager.getEnemiesRemaining()).toBe(0);

      // One more should still be 0
      manager.dispatch({ type: 'ENEMY_DESTROYED', entityId: 'extra', killedByTower: true });
      expect(manager.getEnemiesRemaining()).toBe(0);
    });

    it('should fail outside combat phase', () => {
      const result = manager.dispatch({ type: 'ENEMY_DESTROYED', entityId: 'e1', killedByTower: true });
      expect(result.success).toBe(false);
    });
  });

  describe('PLACE_STRUCTURE action', () => {
    it('should deduct gold when placing a barrier', () => {
      const result = manager.dispatch({
        type: 'PLACE_STRUCTURE',
        structureType: 'barrier',
        position: { row: 0, col: 0 },
      });
      expect(result.success).toBe(true);
      expect(manager.getGold()).toBe(100 - GameConfig.structures.barrier.cost);
    });

    it('should deduct gold when placing a basic_tower', () => {
      const result = manager.dispatch({
        type: 'PLACE_STRUCTURE',
        structureType: 'basic_tower',
        position: { row: 0, col: 0 },
      });
      expect(result.success).toBe(true);
      expect(manager.getGold()).toBe(100 - GameConfig.structures.basic_tower.cost);
    });

    it('should reject placement with insufficient gold', () => {
      manager.setGold(5); // Not enough for any structure
      const result = manager.dispatch({
        type: 'PLACE_STRUCTURE',
        structureType: 'barrier',
        position: { row: 0, col: 0 },
      });
      expect(result.success).toBe(false);
      expect(manager.getGold()).toBe(5);
    });

    it('should reject placement during combat phase', () => {
      manager.dispatch({ type: 'START_WAVE' });
      const result = manager.dispatch({
        type: 'PLACE_STRUCTURE',
        structureType: 'barrier',
        position: { row: 0, col: 0 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SELL_STRUCTURE action', () => {
    it('should succeed during preparation phase', () => {
      const result = manager.dispatch({ type: 'SELL_STRUCTURE', entityId: 's1' });
      expect(result.success).toBe(true);
    });

    it('should fail during combat phase', () => {
      manager.dispatch({ type: 'START_WAVE' });
      const result = manager.dispatch({ type: 'SELL_STRUCTURE', entityId: 's1' });
      expect(result.success).toBe(false);
    });
  });

  describe('REPAIR_STRUCTURE action', () => {
    it('should succeed during preparation phase', () => {
      const result = manager.dispatch({ type: 'REPAIR_STRUCTURE', entityId: 's1' });
      expect(result.success).toBe(true);
    });

    it('should fail during combat phase', () => {
      manager.dispatch({ type: 'START_WAVE' });
      const result = manager.dispatch({ type: 'REPAIR_STRUCTURE', entityId: 's1' });
      expect(result.success).toBe(false);
    });
  });

  describe('STRUCTURE_DESTROYED action', () => {
    it('should always succeed', () => {
      manager.dispatch({ type: 'START_WAVE' });
      const result = manager.dispatch({ type: 'STRUCTURE_DESTROYED', entityId: 's1' });
      expect(result.success).toBe(true);
    });
  });

  describe('setGold', () => {
    it('should set gold to specified amount', () => {
      manager.setGold(250);
      expect(manager.getGold()).toBe(250);
    });
  });

  describe('setEnemiesRemaining', () => {
    it('should set enemies remaining and total', () => {
      manager.setEnemiesRemaining(10);
      expect(manager.getEnemiesRemaining()).toBe(10);
      expect(manager.getTotalEnemiesInWave()).toBe(10);
    });
  });
});
