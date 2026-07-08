# Core Defense — Architecture Overview

Core Defense is a tower defense game built in Godot 4.7 with GDScript, converted from a TypeScript/Three.js/Vite original. The game runs on a 20×20 grid where players place structures to defend a central "Critical Resource" (the core) from waves of enemies.

## Engine & Rendering

- Godot 4.7, Forward Plus rendering method
- 1280×720 viewport
- 60 Hz physics tick (`_physics_process` for all gameplay logic)
- Orthographic 3D camera (45° azimuth, 60° elevation)

## Autoloads (Global Singletons)

Three autoloads provide shared state and configuration:

| Autoload   | Purpose                                    |
|------------|--------------------------------------------|
| GameConfig | Immutable balance constants (grid, structures, enemies, economy, spawn) |
| GameState  | Central mutable state + signals (phase, gold, wave_number, core_health) |
| Economy    | Gold transaction logic (buy, sell, repair, bounty, wave bonus) |

## Manager Nodes (in main.tscn)

Seven manager nodes handle distinct gameplay systems:

| Manager                  | Responsibility                                                     |
|--------------------------|--------------------------------------------------------------------|
| GridManager              | 20×20 grid model, cell occupancy, structure placement/sell/repair  |
| PathfindingManager       | AStarGrid2D (4-dir, no diagonals), dirty-flag recalculation, sealed-core detection |
| SpawnManager             | Wave composition, staggered spawning, edge selection               |
| CombatManager            | Tower targeting, projectile creation, damage resolution            |
| PhaseManager             | Phase state machine (Preparation, Combat, Game_Over)               |
| VFXManager               | Floating text, destruction particles, invalid placement indicators |
| PlacementPreviewManager  | Ghost structure preview + range highlight overlay during Preparation |

## Physics Process Pipeline (per frame)

```
main.gd._physics_process(delta):
    1. SpawnManager.update(delta)            — spawn enemies on interval
    2. PathfindingManager.update_if_dirty()  — recalculate paths if grid changed
    3. CombatManager.update(delta)           — tower targeting + projectile movement
    4. _connect_new_enemy_signals()          — wire died/reached_core for new enemies
    (enemies self-update via their own _physics_process)
```

## Entity Hierarchy

```
BaseStructure (Node3D, class_name)
├── Barrier
└── BaseTower (class_name)
    ├── BasicTower
    ├── SniperTower
    └── AoeTower

BaseEnemy (CharacterBody3D, class_name)
├── BasicEnemy
└── BruteEnemy

Projectile (Node3D)
CriticalResource (Node3D)
```

## Visual Update Pipeline (per frame)

```
main.gd._process(delta):
    1. Raycast mouse → grid cell
    2. PlacementPreviewManager.update_hover(cell)  — ghost preview + range highlight
```

## Signal-Driven Communication

Systems communicate through Godot signals rather than direct function calls:

- `GameState.phase_changed` → UI visibility, grid overlay, start wave button, PlacementPreviewManager cleanup
- `GameState.gold_changed` → HUD gold label, shop button affordability
- `GameState.core_damaged` → HUD health bar, critical resource color
- `GameState.game_over_triggered` → Game over screen
- `GameState.enemy_killed` → VFX floating text
- `GridManager.placement_succeeded / placement_failed` → Pathfinding dirty flag, VFX
- `CombatManager.wave_enemies_cleared` → PhaseManager wave completion
- `BaseTower.fired` → CombatManager projectile instantiation
- `BaseEnemy.died / reached_core` → CombatManager bounty/damage handling

## Groups

Entities self-register into groups for batch queries:

| Group         | Members                              |
|---------------|--------------------------------------|
| `enemies`     | All active enemy instances           |
| `towers`      | All placed tower instances           |
| `structures`  | All placed structures (towers + barriers) |
| `projectiles` | All active projectile instances      |
| `grid_manager`| The GridManager node                 |

## Phase State Machine

```
PREPARATION ──→ COMBAT ──→ PREPARATION (wave complete)
                   │
                   └──→ GAME_OVER ──→ PREPARATION (restart)
```

## Directory Layout

```
core-defense/
├── project.godot
├── scenes/
│   ├── main.tscn
│   ├── entities/    (barrier, towers, enemies, projectile, critical_resource)
│   └── ui/          (hud, shop_panel, context_menu, game_over_screen, start_wave_button)
├── scripts/
│   ├── main.gd
│   ├── autoloads/   (game_config, game_state, economy)
│   ├── managers/    (grid, pathfinding, spawn, combat, phase, vfx, placement_preview)
│   ├── entities/    (base_structure, barrier, base_tower, towers, base_enemy, enemies, projectile, critical_resource)
│   ├── ui/          (hud, shop_panel, context_menu, game_over_screen, start_wave_button)
│   └── camera/      (game_camera)
└── resources/       (structure_data/, enemy_data/ — reserved for .tres files)
```
