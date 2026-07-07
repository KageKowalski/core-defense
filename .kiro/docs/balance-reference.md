# Balance Reference

Complete reference of all balance values, formulas, and progression curves for Core Defense. Source of truth is `scripts/autoloads/game_config.gd`.

## Grid

| Parameter  | Value |
|------------|-------|
| Width      | 20 cells |
| Height     | 20 cells |
| Cell size  | 1.0 world unit |
| Core size  | 2×2 cells at center (9,9)→(10,10) |

## Starting Conditions

| Parameter       | Value |
|-----------------|-------|
| Starting gold   | 100   |
| Core max health | 100   |
| Starting wave   | 1     |
| Starting phase  | Preparation |

## Structures

### Barrier
| Stat      | Value |
|-----------|-------|
| Cost      | 10g   |
| Max HP    | 150   |
| Attacks   | No    |

### Basic Tower
| Stat      | Value            |
|-----------|------------------|
| Cost      | 25g              |
| Max HP    | 50               |
| Range     | 3.0 cells        |
| Damage    | 15 per shot      |
| Fire rate | 1.5 shots/sec    |
| Targeting | closest_to_core  |

### Sniper Tower
| Stat      | Value            |
|-----------|------------------|
| Cost      | 50g              |
| Max HP    | 40               |
| Range     | 6.0 cells        |
| Damage    | 60 per shot      |
| Fire rate | 0.4 shots/sec    |
| Targeting | highest_health   |

### AOE Tower
| Stat       | Value            |
|------------|------------------|
| Cost       | 50g              |
| Max HP     | 40               |
| Range      | 2.5 cells        |
| Damage     | 20 per target    |
| Fire rate  | 0.8 shots/sec    |
| Targeting  | closest_to_core  |
| AOE radius | 1.0 cell         |

## Enemies

### Basic Enemy
| Stat            | Value     |
|-----------------|-----------|
| Health          | 50        |
| Speed           | 2 cell/s  |
| Core damage     | 10        |
| Structure dmg   | 0         |
| Bounty          | 5g        |
| Appears         | Wave 1+   |

### Brute Enemy
| Stat            | Value     |
|-----------------|-----------|
| Health          | 200       |
| Speed           | 1 cell/s  |
| Core damage     | 25        |
| Structure dmg   | 25/hit    |
| Attack rate     | 1 hit/sec |
| Bounty          | 15g       |
| Appears         | Wave 4+   |

## Projectiles

| Parameter | Value       |
|-----------|-------------|
| Speed     | 10 cells/sec|
| Hit threshold | 0.2 units |

## Economy Formulas

### Sell Value
```
floor((current_health / max_health) × original_cost × 0.5)
```

### Repair Cost
```
ceil(((max_health - current_health) / max_health) × original_cost × 0.7)
```

### Wave Bonus
```
20 + (wave_number - 1) × 5
```

| Wave | Bonus |
|------|-------|
| 1    | 20g   |
| 2    | 25g   |
| 3    | 30g   |
| 4    | 35g   |
| 5    | 40g   |
| 10   | 65g   |

## Wave Composition Formulas

### Total Enemies per Wave
```
5 + (wave_number - 1) × 2
```

### Brute Count
```
max(0, wave_number - 3)
```

### Spawn Interval
```
clamp(2.0 - wave_number × 0.1, 0.3, 2.0) seconds
```

## Wave Progression Table

| Wave | Total | Basics | Brutes | Interval (s) | Wave Bonus |
|------|-------|--------|--------|---------------|------------|
| 1    | 5     | 5      | 0      | 1.9           | 20g        |
| 2    | 7     | 7      | 0      | 1.8           | 25g        |
| 3    | 9     | 9      | 0      | 1.7           | 30g        |
| 4    | 11    | 10     | 1      | 1.6           | 35g        |
| 5    | 13    | 11     | 2      | 1.5           | 40g        |
| 6    | 15    | 12     | 3      | 1.4           | 45g        |
| 7    | 17    | 13     | 4      | 1.3           | 50g        |
| 8    | 19    | 14     | 5      | 1.2           | 55g        |
| 9    | 21    | 15     | 6      | 1.1           | 60g        |
| 10   | 23    | 16     | 7      | 1.0           | 65g        |
| 15   | 33    | 21     | 12     | 0.5           | 90g        |
| 17   | 37    | 23     | 14     | 0.3           | 100g       |
| 20   | 43    | 26     | 17     | 0.3           | 115g       |

Note: Interval caps at 0.3s minimum from wave 17 onward.

## Shop Unlock Progression

| Wave | Newly Unlocked      |
|------|---------------------|
| 1    | Barrier, Basic Tower|
| 2    | Sniper Tower        |
| 3    | AOE Tower           |

## Camera

| Parameter  | Value       |
|------------|-------------|
| Projection | Orthographic|
| Size       | 24 (max(20,20) × 1.2) |
| Azimuth    | 45°         |
| Elevation  | 60°         |
| Distance   | 30 units    |
| Look-at    | Grid center (10, 0, 10) |
