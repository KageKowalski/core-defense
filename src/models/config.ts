/**
 * Game Configuration Constants - All costs, health values, ranges, speeds, and economy multipliers.
 */

export const GameConfig = {
  grid: {
    width: 20,
    height: 20,
    cellSize: 1,
  },
  startingGold: 100,
  camera: {
    azimuthAngle: 45,
    elevationAngle: 60,
  },
  structures: {
    barrier: {
      cost: 10,
      maxHealth: 150,
    },
    basic_tower: {
      cost: 25,
      maxHealth: 50,
      range: 3,
      damage: 15,
      fireRate: 1.5,
      targetingPriority: 'closest_to_core' as const,
    },
    sniper_tower: {
      cost: 50,
      maxHealth: 40,
      range: 6,
      damage: 60,
      fireRate: 0.4,
      targetingPriority: 'highest_health' as const,
    },
    aoe_tower: {
      cost: 50,
      maxHealth: 40,
      range: 2.5,
      damage: 20,
      fireRate: 0.8,
      aoeRadius: 1,
      targetingPriority: 'closest_to_core' as const,
    },
  },
  enemies: {
    basic: {
      health: 50,
      speed: 2,
      damage: 10,
      structureDamage: 0,
      bounty: 5,
    },
    brute: {
      health: 200,
      speed: 1,
      damage: 25,
      structureDamage: 25,
      bounty: 15,
    },
  },
  economy: {
    sellMultiplier: 0.5,
    repairMultiplier: 0.7,
    waveBonusBase: 20,
    waveBonusIncrement: 5,
  },
  spawn: {
    minInterval: 0.3,
    maxInterval: 2.0,
    baseEnemyCount: 5,
    enemyCountIncrement: 2,
    bruteStartWave: 4,
  },
  criticalResource: {
    maxHealth: 100,
  },
} as const;

export type GameConfigType = typeof GameConfig;
