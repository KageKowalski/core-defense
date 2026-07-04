/**
 * PhaseManager - Handles transitions between Preparation, Combat, and Game Over phases.
 * Uses event callbacks for phase enter/exit.
 */

import { GamePhase } from './state';
import { Logger } from '../utils/logger';

const log = Logger.create('Phase');

export type PhaseCallback = () => void;

export interface PhaseTransitionResult {
  success: boolean;
  previousPhase: GamePhase;
  newPhase: GamePhase;
}

/**
 * PhaseManager class that manages game phase transitions and fires callbacks.
 */
export class PhaseManager {
  private currentPhase: GamePhase;
  private enterCallbacks: Map<GamePhase, PhaseCallback[]>;
  private exitCallbacks: Map<GamePhase, PhaseCallback[]>;

  constructor(initialPhase: GamePhase = 'preparation') {
    this.currentPhase = initialPhase;
    this.enterCallbacks = new Map();
    this.exitCallbacks = new Map();

    // Initialize callback arrays for each phase
    this.enterCallbacks.set('preparation', []);
    this.enterCallbacks.set('combat', []);
    this.enterCallbacks.set('game_over', []);
    this.exitCallbacks.set('preparation', []);
    this.exitCallbacks.set('combat', []);
    this.exitCallbacks.set('game_over', []);
  }

  getCurrentPhase(): GamePhase {
    return this.currentPhase;
  }

  /**
   * Register a callback to be invoked when entering a specific phase.
   */
  onPhaseEnter(phase: GamePhase, callback: PhaseCallback): void {
    const callbacks = this.enterCallbacks.get(phase);
    if (callbacks) {
      callbacks.push(callback);
    }
  }

  /**
   * Register a callback to be invoked when exiting a specific phase.
   */
  onPhaseExit(phase: GamePhase, callback: PhaseCallback): void {
    const callbacks = this.exitCallbacks.get(phase);
    if (callbacks) {
      callbacks.push(callback);
    }
  }

  /**
   * Attempt to transition to a new phase.
   * Returns the result of the transition, including whether it was valid.
   */
  transitionTo(newPhase: GamePhase): PhaseTransitionResult {
    const previousPhase = this.currentPhase;

    if (!this.isValidTransition(previousPhase, newPhase)) {
      log.warn('Invalid phase transition attempted', { from: previousPhase, to: newPhase });
      return { success: false, previousPhase, newPhase };
    }

    // Fire exit callbacks for current phase
    this.fireExitCallbacks(previousPhase);

    // Update phase
    this.currentPhase = newPhase;

    // Fire enter callbacks for new phase
    this.fireEnterCallbacks(newPhase);

    log.info('Phase transition', { from: previousPhase, to: newPhase });

    return { success: true, previousPhase, newPhase };
  }

  /**
   * Validates whether a phase transition is allowed.
   * Valid transitions:
   * - preparation → combat (start wave)
   * - combat → preparation (wave complete)
   * - combat → game_over (core destroyed)
   * - game_over → preparation (restart game)
   */
  isValidTransition(from: GamePhase, to: GamePhase): boolean {
    const validTransitions: Record<GamePhase, GamePhase[]> = {
      preparation: ['combat'],
      combat: ['preparation', 'game_over'],
      game_over: ['preparation'],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  private fireExitCallbacks(phase: GamePhase): void {
    const callbacks = this.exitCallbacks.get(phase);
    if (callbacks) {
      for (const callback of callbacks) {
        callback();
      }
    }
  }

  private fireEnterCallbacks(phase: GamePhase): void {
    const callbacks = this.enterCallbacks.get(phase);
    if (callbacks) {
      for (const callback of callbacks) {
        callback();
      }
    }
  }

  /**
   * Resets the phase manager to its initial state (preparation phase).
   * Clears all registered callbacks.
   */
  reset(): void {
    this.currentPhase = 'preparation';
  }
}

/**
 * Describes the expected behavior when transitioning between phases.
 * This is a helper that returns what should happen for each transition.
 */
export interface PhaseTransitionEffects {
  shopVisible: boolean;
  gridOverlayVisible: boolean;
  spawningActive: boolean;
  frozen: boolean;
  incrementWave: boolean;
  awardWaveBonus: boolean;
  fullReset: boolean;
}

/**
 * Returns the expected side effects for a given phase transition.
 */
export function getTransitionEffects(from: GamePhase, to: GamePhase): PhaseTransitionEffects {
  const defaults: PhaseTransitionEffects = {
    shopVisible: false,
    gridOverlayVisible: false,
    spawningActive: false,
    frozen: false,
    incrementWave: false,
    awardWaveBonus: false,
    fullReset: false,
  };

  const key = `${from}->${to}`;

  switch (key) {
    case 'preparation->combat':
      // Hide shop, disable grid overlay, begin spawning
      return {
        ...defaults,
        shopVisible: false,
        gridOverlayVisible: false,
        spawningActive: true,
      };

    case 'combat->preparation':
      // Show shop, increment wave, award wave bonus
      return {
        ...defaults,
        shopVisible: true,
        gridOverlayVisible: true,
        incrementWave: true,
        awardWaveBonus: true,
      };

    case 'combat->game_over':
      // Freeze all systems (stop movement, spawning, firing)
      return {
        ...defaults,
        frozen: true,
      };

    case 'game_over->preparation':
      // Full state reset to initial
      return {
        ...defaults,
        shopVisible: true,
        gridOverlayVisible: true,
        fullReset: true,
      };

    default:
      return defaults;
  }
}
