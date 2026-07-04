/**
 * UISystem - HTML/CSS overlay for HUD, Shop, context menu, game over screen.
 * Manages all UI elements overlaid on the Three.js canvas.
 */

import { GameConfig } from '../models/config';
import { StructureType } from '../models/entities';
import { GamePhase } from './state';

export type UIAction =
  | { type: 'start_wave' }
  | { type: 'restart_game' }
  | { type: 'select_structure'; structureType: StructureType }
  | { type: 'sell_structure'; entityId: string }
  | { type: 'repair_structure'; entityId: string }
  | { type: 'close_context_menu' };

export type UIActionCallback = (action: UIAction) => void;

interface ShopItem {
  type: StructureType;
  name: string;
  cost: number;
  unlocked: boolean;
  affordable: boolean;
}

/**
 * UISystem class managing the HTML/CSS overlay.
 */
export class UISystem {
  private container: HTMLElement;
  private actionCallback: UIActionCallback | null = null;

  // UI elements
  private hudElement: HTMLElement;
  private goldDisplay: HTMLElement;
  private waveDisplay: HTMLElement;
  private enemiesDisplay: HTMLElement;
  private shopPanel: HTMLElement;
  private startWaveBtn: HTMLElement;
  private gameOverOverlay: HTMLElement;
  private contextMenu: HTMLElement;

  // State
  private selectedStructure: StructureType | null = null;
  private currentPhase: GamePhase = 'preparation';
  private currentWave: number = 1;

  constructor(container: HTMLElement) {
    this.container = container;

    // Create HUD (top bar)
    this.hudElement = this.createElement('div', 'hud');
    this.goldDisplay = this.createElement('div', 'gold-display');
    this.waveDisplay = this.createElement('div', 'wave-display');
    this.enemiesDisplay = this.createElement('div', 'enemies-display');
    this.hudElement.appendChild(this.goldDisplay);
    this.hudElement.appendChild(this.waveDisplay);
    this.hudElement.appendChild(this.enemiesDisplay);
    container.appendChild(this.hudElement);

    // Create Shop panel
    this.shopPanel = this.createElement('div', 'shop-panel');
    container.appendChild(this.shopPanel);

    // Create Start Wave button
    this.startWaveBtn = this.createElement('button', 'start-wave-btn');
    this.startWaveBtn.textContent = 'Start Wave';
    this.startWaveBtn.addEventListener('click', () => {
      if (this.actionCallback) {
        this.actionCallback({ type: 'start_wave' });
      }
    });
    container.appendChild(this.startWaveBtn);

    // Create Game Over overlay
    this.gameOverOverlay = this.createElement('div', 'game-over-overlay');
    this.gameOverOverlay.style.display = 'none';
    container.appendChild(this.gameOverOverlay);

    // Create context menu (hidden by default)
    this.contextMenu = this.createElement('div', 'context-menu');
    this.contextMenu.style.display = 'none';
    container.appendChild(this.contextMenu);

    // Initial state
    this.updateGold(GameConfig.startingGold);
    this.setPhase('preparation');
  }

  /**
   * Register callback for UI actions.
   */
  onAction(callback: UIActionCallback): void {
    this.actionCallback = callback;
  }

  /**
   * Returns the currently selected shop item.
   */
  getSelectedStructure(): StructureType | null {
    return this.selectedStructure;
  }

  /**
   * Clears the structure selection.
   */
  clearSelection(): void {
    this.selectedStructure = null;
    this.updateShopHighlight();
  }

  /**
   * Updates the gold display.
   */
  updateGold(gold: number): void {
    this.goldDisplay.textContent = `Gold: ${gold}`;
  }

