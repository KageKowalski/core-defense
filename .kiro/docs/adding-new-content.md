# Adding New Content to Core Defense

Step-by-step guides for extending the game with new entities, systems, and features.

## Adding a New Tower Type

1. **Define balance values** in `scripts/autoloads/game_config.gd`:
   ```gdscript
   # Add to STRUCTURES dictionary
   "rapid_tower": {
       "cost": 35,
       "max_health": 30,
       "range": 2.0,
       "damage": 8,
       "fire_rate": 4.0,
       "targeting": "closest_to_core",
   },
   ```

2. **Create the script** at `scripts/entities/rapid_tower.gd`:
   ```gdscript
   ## RapidTower Entity
   ## Fast-firing short-range tower.
   extends BaseTower

   func _ready() -> void:
       var config: Dictionary = GameConfig.STRUCTURES["rapid_tower"]
       structure_type = "rapid_tower"
       max_health = config["max_health"]
       original_cost = config["cost"]
       attack_range = config["range"]
       damage = config["damage"]
       fire_rate = config["fire_rate"]
       targeting_priority = config["targeting"]
       super._ready()
   ```

3. **Create the scene** at `scenes/entities/rapid_tower.tscn`:
   - Root: `Node3D` with the script attached
   - Child: `MeshInstance3D` with a colored `BoxMesh` (0.7×1.2×0.7)

4. **Register in GridManager** — add to `STRUCTURE_SCENES` dictionary:
   ```gdscript
   "rapid_tower": preload("res://scenes/entities/rapid_tower.tscn"),
   ```

5. **Add shop button** in `scenes/ui/shop_panel.tscn`:
   - Add a new `Button` node with unique name
   - Update `scripts/ui/shop_panel.gd` with the new button reference and unlock wave

6. **Update GameConfig reference** if it uses a new targeting mode, implement it in `BaseTower._select_target()`.

## Adding a New Enemy Type

1. **Define balance values** in `GameConfig.ENEMIES`:
   ```gdscript
   "fast": {
       "health": 25,
       "speed": 4.0,
       "damage": 5,
       "structure_damage": 0,
       "bounty": 3,
   },
   ```

2. **Create the script** at `scripts/entities/fast_enemy.gd`:
   ```gdscript
   ## FastEnemy Entity
   ## Fragile but extremely fast enemy.
   extends BaseEnemy

   func _ready() -> void:
       enemy_type = "fast"
       max_health = GameConfig.ENEMIES["fast"]["health"]
       move_speed = GameConfig.ENEMIES["fast"]["speed"]
       core_damage = GameConfig.ENEMIES["fast"]["damage"]
       structure_damage = GameConfig.ENEMIES["fast"]["structure_damage"]
       bounty = GameConfig.ENEMIES["fast"]["bounty"]
       super._ready()
   ```

3. **Create the scene** at `scenes/entities/fast_enemy.tscn`:
   - Root: `CharacterBody3D` with the script attached
   - Child: `MeshInstance3D` with colored `BoxMesh`
   - Child: `CollisionShape3D` matching the mesh size

4. **Register in SpawnManager** — add to `ENEMY_SCENES`:
   ```gdscript
   "fast": preload("res://scenes/entities/fast_enemy.tscn"),
   ```

5. **Update wave composition** in `SpawnManager._get_wave_composition()` to include the new type in the spawn queue logic.

## Adding a New Targeting Mode

1. Add the new mode string to the relevant tower's config in `GameConfig.STRUCTURES`.
2. Implement the selection logic in `BaseTower._select_target()`:
   ```gdscript
   func _select_target(enemies: Array) -> BaseEnemy:
       match targeting_priority:
           "closest_to_core":
               return _get_closest_to_core(enemies)
           "highest_health":
               return _get_highest_health(enemies)
           "lowest_health":  # New mode
               return _get_lowest_health(enemies)
       return enemies[0]
   ```

## Adding a New VFX

1. Add a public method to `scripts/managers/vfx_manager.gd`:
   ```gdscript
   func spawn_my_effect(world_pos: Vector3) -> void:
       # Create visual node, tween animation, auto-free
   ```

2. Connect the trigger signal in `main.gd._ready()`:
   ```gdscript
   GameState.some_signal.connect(_on_some_signal_vfx)
   ```

## Adding a New Phase

1. Add the phase to `GameState.Phase` enum.
2. Update `PhaseManager.VALID_TRANSITIONS` with the new valid transitions.
3. Update all UI components that check `GameState.phase` for visibility/behavior.
4. Ensure `CombatManager` and `SpawnManager` don't process during the new phase if appropriate.

## Checklist for Any Addition

- [ ] Balance values in `GameConfig` (not hardcoded in scripts)
- [ ] Script follows coding standards (docstring, section order, typed signals)
- [ ] Entity added to appropriate group(s) in `_ready()`
- [ ] Scene preloaded as constant where instantiated
- [ ] Signals properly connected and typed
- [ ] Phase-awareness added where needed
- [ ] UI updated if player-facing
- [ ] Update `project-status.md` steering file
