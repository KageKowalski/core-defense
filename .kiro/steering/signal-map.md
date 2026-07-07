---
inclusion: fileMatch
fileMatchPattern: "**/managers/**,**/autoloads/**,**/main.gd"
---

# Signal Map

Complete mapping of all signals in the project, their emitters, and their listeners.

## GameState Signals (autoload)

| Signal                | Parameters                          | Emitted By           | Listened By                          |
|-----------------------|-------------------------------------|----------------------|--------------------------------------|
| `phase_changed`       | `old_phase: StringName, new_phase: StringName` | GameState.set_phase() | HUD, ShopPanel, StartWaveButton, main.gd |
| `gold_changed`        | `new_amount: int`                   | Economy.deduct/credit | HUD, ShopPanel                       |
| `core_damaged`        | `current_health: int, max_health: int` | GameState.damage_core() | HUD, CriticalResource               |
| `game_over_triggered` | `wave_reached: int`                 | GameState.damage_core() | GameOverScreen, PhaseManager         |
| `wave_started`        | `wave_number: int`                  | PhaseManager.start_wave() | HUD                                 |
| `enemy_killed`        | `enemy_node: Node, bounty: int`     | CombatManager         | main.gd (VFX)                        |
| `enemy_reached_core`  | `damage: int`                       | CombatManager         | (currently unused externally)        |
| `structure_placed`    | `structure_node: Node`              | GridManager           | (available for future use)           |
| `structure_sold`      | `position: Vector2i, refund: int`   | GridManager           | (available for future use)           |
| `structure_destroyed` | `position: Vector2i`                | (not yet wired)       | main.gd (VFX)                        |
| `wave_complete`       | `wave_number: int`                  | PhaseManager          | (available for future use)           |

## GridManager Signals

| Signal                | Parameters                          | Listened By                          |
|-----------------------|-------------------------------------|--------------------------------------|
| `placement_succeeded` | `position: Vector2i, structure_type: String` | main.gd, CombatManager              |
| `placement_failed`    | `position: Vector2i, reason: String` | main.gd (VFX)                       |

## CombatManager Signals

| Signal                  | Parameters | Listened By   |
|-------------------------|------------|---------------|
| `wave_enemies_cleared`  | (none)     | PhaseManager  |

## Entity Signals

| Signal          | Defined On    | Parameters                        | Listened By     |
|-----------------|---------------|-----------------------------------|-----------------|
| `fired`         | BaseTower     | `tower: BaseTower, target: BaseEnemy` | CombatManager   |
| `died`          | BaseEnemy     | `enemy: BaseEnemy`                | CombatManager   |
| `reached_core`  | BaseEnemy     | `enemy: BaseEnemy, damage: int`   | CombatManager   |
| `destroyed`     | BaseStructure | `structure: BaseStructure`        | (available)     |

## UI Signals

| Signal               | Defined On      | Parameters                | Listened By   |
|----------------------|-----------------|---------------------------|---------------|
| `structure_selected` | ShopPanel       | `structure_type: String`  | main.gd       |
| `selection_cleared`  | ShopPanel       | (none)                    | main.gd       |
| `sell_requested`     | ContextMenu     | `position: Vector2i`      | main.gd       |
| `repair_requested`   | ContextMenu     | `position: Vector2i`      | main.gd       |
| `restart_requested`  | GameOverScreen  | (none)                    | main.gd       |
| `start_wave_pressed` | StartWaveButton | (none)                    | main.gd → PhaseManager |

## Signal Connection Patterns

Signals are connected in `_ready()` of the listening node. The main wiring hub is `main.gd._wire_signals()` which connects UI signals to manager actions.

Enemy signals (`died`, `reached_core`) are dynamically connected by `main.gd._connect_new_enemy_signals()` each physics frame for newly spawned enemies.

Tower `fired` signals are dynamically connected by `CombatManager._update_towers()` when it encounters towers not yet in `_connected_towers`.