  /**
   * Updates the wave display.
   */
  updateWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.waveDisplay.textContent = `Wave ${waveNumber}`;
  }

  /**
   * Updates the enemies remaining counter.
   */
  updateEnemiesRemaining(count: number): void {
    this.enemiesDisplay.textContent = `Enemies: ${count}`;
  }

  /**
   * Sets the phase and updates UI visibility accordingly.
   */
  setPhase(phase: GamePhase): void {
    this.currentPhase = phase;

    switch (phase) {
      case 'preparation':
        this.shopPanel.style.display = 'flex';
        this.startWaveBtn.style.display = 'block';
        this.waveDisplay.style.display = 'none';
        this.enemiesDisplay.style.display = 'none';
        this.gameOverOverlay.style.display = 'none';
        this.hideContextMenu();
        break;

      case 'combat':
        this.shopPanel.style.display = 'none';
        this.startWaveBtn.style.display = 'none';
        this.waveDisplay.style.display = 'block';
        this.enemiesDisplay.style.display = 'block';
        this.hideContextMenu();
        this.clearSelection();
        break;

      case 'game_over':
        this.shopPanel.style.display = 'none';
        this.startWaveBtn.style.display = 'none';
        this.waveDisplay.style.display = 'block';
        this.enemiesDisplay.style.display = 'none';
        this.hideContextMenu();
        this.showGameOver(this.currentWave);
        break;
    }
  }

  /**
   * Updates the shop panel with available structures.
   * Unlock progression: wave 1 (Barrier+Basic), wave 2 (Sniper), wave 3 (AOE)
   */
  updateShop(gold: number, waveNumber: number): void {
    const items: ShopItem[] = [
      {
        type: 'barrier',
        name: 'Barrier',
        cost: GameConfig.structures.barrier.cost,
        unlocked: true, // Always available
        affordable: gold >= GameConfig.structures.barrier.cost,
      },
      {
        type: 'basic_tower',
        name: 'Basic Tower',
        cost: GameConfig.structures.basic_tower.cost,
        unlocked: true, // Always available
        affordable: gold >= GameConfig.structures.basic_tower.cost,
      },
      {
        type: 'sniper_tower',
        name: 'Sniper Tower',
        cost: GameConfig.structures.sniper_tower.cost,
        unlocked: waveNumber >= 2,
        affordable: gold >= GameConfig.structures.sniper_tower.cost,
      },
      {
        type: 'aoe_tower',
        name: 'AOE Tower',
        cost: GameConfig.structures.aoe_tower.cost,
        unlocked: waveNumber >= 3,
        affordable: gold >= GameConfig.structures.aoe_tower.cost,
      },
    ];

    this.shopPanel.innerHTML = '';

    for (const item of items) {
      if (!item.unlocked) continue;

      const btn = document.createElement('button');
      btn.className = 'shop-item';
      btn.textContent = `${item.name} (${item.cost}g)`;

      if (!item.affordable) {
        btn.classList.add('unaffordable');
      }

      if (this.selectedStructure === item.type) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', () => {
        if (!item.affordable) return;
        this.selectedStructure = item.type;
        this.updateShopHighlight();
        if (this.actionCallback) {
          this.actionCallback({ type: 'select_structure', structureType: item.type });
        }
      });

      this.shopPanel.appendChild(btn);
    }
  }

  /**
   * Shows the Game Over screen.
   */
  showGameOver(waveReached: number): void {
    this.gameOverOverlay.innerHTML = '';
    this.gameOverOverlay.style.display = 'flex';

    const title = document.createElement('h1');
    title.textContent = 'GAME OVER';
    title.style.color = '#ff4444';

    const info = document.createElement('p');
    info.textContent = `You reached Wave ${waveReached}`;

    const restartBtn = document.createElement('button');
    restartBtn.className = 'restart-btn';
    restartBtn.textContent = 'Restart';
    restartBtn.addEventListener('click', () => {
      if (this.actionCallback) {
        this.actionCallback({ type: 'restart_game' });
      }
    });

    this.gameOverOverlay.appendChild(title);
    this.gameOverOverlay.appendChild(info);
    this.gameOverOverlay.appendChild(restartBtn);
  }

  /**
   * Shows context menu for a structure with sell/repair options.
   */
  showContextMenu(
    entityId: string,
    structureType: string,
    currentHealth: number,
    maxHealth: number,
    sellValue: number,
    repairCost: number,
    canAffordRepair: boolean,
    screenX: number,
    screenY: number
  ): void {
    this.contextMenu.innerHTML = '';
    this.contextMenu.style.display = 'block';
    this.contextMenu.style.left = `${screenX}px`;
    this.contextMenu.style.top = `${screenY}px`;

    const title = document.createElement('div');
    title.className = 'context-title';
    title.textContent = structureType.replace('_', ' ').toUpperCase();
    this.contextMenu.appendChild(title);

    const healthText = document.createElement('div');
    healthText.className = 'context-health';
    healthText.textContent = `Health: ${currentHealth}/${maxHealth}`;
    this.contextMenu.appendChild(healthText);

    // Sell button
    const sellBtn = document.createElement('button');
    sellBtn.className = 'context-btn sell-btn';
    sellBtn.textContent = `Sell (+${sellValue}g)`;
    sellBtn.addEventListener('click', () => {
      if (this.actionCallback) {
        this.actionCallback({ type: 'sell_structure', entityId });
      }
      this.hideContextMenu();
    });
    this.contextMenu.appendChild(sellBtn);

    // Repair button (only show if damaged)
    if (currentHealth < maxHealth) {
      const repairBtn = document.createElement('button');
      repairBtn.className = 'context-btn repair-btn';
      repairBtn.textContent = `Repair (-${repairCost}g)`;
      if (!canAffordRepair) {
        repairBtn.classList.add('unaffordable');
      }
      repairBtn.addEventListener('click', () => {
        if (!canAffordRepair) return;
        if (this.actionCallback) {
          this.actionCallback({ type: 'repair_structure', entityId });
        }
        this.hideContextMenu();
      });
      this.contextMenu.appendChild(repairBtn);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'context-btn close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => this.hideContextMenu());
    this.contextMenu.appendChild(closeBtn);
  }

  /**
   * Hides the context menu.
   */
  hideContextMenu(): void {
    this.contextMenu.style.display = 'none';
  }

  /**
   * Updates shop button highlights.
   */
  private updateShopHighlight(): void {
    const buttons = this.shopPanel.querySelectorAll('.shop-item');
    buttons.forEach(btn => btn.classList.remove('selected'));

    if (this.selectedStructure) {
      const items = this.shopPanel.querySelectorAll('.shop-item');
      items.forEach(btn => {
        if ((btn as HTMLElement).textContent?.includes(this.getStructureName(this.selectedStructure!))) {
          btn.classList.add('selected');
        }
      });
    }
  }

  private getStructureName(type: StructureType): string {
    switch (type) {
      case 'barrier': return 'Barrier';
      case 'basic_tower': return 'Basic Tower';
      case 'sniper_tower': return 'Sniper Tower';
      case 'aoe_tower': return 'AOE Tower';
    }
  }

  /**
   * Helper to create an element with a class name.
   */
  private createElement(tag: string, className: string): HTMLElement {
    const el = document.createElement(tag);
    el.className = className;
    return el;
  }

  /**
   * Resets the UI to initial state.
   */
  reset(): void {
    this.selectedStructure = null;
    this.currentWave = 1;
    this.setPhase('preparation');
    this.updateGold(GameConfig.startingGold);
    this.updateWave(1);
  }
}
