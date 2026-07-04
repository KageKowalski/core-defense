/**
 * GameStateManager - Central state authority for Core Defense.
 * Holds all mutable game state and provides transactional updates via action dispatch.
 */

import { EntityId, GridPosition } from '../models/grid';
import { StructureType } from '../models/entities';
import { GameConfig } from '../models/config';
import { Logger } from '../utils/logger';

const log = Logger.create('State');

export type GamePhase = 'preparation' | 'combat' | 'game_over';

export type GameAction =
  | { type: 'PLACE_STRUCTURE'; structureType: StructureType; position: GridPosition }
  | { type: 'SELL_STRUCTURE'; entityId: EntityId }
  | { type: 'REPAIR_STRUCTURE'; entityId: EntityId }
  | { type: 'START_WAVE' }
  | { type: 'RESTART_GAME' }
  | { type: 'ENEMY_REACHED_CORE'; entityId: EntityId; damage: number }
  | { type: 'ENEMY_DESTROYED'; entityId: EntityId; killedByTower: boolean }
  | { type: 'STRUCTURE_DESTROYED'; entityId: EntityId }
  | { type: 'DAMAGE_CORE'; amount: number };

export type ActionResult = { success: true } | { success: false; reason: string };

export interface GameState {
  phase: GamePhase;
  gold: number;
  waveNumber: number;
  coreHealth: number;
  coreMaxHealth: number;
  enemiesRemainingInWave: number;
  totalEnemiesInWave: number;
}

/**
 * GameStateManager class that processes game actions and maintains state.
 */
