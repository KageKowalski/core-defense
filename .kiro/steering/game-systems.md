---
inclusion: fileMatch
fileMatchPattern: "**/scripts/**,**/scenes/**"
---

# Game Systems — Detailed Reference

This document covers the core game systems, their interactions, and balance values. Reference this when modifying gameplay code.

## Grid System (GridManager)

- 20×20 cells, each cell is 1.0 world unit.
- Grid coordinate `(col, row)` maps to world position `Vector3(col + 0.5, 0, row + 0.5)`.
- Cell dictionary structure: `{"occupant": null|String, "is_walkable": bool, "is_core": bool}`
- Core cells: `(9,9), (10,9), (9,10), (10,10)` — always non-walkable, marked `is_core: true`.
- Placement validation order: phase check → bounds → occupancy/core → gold → seal-core check.

## Pathfinding (PathfindingManager)

- Uses `AStarGrid2D` with `DIAGONAL_MODE_NEVER` (4-directional movement only).
- Dirty-flag pattern: `mark_dirty()` on grid change, `update_if_dirty()` once per physics frame.
- Path target: nearest walkable cell adjacent to any of the 4 core cells.
- Sealed-core detection: BFS flood fill from core-adjacent walkable cells to any grid edge.
- `would_seal_core_if_blocked(pos)`: temporarily blocks cell, tests sealed, restores.
- Brute fallback: when core is sealed, path to nearest barrier instead.

## Economy

| Operation      | Formula                                                    |
|----------------|------------------------------------------------------------|
| Sell value     | `floor((current_health / max_health) × original_cost × 0.5)` |
| Repair cost    | `ceil(((max_health - current_health) / max_health) × original_cost × 0.7)` |
| Wave bonus     | `20 + (wave_number - 1) × 5`                              |
| Starting gold  | 100                                                        |

Gold can never go below zero. All mutations emit `gold_changed`.

## Wave Spawning

| Value            | Formula                                           |
|------------------|---------------------------------------------------|
| Total enemies    | `5 + (wave_number - 1) × 2`                      |
| Brute count      | `max(0, wave_number - 3)`                         |
| Basic count      | `total - brutes`                                  |
| Spawn interval   | `clamp(2.0 - wave_number × 0.1, 0.3, 2.0)` sec  |
| Spawn edges      | 2–4 random edges per wave                         |

Brutes are distributed evenly throughout the spawn queue.

## Structure Balance

| Structure    | Cost | Max HP | Range | Damage | Fire Rate | Targeting      | AOE Radius |
|--------------|------|--------|-------|--------|-----------|----------------|------------|
| Barrier      | 10g  | 150    | —     | —      | —         | —              | —          |
| Basic Tower  | 25g  | 50     | 3.0   | 15     | 1.5/sec   | closest_to_core| —          |
| Sniper Tower | 50g  | 40     | 6.0   | 60     | 0.4/sec   | highest_health | —          |
| AOE Tower    | 50g  | 40     | 2.5   | 20     | 0.8/sec   | closest_to_core| 1.0        |

## Enemy Balance

| Enemy  | Health | Speed     | Core Dmg | Structure Dmg | Bounty | Appears      |
|--------|--------|-----------|----------|---------------|--------|--------------|
| Basic  | 50     | 2 cell/s  | 10       | 0             | 5g     | Wave 1+      |
| Brute  | 200    | 1 cell/s  | 25       | 25            | 15g    | Wave 4+      |

## Tower Targeting

- `closest_to_core`: enemy with lowest remaining path cost (fewest waypoints left).
- `highest_health`: enemy with highest `current_health`.
- Target validation each frame: check `is_instance_valid`, health > 0, still in range.

## Combat Flow

1. CombatManager iterates all towers, calls `tower.update_combat(delta, enemies_in_range)`.
2. Tower decrements cooldown; when ready, selects target and emits `fired(tower, target)`.
3. CombatManager spawns a `Projectile` that tracks the target at 10 cells/sec.
4. On hit (distance < 0.2): single-target applies damage to target; AOE applies damage to all enemies within `aoe_radius`.
5. If target freed before impact, projectile `queue_free()`s itself.
6. On enemy death: `died` signal → CombatManager awards bounty → decrements `enemies_remaining`.
7. On enemy reaching core: `reached_core` signal → `GameState.damage_core(amount)` → decrements `enemies_remaining`.

## Brute Barrier Attack

- When a Brute's next waypoint is a barrier, it stops and enters `is_attacking_barrier` mode.
- Attacks at 1 hit/sec dealing 25 structure damage.
- When barrier is destroyed: GridManager frees the cell, pathfinding recalculates, Brute resumes movement.

## Phase Transitions

| From        | To          | Trigger                                     |
|-------------|-------------|---------------------------------------------|
| Preparation | Combat      | Player clicks "Start Wave"                  |
| Combat      | Preparation | All enemies cleared (killed or reached core)|
| Combat      | Game_Over   | Core health reaches 0                       |
| Game_Over   | Preparation | Player clicks "Restart"                     |

## Shop Unlock Progression

| Wave | Available Structures                    |
|------|-----------------------------------------|
| 1    | Barrier, Basic Tower                    |
| 2    | + Sniper Tower                          |
| 3+   | + AOE Tower                             |

## Critical Resource (Core)

- 2×2 golden box at grid center.
- 100 max health, 100 starting health.
- Visual feedback: lerps color from gold → red as health decreases.
- When health reaches 0: `game_over_triggered` signal emitted.
