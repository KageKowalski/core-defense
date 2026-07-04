/**
 * SystemPipeline - Orchestrates per-tick system updates in correct order.
 * Each tick: Spawn → Pathfinding → Movement → Combat → handle events.
 * Skips all updates when phase is game_over.
 */

import { GameStateManager, GamePhase } from './state';
import { SpawnSystem } from './spawning';
import { PathfindingSystem } from './pathfinding';
import { CombatSystem, CombatEvent } from './combat';
import { EconomySystem } from './economy';
import { EntityStore, removeEntity } from '../models/entity-store';
import { updateEnemyMovement, MovementEvent } from './movement';
import { Grid } from '../models/grid';
import { Structure } from '../models/entities';
import { Logger } from '../utils/logger';

const log = Logger.create('Pipeline');

export interface SystemPipelineConfig {
  gameState: GameStateManager;
  entityStore: EntityStore;
  grid: Grid;
  spawnSystem: SpawnSystem;
  pathfindingSystem: PathfindingSystem;
  combatSystem: CombatSystem;
  economySystem: EconomySystem;
}

export type PipelineEvent =
  | { type: 'enemy_killed'; enemyId: string; bounty: number }
  | { type: 'enemy_reached_core'; enemyId: string; damage: number }
  | { type: 'structure_destroyed'; structureId: string }
  | { type: 'wave_complete' }
  | { type: 'game_over' };

export type PipelineEventCallback = (event: PipelineEvent) => void;

/**
 * SystemPipeline class that runs all game systems in order each tick.
 */
export class SystemPipeline {
  private gameState: GameStateManager;
  private entityStore: EntityStore;
  private grid: Grid;
  private spawnSystem: SpawnSystem;
  private pathfindingSystem: PathfindingSystem;
  private combatSystem: CombatSystem;
  private economySystem: EconomySystem;
  private eventCallbacks: PipelineEventCallback[] = [];

  constructor(config: SystemPipelineConfig) {
    this.gameState = config.gameState;
    this.entityStore = config.entityStore;
    this.grid = config.grid;
    this.spawnSystem = config.spawnSystem;
    this.pathfindingSystem = config.pathfindingSystem;
    this.combatSystem = config.combatSystem;
    this.economySystem = config.economySystem;
  }

  /**
   * Register a callback to receive pipeline events.
   */
  onEvent(callback: PipelineEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  private emit(event: PipelineEvent): void {
    log.info('Pipeline event', { eventType: event.type });
    for (const cb of this.eventCallbacks) {
      cb(event);
    }
  }

  /**
   * Runs one tick of all systems.
   * @param dt - Fixed time delta in seconds
   */
  update(dt: number): void {
    const phase = this.gameState.getPhase();

    // Skip all updates when game is over
    if (phase === 'game_over') {
      return;
    }

    // Only run combat systems during combat phase
    if (phase === 'combat') {
      // 1. Spawn system
      this.spawnSystem.update(dt);

      // 2. Pathfinding (if dirty)
      this.pathfindingSystem.update();

      // 3. Movement
      this.updateMovement(dt);

      // 4. Combat
      this.updateCombat(dt);

      // 5. Check wave completion
      this.checkWaveCompletion();
    }
  }

  /**
   * Updates all enemy movement and handles movement events.
   */
  private updateMovement(dt: number): void {
    const enemies = Array.from(this.entityStore.enemies.values());
    const coreCells = this.entityStore.criticalResource.cells;

    for (const enemy of enemies) {
      const events = updateEnemyMovement(
        dt,
        enemy,
        (pos) => this.getBarrierAtPosition(pos),
        coreCells
      );

      for (const event of events) {
        switch (event.type) {
          case 'reached_core':
            this.gameState.dispatch({
              type: 'ENEMY_REACHED_CORE',
              entityId: event.enemyId,
              damage: event.damage,
            });
            removeEntity(this.entityStore, event.enemyId);
            this.emit({ type: 'enemy_reached_core', enemyId: event.enemyId, damage: event.damage });

            // Check for game over
            if (this.gameState.getPhase() === 'game_over') {
              this.emit({ type: 'game_over' });
              return;
            }
            break;

          case 'barrier_destroyed':
            this.handleBarrierDestroyed(event.barrierId);
            break;

          case 'barrier_damaged':
            // Visual feedback handled by render system
            break;
        }
      }
    }
  }

  /**
   * Updates combat system and handles combat events.
   */
  private updateCombat(dt: number): void {
    const events = this.combatSystem.update(dt);

    for (const event of events) {
      if (event.type === 'enemy_destroyed') {
        const enemy = this.entityStore.enemies.get(event.enemyId);
        if (enemy) {
          // Award bounty
          const bounty = this.economySystem.awardBounty(enemy.type);
          this.gameState.setGold(this.economySystem.getGold());

          // Dispatch enemy destroyed
          this.gameState.dispatch({
            type: 'ENEMY_DESTROYED',
            entityId: event.enemyId,
            killedByTower: event.killedByTower,
          });

          // Remove from entity store
          removeEntity(this.entityStore, event.enemyId);
          this.emit({ type: 'enemy_killed', enemyId: event.enemyId, bounty });
        }
      }
    }
  }

  /**
   * Handles barrier destruction: free grid cell, trigger path recalculation.
   */
  private handleBarrierDestroyed(barrierId: string): void {
    const barrier = this.entityStore.structures.get(barrierId);
    if (!barrier) return;

    // Free the grid cell
    const { row, col } = barrier.position;
    const cell = this.grid.cells[row][col];
    cell.occupant = null;
    cell.isWalkable = true;

    // Remove from entity store
    removeEntity(this.entityStore, barrierId);

    // Trigger path recalculation
    this.pathfindingSystem.markDirty();

    log.info('Barrier destroyed', { barrierId, position: { row, col } });

    // Dispatch
    this.gameState.dispatch({ type: 'STRUCTURE_DESTROYED', entityId: barrierId });
    this.emit({ type: 'structure_destroyed', structureId: barrierId });
  }

  /**
   * Checks if wave is complete (no enemies remaining and none left to spawn).
   */
  private checkWaveCompletion(): void {
    const enemiesAlive = this.entityStore.enemies.size;
    const enemiesToSpawn = this.spawnSystem.getEnemiesRemainingToSpawn();

    if (enemiesAlive === 0 && enemiesToSpawn === 0 && !this.spawnSystem.isActive()) {
      log.info('Wave complete', {
        waveNumber: this.gameState.getWaveNumber(),
        enemiesAlive,
        enemiesToSpawn,
      });
      this.emit({ type: 'wave_complete' });
    }
  }

  /**
   * Gets a barrier at a given grid position (if any).
   */
  private getBarrierAtPosition(pos: { row: number; col: number }): Structure | null {
    const cell = this.grid.cells[pos.row]?.[pos.col];
    if (!cell || !cell.occupant) return null;

    const structure = this.entityStore.structures.get(cell.occupant);
    if (structure && structure.type === 'barrier') {
      return structure;
    }
    return null;
  }
}