export class GameStateManager {
  private state: GameState;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    return {
      phase: 'preparation',
      gold: GameConfig.startingGold,
      waveNumber: 1,
      coreHealth: GameConfig.criticalResource.maxHealth,
      coreMaxHealth: GameConfig.criticalResource.maxHealth,
      enemiesRemainingInWave: 0,
      totalEnemiesInWave: 0,
    };
  }

  getPhase(): GamePhase {
    return this.state.phase;
  }

  getGold(): number {
    return this.state.gold;
  }

  getWaveNumber(): number {
    return this.state.waveNumber;
  }

  getCoreHealth(): number {
    return this.state.coreHealth;
  }

  getCoreMaxHealth(): number {
    return this.state.coreMaxHealth;
  }

  getEnemiesRemaining(): number {
    return this.state.enemiesRemainingInWave;
  }

  getTotalEnemiesInWave(): number {
    return this.state.totalEnemiesInWave;
  }

  getState(): Readonly<GameState> {
    return { ...this.state };
  }

  /**
   * Sets the gold amount directly (used by EconomySystem integration).
   */
  setGold(amount: number): void {
    this.state.gold = amount;
  }

  /**
   * Sets the enemies remaining count for the current wave.
   */
  setEnemiesRemaining(count: number): void {
    this.state.enemiesRemainingInWave = count;
    this.state.totalEnemiesInWave = count;
  }

  /**
   * Dispatch a game action and return the result.
   */
  dispatch(action: GameAction): ActionResult {
    let result: ActionResult;

    switch (action.type) {
      case 'START_WAVE':
        result = this.handleStartWave();
        break;
      case 'RESTART_GAME':
        result = this.handleRestartGame();
        break;
      case 'DAMAGE_CORE':
        result = this.handleDamageCore(action.amount);
        break;
      case 'ENEMY_REACHED_CORE':
        result = this.handleEnemyReachedCore(action.entityId, action.damage);
        break;
      case 'ENEMY_DESTROYED':
        result = this.handleEnemyDestroyed(action.entityId, action.killedByTower);
        break;
      case 'PLACE_STRUCTURE':
        result = this.handlePlaceStructure(action.structureType, action.position);
        break;
      case 'SELL_STRUCTURE':
        result = this.handleSellStructure(action.entityId);
        break;
      case 'REPAIR_STRUCTURE':
        result = this.handleRepairStructure(action.entityId);
        break;
      case 'STRUCTURE_DESTROYED':
        result = this.handleStructureDestroyed(action.entityId);
        break;
      default:
        result = { success: false, reason: 'Unknown action type' };
    }

    if (result.success) {
      log.debug('Action dispatched', { action: action.type });
    } else {
      log.warn('Action failed', { action: action.type, reason: result.reason });
    }

    return result;
  }

  private handleStartWave(): ActionResult {
    if (this.state.phase !== 'preparation') {
      return { success: false, reason: 'Can only start wave during preparation phase' };
    }

    // Calculate wave composition
    const totalEnemies = 5 + (this.state.waveNumber - 1) * 2;
    this.state.phase = 'combat';
    this.state.enemiesRemainingInWave = totalEnemies;
    this.state.totalEnemiesInWave = totalEnemies;

    log.info('Wave started', { waveNumber: this.state.waveNumber, totalEnemies });

    return { success: true };
  }

  private handleRestartGame(): ActionResult {
    this.state = this.createInitialState();
    log.info('Game restarted');
    return { success: true };
  }

  private handleDamageCore(amount: number): ActionResult {
    if (this.state.phase === 'game_over') {
      return { success: false, reason: 'Game is already over' };
    }

    if (amount <= 0) {
      return { success: false, reason: 'Damage amount must be positive' };
    }

    this.state.coreHealth -= amount;
    log.info('Core damaged', { damage: amount, remainingHealth: this.state.coreHealth });

    if (this.state.coreHealth <= 0) {
      this.state.coreHealth = 0;
      this.state.phase = 'game_over';
      log.error('Core destroyed - game over', { waveNumber: this.state.waveNumber });
    }

    return { success: true };
  }

  private handleEnemyReachedCore(entityId: EntityId, damage: number): ActionResult {
    if (this.state.phase !== 'combat') {
      return { success: false, reason: 'Enemies can only reach core during combat' };
    }

    // Apply damage to core
    this.state.coreHealth -= damage;

    // Decrement enemies remaining
    this.state.enemiesRemainingInWave = Math.max(0, this.state.enemiesRemainingInWave - 1);

    log.info('Enemy reached core', {
      entityId,
      damage,
      coreHealth: this.state.coreHealth,
      enemiesRemaining: this.state.enemiesRemainingInWave,
    });

    // Check for game over
    if (this.state.coreHealth <= 0) {
      this.state.coreHealth = 0;
      this.state.phase = 'game_over';
      log.error('Core destroyed - game over', { waveNumber: this.state.waveNumber });
    }

    return { success: true };
  }

  private handleEnemyDestroyed(entityId: EntityId, killedByTower: boolean): ActionResult {
    if (this.state.phase !== 'combat') {
      return { success: false, reason: 'Enemies can only be destroyed during combat' };
    }

    // Decrement enemies remaining
    this.state.enemiesRemainingInWave = Math.max(0, this.state.enemiesRemainingInWave - 1);

    return { success: true };
  }

  private handlePlaceStructure(structureType: StructureType, position: GridPosition): ActionResult {
    if (this.state.phase !== 'preparation') {
      return { success: false, reason: 'Can only place structures during preparation phase' };
    }

    const cost = GameConfig.structures[structureType].cost;

    if (this.state.gold < cost) {
      return { success: false, reason: 'Insufficient gold' };
    }

    this.state.gold -= cost;
    return { success: true };
  }

  private handleSellStructure(entityId: EntityId): ActionResult {
    if (this.state.phase !== 'preparation') {
      return { success: false, reason: 'Can only sell structures during preparation phase' };
    }

    // Sell value is calculated and credited by EconomySystem; this just validates the action
    return { success: true };
  }

  private handleRepairStructure(entityId: EntityId): ActionResult {
    if (this.state.phase !== 'preparation') {
      return { success: false, reason: 'Can only repair structures during preparation phase' };
    }

    // Repair cost is calculated and deducted by EconomySystem; this just validates the action
    return { success: true };
  }

  private handleStructureDestroyed(entityId: EntityId): ActionResult {
    // Structure destroyed - grid cell freed, path recalculation triggered externally
    return { success: true };
  }
}
