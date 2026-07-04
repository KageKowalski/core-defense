/**
 * Main Entry Point - Core Defense
 * Initializes all systems and wires event flows.
 */

import { createGrid, initializeCriticalResource, gridToWorld } from './models/grid';
import { CriticalResource } from './models/entities';
import { GameConfig } from './models/config';
import { createEntityStore, EntityStore, removeEntity } from './models/entity-store';
import { GameStateManager } from './systems/state';
import { PhaseManager } from './systems/phase-manager';
import { EconomySystem } from './systems/economy';
import { PathfindingSystem } from './systems/pathfinding';
import { CombatSystem } from './systems/combat';
import { SpawnSystem } from './systems/spawning';
import { GameLoop } from './systems/game-loop';
import { SystemPipeline } from './systems/system-pipeline';
import { RenderSystem } from './systems/render-system';
import { VFXSystem } from './systems/vfx';
import { UISystem } from './systems/ui-system';
import { InputSystem } from './systems/input-system';
import { placeStructure, sellStructure, repairStructure } from './systems/placement';
import { Logger } from './utils/logger';

const log = Logger.create('Init');

// --- Initialize Game ---

function initGame(): void {
  log.info('Initializing Core Defense', {
    gridSize: `${GameConfig.grid.width}x${GameConfig.grid.height}`,
    startingGold: GameConfig.startingGold,
  });

  // Get container element
  const container = document.getElementById('game-container');
  if (!container) {
    log.error('Game container element not found');
    console.error('Game container not found');
    return;
  }

  // 1. Create Grid
  const grid = createGrid(GameConfig.grid.width, GameConfig.grid.height);

  // 2. Create Critical Resource
  const crId = crypto.randomUUID();
  const crPositions = initializeCriticalResource(grid, crId);
  const crWorldPos = gridToWorld(
    { row: GameConfig.grid.height / 2 - 1, col: GameConfig.grid.width / 2 - 1 },
    GameConfig.grid.cellSize
  );

  const criticalResource: CriticalResource = {
    id: crId,
    type: 'critical_resource',
    position: { row: GameConfig.grid.height / 2 - 1, col: GameConfig.grid.width / 2 - 1 },
    worldPosition: crWorldPos,
    maxHealth: GameConfig.criticalResource.maxHealth,
    currentHealth: GameConfig.criticalResource.maxHealth,
    cells: crPositions,
  };

  // 3. Create EntityStore
  const entityStore = createEntityStore(criticalResource);

  // 4. Initialize Systems
  const gameState = new GameStateManager();
  const phaseManager = new PhaseManager('preparation');
  const economySystem = new EconomySystem(GameConfig.startingGold);
  const pathfindingSystem = new PathfindingSystem(grid, entityStore);
  const combatSystem = new CombatSystem(entityStore);
  const spawnSystem = new SpawnSystem(
    entityStore,
    pathfindingSystem,
    GameConfig.grid.width,
    GameConfig.grid.height
  );

  // 5. Render System
  const renderSystem = new RenderSystem(container, entityStore);

  // 6. VFX System
  const vfxSystem = new VFXSystem(renderSystem.getScene());

  // 7. UI System
  const uiContainer = document.getElementById('ui-overlay');
  if (!uiContainer) {
    log.error('UI overlay container element not found');
    console.error('UI overlay container not found');
    return;
  }
  const uiSystem = new UISystem(uiContainer);
  uiSystem.updateShop(economySystem.getGold(), gameState.getWaveNumber());

  // 8. Input System
  const inputSystem = new InputSystem(renderSystem.getCamera(), renderSystem.getCanvas());

  // 9. System Pipeline
  const pipeline = new SystemPipeline({
    gameState,
    entityStore,
    grid,
    spawnSystem,
    pathfindingSystem,
    combatSystem,
    economySystem,
  });

  // --- Wire Event Flows ---

  // Pipeline events
  pipeline.onEvent((event) => {
    switch (event.type) {
      case 'enemy_killed':
        uiSystem.updateGold(economySystem.getGold());
        uiSystem.updateEnemiesRemaining(entityStore.enemies.size);
        vfxSystem.spawnFloatingText(
          getEnemyLastPosition(event.enemyId),
          `+${event.bounty}g`,
          '#ffdd00'
        );
        break;

      case 'enemy_reached_core':
        uiSystem.updateEnemiesRemaining(entityStore.enemies.size);
        entityStore.criticalResource.currentHealth = gameState.getCoreHealth();
        vfxSystem.spawnFloatingText(
          gridToWorld(entityStore.criticalResource.position, GameConfig.grid.cellSize),
          `-${event.damage}`,
          '#ff4444'
        );
        break;

      case 'structure_destroyed':
        vfxSystem.spawnDestructionEffect(
          getStructureLastPosition(event.structureId)
        );
        break;

      case 'wave_complete':
        handleWaveComplete();
        break;

      case 'game_over':
        handleGameOver();
        break;
    }
  });

  // Track last known positions for VFX spawning
  const lastEnemyPositions = new Map<string, { x: number; y: number; z: number }>();
  const lastStructurePositions = new Map<string, { x: number; y: number; z: number }>();

  function getEnemyLastPosition(enemyId: string) {
    return lastEnemyPositions.get(enemyId) || { x: 10, y: 0.5, z: 10 };
  }

  function getStructureLastPosition(structureId: string) {
    return lastStructurePositions.get(structureId) || { x: 10, y: 0.5, z: 10 };
  }

  // UI Action Handler
  uiSystem.onAction((action) => {
    switch (action.type) {
      case 'start_wave':
        handleStartWave();
        break;

      case 'restart_game':
        handleRestart();
        break;

      case 'select_structure':
        // Structure selection is tracked by UI system
        break;

      case 'sell_structure':
        handleSellStructure(action.entityId);
        break;

      case 'repair_structure':
        handleRepairStructure(action.entityId);
        break;

      case 'close_context_menu':
        uiSystem.hideContextMenu();
        break;
    }
  });

  // Input Event Handler
  inputSystem.onEvent((event) => {
    if (event.type === 'cell_click' && event.position) {
      handleCellClick(event.position);
    }
  });

  // --- Game Flow Handlers ---

  function handleStartWave(): void {
    const result = gameState.dispatch({ type: 'START_WAVE' });
    if (!result.success) {
      log.warn('Start wave failed', { reason: (result as { reason: string }).reason });
      return;
    }

    phaseManager.transitionTo('combat');
    spawnSystem.beginWave(gameState.getWaveNumber());

    uiSystem.setPhase('combat');
    uiSystem.updateWave(gameState.getWaveNumber());
    uiSystem.updateEnemiesRemaining(gameState.getTotalEnemiesInWave());
    renderSystem.setGridOverlayVisible(false);
  }

  function handleWaveComplete(): void {
    // Award wave bonus
    const bonus = economySystem.awardWaveBonus(gameState.getWaveNumber());
    gameState.setGold(economySystem.getGold());

    // Transition to preparation
    phaseManager.transitionTo('preparation');

    // Increment wave in state (wave was just completed)
    const nextWave = gameState.getWaveNumber() + 1;

    // Update state to reflect new wave
    // The state manager tracks wave number through START_WAVE dispatch
    // For next wave display, we update the UI
    uiSystem.setPhase('preparation');
    uiSystem.updateGold(economySystem.getGold());
    uiSystem.updateShop(economySystem.getGold(), nextWave);
    renderSystem.setGridOverlayVisible(true);

    vfxSystem.spawnFloatingText(
      gridToWorld(entityStore.criticalResource.position, GameConfig.grid.cellSize),
      `Wave Complete! +${bonus}g`,
      '#44ff44'
    );
  }

  function handleGameOver(): void {
    phaseManager.transitionTo('game_over');
    uiSystem.setPhase('game_over');
  }

  function handleRestart(): void {
    log.info('Game restart initiated');
    // Reset game state
    gameState.dispatch({ type: 'RESTART_GAME' });
    phaseManager.transitionTo('preparation');
    economySystem.reset();
    spawnSystem.reset();

    // Clear entities
    const enemyIds = Array.from(entityStore.enemies.keys());
    for (const id of enemyIds) removeEntity(entityStore, id);
    const projIds = Array.from(entityStore.projectiles.keys());
    for (const id of projIds) removeEntity(entityStore, id);
    const structIds = Array.from(entityStore.structures.keys());
    for (const id of structIds) {
      const struct = entityStore.structures.get(id)!;
      // Free grid cell
      const cell = grid.cells[struct.position.row][struct.position.col];
      cell.occupant = null;
      cell.isWalkable = true;
      removeEntity(entityStore, id);
    }

    // Reset CR health
    entityStore.criticalResource.currentHealth = GameConfig.criticalResource.maxHealth;

    // Reset VFX
    vfxSystem.reset();

    // Reset UI
    uiSystem.reset();
    uiSystem.updateShop(economySystem.getGold(), 1);
    renderSystem.setGridOverlayVisible(true);

    // Trigger path recalc
    pathfindingSystem.markDirty();
  }

  function handleCellClick(position: { row: number; col: number }): void {
    if (gameState.getPhase() !== 'preparation') return;

    const cell = grid.cells[position.row][position.col];

    if (cell.occupant) {
      // Clicking on an existing structure - show context menu
      const structure = entityStore.structures.get(cell.occupant);
      if (structure) {
        const sellValue = economySystem.calculateSellValue(structure);
        const repairCost = economySystem.calculateRepairCost(structure);
        const canAffordRepair = economySystem.canAfford(repairCost);

        // Use center of screen for context menu position
        uiSystem.showContextMenu(
          structure.id,
          structure.type,
          structure.currentHealth,
          structure.maxHealth,
          sellValue,
          repairCost,
          canAffordRepair,
          window.innerWidth / 2 - 75,
          window.innerHeight / 2 - 75
        );
      }
    } else {
      // Clicking on empty cell - try to place selected structure
      const selectedType = uiSystem.getSelectedStructure();
      if (!selectedType) return;

      const result = placeStructure(grid, entityStore, economySystem, position, selectedType);

      if (result.success) {
        // Update state
        gameState.setGold(economySystem.getGold());
        uiSystem.updateGold(economySystem.getGold());
        uiSystem.updateShop(economySystem.getGold(), gameState.getWaveNumber());
        pathfindingSystem.markDirty();
      } else {
        // Show invalid placement indicator
        vfxSystem.spawnInvalidPlacementIndicator(position.row, position.col);
        if (result.reason === 'Insufficient gold') {
          vfxSystem.spawnFloatingText(
            gridToWorld(position, GameConfig.grid.cellSize),
            'Insufficient Gold',
            '#ff4444'
          );
        }
      }
    }
  }

  function handleSellStructure(entityId: string): void {
    const structure = entityStore.structures.get(entityId);
    if (!structure) return;

    lastStructurePositions.set(entityId, { ...structure.worldPosition });

    const result = sellStructure(grid, entityStore, economySystem, entityId, gameState.getPhase());
    if (result.success) {
      gameState.setGold(economySystem.getGold());
      uiSystem.updateGold(economySystem.getGold());
      uiSystem.updateShop(economySystem.getGold(), gameState.getWaveNumber());
      pathfindingSystem.markDirty();

      vfxSystem.spawnFloatingText(
        lastStructurePositions.get(entityId) || { x: 10, y: 0.5, z: 10 },
        `+${result.goldCredited}g`,
        '#ffdd00'
      );
    }
  }

  function handleRepairStructure(entityId: string): void {
    const result = repairStructure(entityStore, economySystem, entityId, gameState.getPhase());
    if (result.success) {
      gameState.setGold(economySystem.getGold());
      uiSystem.updateGold(economySystem.getGold());
      uiSystem.updateShop(economySystem.getGold(), gameState.getWaveNumber());

      const structure = entityStore.structures.get(entityId);
      if (structure) {
        vfxSystem.spawnFloatingText(
          structure.worldPosition,
          'Repaired!',
          '#44ff44'
        );
      }
    }
  }

  // --- Game Loop ---

  // Track enemy/structure positions each frame for VFX
  function trackPositions(): void {
    for (const enemy of entityStore.enemies.values()) {
      lastEnemyPositions.set(enemy.id, { ...enemy.worldPosition });
    }
    for (const structure of entityStore.structures.values()) {
      lastStructurePositions.set(structure.id, { ...structure.worldPosition });
    }
  }

  const gameLoop = new GameLoop(
    (dt: number) => {
      // Fixed-timestep update
      trackPositions();
      pipeline.update(dt);
      vfxSystem.update(dt);
    },
    (alpha: number) => {
      // Render at display refresh rate
      renderSystem.render(alpha);
    }
  );

  // Start the game
  log.info('All systems initialized, starting game loop');
  gameLoop.start();
}

// --- Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
  initGame();
});
