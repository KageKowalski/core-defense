/**
 * Unit tests for PhaseManager
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhaseManager, getTransitionEffects } from './phase-manager';

describe('PhaseManager', () => {
  let phaseManager: PhaseManager;

  beforeEach(() => {
    phaseManager = new PhaseManager();
  });

  describe('initialization', () => {
    it('should start in preparation phase by default', () => {
      expect(phaseManager.getCurrentPhase()).toBe('preparation');
    });

    it('should start in specified phase', () => {
      const pm = new PhaseManager('combat');
      expect(pm.getCurrentPhase()).toBe('combat');
    });
  });

  describe('valid transitions', () => {
    it('should allow preparation → combat', () => {
      const result = phaseManager.transitionTo('combat');
      expect(result.success).toBe(true);
      expect(result.previousPhase).toBe('preparation');
      expect(result.newPhase).toBe('combat');
      expect(phaseManager.getCurrentPhase()).toBe('combat');
    });

    it('should allow combat → preparation', () => {
      phaseManager.transitionTo('combat');
      const result = phaseManager.transitionTo('preparation');
      expect(result.success).toBe(true);
      expect(phaseManager.getCurrentPhase()).toBe('preparation');
    });

    it('should allow combat → game_over', () => {
      phaseManager.transitionTo('combat');
      const result = phaseManager.transitionTo('game_over');
      expect(result.success).toBe(true);
      expect(phaseManager.getCurrentPhase()).toBe('game_over');
    });

    it('should allow game_over → preparation', () => {
      phaseManager.transitionTo('combat');
      phaseManager.transitionTo('game_over');
      const result = phaseManager.transitionTo('preparation');
      expect(result.success).toBe(true);
      expect(phaseManager.getCurrentPhase()).toBe('preparation');
    });
  });

  describe('invalid transitions', () => {
    it('should reject preparation → game_over', () => {
      const result = phaseManager.transitionTo('game_over');
      expect(result.success).toBe(false);
      expect(phaseManager.getCurrentPhase()).toBe('preparation');
    });

    it('should reject preparation → preparation', () => {
      const result = phaseManager.transitionTo('preparation');
      expect(result.success).toBe(false);
      expect(phaseManager.getCurrentPhase()).toBe('preparation');
    });

    it('should reject game_over → combat', () => {
      phaseManager.transitionTo('combat');
      phaseManager.transitionTo('game_over');
      const result = phaseManager.transitionTo('combat');
      expect(result.success).toBe(false);
      expect(phaseManager.getCurrentPhase()).toBe('game_over');
    });

    it('should reject combat → combat', () => {
      phaseManager.transitionTo('combat');
      const result = phaseManager.transitionTo('combat');
      expect(result.success).toBe(false);
      expect(phaseManager.getCurrentPhase()).toBe('combat');
    });
  });

  describe('phase enter callbacks', () => {
    it('should fire enter callback when transitioning to a phase', () => {
      const enterCombat = vi.fn();
      phaseManager.onPhaseEnter('combat', enterCombat);

      phaseManager.transitionTo('combat');
      expect(enterCombat).toHaveBeenCalledTimes(1);
    });

    it('should not fire enter callback for invalid transition', () => {
      const enterGameOver = vi.fn();
      phaseManager.onPhaseEnter('game_over', enterGameOver);

      phaseManager.transitionTo('game_over'); // invalid from preparation
      expect(enterGameOver).not.toHaveBeenCalled();
    });

    it('should support multiple enter callbacks', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      phaseManager.onPhaseEnter('combat', cb1);
      phaseManager.onPhaseEnter('combat', cb2);

      phaseManager.transitionTo('combat');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('phase exit callbacks', () => {
    it('should fire exit callback when leaving a phase', () => {
      const exitPrep = vi.fn();
      phaseManager.onPhaseExit('preparation', exitPrep);

      phaseManager.transitionTo('combat');
      expect(exitPrep).toHaveBeenCalledTimes(1);
    });

    it('should not fire exit callback for invalid transition', () => {
      const exitPrep = vi.fn();
      phaseManager.onPhaseExit('preparation', exitPrep);

      phaseManager.transitionTo('game_over'); // invalid
      expect(exitPrep).not.toHaveBeenCalled();
    });

    it('should fire exit before enter', () => {
      const order: string[] = [];
      phaseManager.onPhaseExit('preparation', () => order.push('exit_prep'));
      phaseManager.onPhaseEnter('combat', () => order.push('enter_combat'));

      phaseManager.transitionTo('combat');
      expect(order).toEqual(['exit_prep', 'enter_combat']);
    });
  });

  describe('isValidTransition', () => {
    it('should validate all valid transitions', () => {
      expect(phaseManager.isValidTransition('preparation', 'combat')).toBe(true);
      expect(phaseManager.isValidTransition('combat', 'preparation')).toBe(true);
      expect(phaseManager.isValidTransition('combat', 'game_over')).toBe(true);
      expect(phaseManager.isValidTransition('game_over', 'preparation')).toBe(true);
    });

    it('should reject all invalid transitions', () => {
      expect(phaseManager.isValidTransition('preparation', 'game_over')).toBe(false);
      expect(phaseManager.isValidTransition('preparation', 'preparation')).toBe(false);
      expect(phaseManager.isValidTransition('combat', 'combat')).toBe(false);
      expect(phaseManager.isValidTransition('game_over', 'combat')).toBe(false);
      expect(phaseManager.isValidTransition('game_over', 'game_over')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to preparation phase', () => {
      phaseManager.transitionTo('combat');
      phaseManager.transitionTo('game_over');
      phaseManager.reset();
      expect(phaseManager.getCurrentPhase()).toBe('preparation');
    });
  });
});

describe('getTransitionEffects', () => {
  describe('preparation → combat', () => {
    it('should hide shop and grid overlay, enable spawning', () => {
      const effects = getTransitionEffects('preparation', 'combat');
      expect(effects.shopVisible).toBe(false);
      expect(effects.gridOverlayVisible).toBe(false);
      expect(effects.spawningActive).toBe(true);
      expect(effects.frozen).toBe(false);
      expect(effects.incrementWave).toBe(false);
      expect(effects.awardWaveBonus).toBe(false);
      expect(effects.fullReset).toBe(false);
    });
  });

  describe('combat → preparation', () => {
    it('should show shop, increment wave, award bonus', () => {
      const effects = getTransitionEffects('combat', 'preparation');
      expect(effects.shopVisible).toBe(true);
      expect(effects.gridOverlayVisible).toBe(true);
      expect(effects.spawningActive).toBe(false);
      expect(effects.frozen).toBe(false);
      expect(effects.incrementWave).toBe(true);
      expect(effects.awardWaveBonus).toBe(true);
      expect(effects.fullReset).toBe(false);
    });
  });

  describe('combat → game_over', () => {
    it('should freeze all systems', () => {
      const effects = getTransitionEffects('combat', 'game_over');
      expect(effects.frozen).toBe(true);
      expect(effects.shopVisible).toBe(false);
      expect(effects.spawningActive).toBe(false);
      expect(effects.incrementWave).toBe(false);
      expect(effects.awardWaveBonus).toBe(false);
      expect(effects.fullReset).toBe(false);
    });
  });

  describe('game_over → preparation', () => {
    it('should trigger full reset', () => {
      const effects = getTransitionEffects('game_over', 'preparation');
      expect(effects.fullReset).toBe(true);
      expect(effects.shopVisible).toBe(true);
      expect(effects.gridOverlayVisible).toBe(true);
      expect(effects.frozen).toBe(false);
    });
  });
});
