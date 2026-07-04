/**
 * EconomySystem - Manages gold transactions with validation.
 * Handles purchasing, selling, repairing, bounties, and wave bonuses.
 */

import { GameConfig } from '../models/config';
import { Structure } from '../models/entities';
import { Logger } from '../utils/logger';

const log = Logger.create('Economy');

export type EnemyType = 'basic_enemy' | 'brute_enemy';

/**
 * EconomySystem class that manages the player's gold and all economic transactions.
 */
export class EconomySystem {
  private gold: number;

  constructor(startingGold: number = GameConfig.startingGold) {
    this.gold = startingGold;
  }

  /**
   * Returns the current gold amount.
   */
  getGold(): number {
    return this.gold;
  }

  /**
   * Sets the gold to a specific amount (used for state synchronization).
   */
  setGold(amount: number): void {
    this.gold = amount;
  }

  /**
   * Returns true if the player can afford the given cost.
   */
  canAfford(cost: number): boolean {
    return this.gold >= cost;
  }

  /**
   * Attempts to deduct the given amount from the player's gold.
   * Returns true if the deduction was successful, false if insufficient funds.
   * Gold cannot go below zero.
   */
  deduct(amount: number): boolean {
    if (amount < 0) {
      return false;
    }
    if (this.gold < amount) {
      log.warn('Deduction failed - insufficient gold', { attempted: amount, available: this.gold });
      return false;
    }
    this.gold -= amount;
    log.debug('Gold deducted', { amount, remaining: this.gold });
    return true;
  }

  /**
   * Credits gold to the player's total.
   * Amount must be non-negative.
   */
  credit(amount: number): void {
    if (amount < 0) {
      return;
    }
    this.gold += amount;
    log.debug('Gold credited', { amount, total: this.gold });
  }

  /**
   * Calculates the sell value for a structure.
   * Formula: floor((currentHealth / maxHealth) * originalCost * 0.5)
   */
  calculateSellValue(structure: { currentHealth: number; maxHealth: number; originalCost: number }): number {
    if (structure.maxHealth <= 0 || structure.originalCost <= 0) {
      return 0;
    }
    return Math.floor(
      (structure.currentHealth / structure.maxHealth) * structure.originalCost * GameConfig.economy.sellMultiplier
    );
  }

  /**
   * Calculates the repair cost for a structure.
   * Formula: ceil(((maxHealth - currentHealth) / maxHealth) * originalCost * 0.7)
   */
  calculateRepairCost(structure: { currentHealth: number; maxHealth: number; originalCost: number }): number {
    if (structure.maxHealth <= 0 || structure.originalCost <= 0) {
      return 0;
    }
    if (structure.currentHealth >= structure.maxHealth) {
      return 0;
    }
    const damageFraction = (structure.maxHealth - structure.currentHealth) / structure.maxHealth;
    return Math.ceil(damageFraction * structure.originalCost * GameConfig.economy.repairMultiplier);
  }

  /**
   * Calculates the wave completion bonus for the given wave number.
   * Formula: 20 + (waveNumber - 1) * 5
   */
  getWaveBonusAmount(waveNumber: number): number {
    if (waveNumber < 1) {
      return GameConfig.economy.waveBonusBase;
    }
    return GameConfig.economy.waveBonusBase + (waveNumber - 1) * GameConfig.economy.waveBonusIncrement;
  }

  /**
   * Returns the bounty amount for a given enemy type.
   * Basic enemies: 5 gold, Brute enemies: 15 gold.
   */
  getEnemyBounty(enemyType: EnemyType): number {
    switch (enemyType) {
      case 'basic_enemy':
        return GameConfig.enemies.basic.bounty;
      case 'brute_enemy':
        return GameConfig.enemies.brute.bounty;
      default:
        return 0;
    }
  }

  /**
   * Awards a bounty for destroying an enemy.
   * Credits the bounty amount to the player's gold.
   */
  awardBounty(enemyType: EnemyType): number {
    const bounty = this.getEnemyBounty(enemyType);
    this.credit(bounty);
    log.info('Bounty awarded', { enemyType, bounty, totalGold: this.gold });
    return bounty;
  }

  /**
   * Awards the wave completion bonus for the given wave number.
   * Credits the bonus amount to the player's gold.
   */
  awardWaveBonus(waveNumber: number): number {
    const bonus = this.getWaveBonusAmount(waveNumber);
    this.credit(bonus);
    log.info('Wave bonus awarded', { waveNumber, bonus, totalGold: this.gold });
    return bonus;
  }

  /**
   * Resets the economy to the starting gold amount.
   */
  reset(startingGold: number = GameConfig.startingGold): void {
    this.gold = startingGold;
  }
}
