# Implementation Plan: Core Defense — Godot 4.7 Conversion

## Overview

Convert the Core Defense tower defense game from TypeScript/Three.js to Godot 4.7 with GDScript. The implementation follows an incremental approach: project setup → data layer → core systems → entities → UI → VFX → integration. Each task builds on previous tasks, ensuring no orphaned code.

## Tasks

- [ ] 1. Set up Godot project structure and autoloads
  - [ ] 1.1 Create Godot project at `core-defense/godot/` with project.godot configured for 60 Hz physics tick, forward_plus rendering, 1280×720 viewport
    - Create directory structure: scenes/, scenes/entities/, scenes/ui/, scripts/, scripts/autoloads/, scripts/managers/, scripts/entities/, scripts/ui/, scripts/camera/, resources/, resources/structure_data/, resources/enemy_data/
    - _Requirements: 16.1, 16.3, 16.5_
  - [ ] 1.2 Implement GameConfig autoload with all balance constants
    - Create `scripts/autoloads/game_config.gd` with GRID, STRUCTURES, ENEMIES, ECONOMY, SPAWN, CRITICAL_RESOURCE dictionaries matching exact values from original config.ts
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3_
  - [ ] 1.3 Implement GameState autoload with signals and phase enum
    - Create `scripts/autoloads/game_state.gd` with Phase enum, state variables (phase, gold, wave_number, core_health, enemies_remaining), signals (phase_changed, gold_changed, core_damaged, game_over_triggered, wave_started, enemy_killed, enemy_reached_core, structure_placed, structure_sold, structure_destroyed, wave_complete), set_phase(), damage_core(), reset() methods
    - _Requirements: 4.5, 9.1, 16.4_
  - [ ] 1.4 Implement Economy autoload
    - Create `scripts/autoloads/economy.gd` with can_afford(), deduct(), credit(), calculate_sell_value(), calculate_repair_cost(), get_wave_bonus(), get_enemy_bounty(), award_bounty(), award_wave_bonus()
    - All formulas must match original: sell = floor(health_ratio × cost × 0.5), repair = ceil(damage_ratio × cost × 0.7), wave_bonus = 20 + (N-1) × 5
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 3.2, 3.5_
  - [ ]* 1.5 Write property tests for Economy formulas
    - **Property 5: Sell Value Formula**
    - **Property 6: Repair Cost Formula**
    - **Property 7: Gold Non-Negativity Invariant**
    - **Property 8: Wave Bonus Formula**
    - **Validates: Requirements 3.2, 3.5, 4.3, 4.4**

- [ ] 2. Implement GridManager and PathfindingManager
  - [ ] 2.1 Implement GridManager with grid initialization and core placement
    - Create `scripts/managers/grid_manager.gd` extending Node3D
    - Initialize 20×20 cells array, place Critical Resource at center 4 cells (rows 9-10, cols 9-10), mark as non-walkable/core
    - Implement get_cell(), is_walkable(), grid_to_world() coordinate conversion
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 2.2 Write property test for coordinate conversion
    - **Property 1: Grid-to-World Coordinate Conversion**
    - **Validates: Requirement 1.4**
  - [ ] 2.3 Implement PathfindingManager with AStarGrid2D
    - Create `scripts/managers/pathfinding_manager.gd` extending Node
    - Set up AStarGrid2D with region 20×20, DIAGONAL_MODE_NEVER
    - Implement mark_dirty(), update_if_dirty(), find_path_to_core(), is_core_sealed(), would_seal_core_if_blocked()
    - Core-adjacent cell computation: find walkable cells adjacent to the 4 core cells
    - Sealed-core detection: BFS from core-adjacent cells to any edge
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 2.4 Write property tests for pathfinding
    - **Property 9: Pathfinding Endpoint Validity**
    - **Property 10: Sealed Core Detection Correctness**
    - **Property 11: Would-Seal-Core Prediction**
    - **Validates: Requirements 5.3, 5.4, 5.6**
  - [ ] 2.5 Implement structure placement, selling, and repair in GridManager
    - Add try_place_structure() with validation: bounds, occupancy, gold, seal-check
    - Add sell_structure() with gold credit and cell restoration
    - Add repair_structure() with gold deduction and health restoration
    - Add phase checks (only during Preparation)
    - Connect placement/sell to PathfindingManager.mark_dirty()
    - Preload structure scenes for instantiation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.3, 3.4, 3.6, 3.7_
  - [ ]* 2.6 Write property tests for placement validation
    - **Property 2: Placement Rejection on Occupied Cells**
    - **Property 3: Placement Success on Valid Cells**
    - **Property 4: Placement-Sell Round Trip (Cell State)**
    - **Property 22: Sell/Repair Phase Restriction**
    - **Validates: Requirements 2.1, 2.2, 2.5, 2.6, 3.3, 3.7**

- [ ] 3. Checkpoint - Ensure grid and economy tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement entity scenes (structures, enemies, projectiles)
  - [ ] 4.1 Create BaseStructure and Barrier scene/script
    - Create `scripts/entities/base_structure.gd` (class_name BaseStructure) with max_health, current_health, original_cost, grid_position, structure_type
    - Create `scripts/entities/barrier.gd` extending BaseStructure with barrier-specific setup
    - Create `scenes/entities/barrier.tscn` with MeshInstance3D (brown BoxMesh 0.8×1.0×0.8)
    - Add to "structures" group
    - _Requirements: 10.1, 13.5_
  - [ ] 4.2 Create BaseTower and tower scenes/scripts
    - Create `scripts/entities/base_tower.gd` (class_name BaseTower) extending BaseStructure with range, damage, fire_rate, targeting_priority, aoe_radius, fire_cooldown, current_target
    - Implement update_combat(delta, enemies_in_range) with cooldown, target validation, target selection, firing
    - Implement _select_target() with "closest_to_core" and "highest_health" priorities
    - Create basic_tower.gd, sniper_tower.gd, aoe_tower.gd extending BaseTower
    - Create scenes: basic_tower.tscn (blue, 0.7×1.2), sniper_tower.tscn (purple, 0.7×1.2), aoe_tower.tscn (orange-red, 0.7×1.2)
    - Add to "towers" and "structures" groups
    - _Requirements: 8.2, 8.3, 8.4, 8.10, 10.2, 10.3, 10.4, 13.5_
  - [ ]* 4.3 Write property test for tower targeting
    - **Property 17: Tower Targeting Priority**
    - **Validates: Requirements 8.2, 8.3, 8.4**
  - [ ] 4.4 Create BaseEnemy and enemy scenes/scripts
    - Create `scripts/entities/base_enemy.gd` (class_name BaseEnemy) extending CharacterBody3D with health, speed, damage, structure_damage, bounty, path, path_index, interpolation, is_attacking_barrier, attack_cooldown
    - Implement _physics_process movement: interpolation along path, waypoint advancement, reached_core detection
    - Implement take_damage(), set_path()
    - Create basic_enemy.gd (speed 2, 50HP, green 0.4×0.5) and brute_enemy.gd (speed 1, 200HP, dark red 0.6×0.8)
    - Implement Brute-specific barrier attack logic (1 hit/sec, 25 structure damage)
    - Create scenes with MeshInstance3D nodes, add to "enemies" group
    - Emit died signal on health ≤ 0, reached_core signal at path end
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 11.1, 11.2, 13.6_
  - [ ]* 4.5 Write property tests for enemy movement
    - **Property 12: Enemy Movement Progress**
    - **Property 13: Enemy Core Arrival**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [ ] 4.6 Create Projectile scene/script
    - Create `scripts/entities/projectile.gd` extending Node3D with source_id, target reference, damage, speed (10), is_aoe, aoe_radius
    - Implement update_movement(delta): move toward target world position, detect hit (distance < threshold), apply damage on hit
    - For AOE: apply damage to all enemies within aoe_radius of impact
    - Dissipate (queue_free) if target no longer exists
    - Create `scenes/entities/projectile.tscn` with yellow SphereMesh (radius 0.15)
    - Add to "projectiles" group
    - _Requirements: 8.5, 8.6, 8.7, 8.8, 8.9, 13.7_
  - [ ]* 4.7 Write property test for AOE damage
    - **Property 18: AOE Damage Radius**
    - **Validates: Requirement 8.7**
  - [ ] 4.8 Create CriticalResource scene/script
    - Create `scripts/entities/critical_resource.gd` with max_health, current_health, cells array
    - Create `scenes/entities/critical_resource.tscn` with golden BoxMesh (2×1.5×2) positioned at grid center
    - Connect to GameState.core_damaged for health bar updates
    - _Requirements: 1.2, 1.3, 13.4_

- [ ] 5. Implement SpawnManager and CombatManager
  - [ ] 5.1 Implement SpawnManager
    - Create `scripts/managers/spawn_manager.gd` extending Node
    - Implement begin_wave(wave_number): calculate composition, build queue, select edges, set interval
    - Implement update(delta): staggered spawning from queue, instantiate enemy scenes, assign paths via PathfindingManager
    - Implement spawn position fallback (try other edges if pathfinding fails)
    - Implement _build_spawn_queue() with even Brute distribution
    - Track spawning active state and enemies remaining to spawn
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [ ]* 5.2 Write property tests for wave composition and spawning
    - **Property 14: Wave Composition Formula**
    - **Property 15: Spawn Interval Formula**
    - **Property 16: Spawn Edge Selection Bounds**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  - [ ] 5.3 Implement CombatManager
    - Create `scripts/managers/combat_manager.gd` extending Node
    - Implement update(delta): iterate towers, call tower.update_combat(), update projectiles
    - Implement _get_enemies_in_range(tower) using get_tree().get_nodes_in_group("enemies")
    - Handle enemy died signals: award bounty via Economy, emit enemy_killed on GameState, decrement enemies_remaining
    - Handle enemy reached_core signals: damage core via GameState, decrement enemies_remaining
    - Check wave completion (no enemies alive, none to spawn, spawner inactive)
    - _Requirements: 8.1, 8.8, 8.9, 8.10, 4.2_

- [ ] 6. Implement PhaseManager
  - [ ] 6.1 Implement PhaseManager with state machine
    - Create `scripts/managers/phase_manager.gd` extending Node
    - Implement start_wave(): validate Preparation phase, transition to Combat, signal wave_started, trigger SpawnManager.begin_wave()
    - Implement complete_wave(): award wave bonus, increment wave_number, transition to Preparation
    - Implement trigger_game_over(): transition to Game_Over
    - Implement restart_game(): call GameState.reset(), clear all entity groups (queue_free), re-initialize GridManager
    - Wire wave completion detection from CombatManager
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - [ ]* 6.2 Write property test for phase transitions
    - **Property 19: Phase Transition Validity**
    - **Property 20: Game Over Freezes Systems**
    - **Validates: Requirements 9.1, 9.6**

- [ ] 7. Checkpoint - Ensure all gameplay logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement 3D rendering, camera, and input
  - [ ] 8.1 Implement GameCamera
    - Create `scripts/camera/game_camera.gd` extending Camera3D
    - Set orthographic projection, size = max(20, 20) × 1.2
    - Position at 45° azimuth, 60° elevation, distance 30, looking at grid center (10, 0, 10)
    - _Requirements: 13.1_
  - [ ] 8.2 Build main scene with ground plane and grid overlay
    - Create `scenes/main.tscn` as root Node3D
    - Add ground plane (PlaneMesh 20×20, dark green, positioned at grid center)
    - Add grid overlay (line mesh with white semi-transparent lines at cell boundaries, visible during Preparation)
    - Add ambient light + directional light
    - Add container nodes for structures, enemies, projectiles
    - Wire all manager nodes as children
    - _Requirements: 13.2, 13.3, 13.8_
  - [ ] 8.3 Implement input handling (screen-to-grid raycasting)
    - Add _unhandled_input handler to main scene or dedicated InputHandler node
    - Implement _screen_to_grid(): raycast from camera through click position to Y=0 plane, convert to grid coords
    - On cell click during Preparation: if shop selection active → try_place_structure; if structure exists → show context menu
    - Handle hover for visual feedback
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 9. Implement UI layer
  - [ ] 9.1 Create HUD scene
    - Create `scenes/ui/hud.tscn` with CanvasLayer containing: GoldLabel, WaveLabel, EnemiesLabel, CoreHealthBar (ProgressBar)
    - Create `scripts/ui/hud.gd` connecting to GameState signals (gold_changed, core_damaged, phase_changed)
    - Update labels reactively on signal emission
    - Show/hide wave info based on phase
    - _Requirements: 12.1, 12.2, 12.3_
  - [ ] 9.2 Create Shop Panel scene
    - Create `scenes/ui/shop_panel.tscn` with VBoxContainer of structure buttons
    - Create `scripts/ui/shop_panel.gd` with update_shop(gold, wave_number)
    - Implement unlock progression: wave 1 → Barrier + Basic; wave 2 → +Sniper; wave 3 → +AOE
    - Gray out unaffordable items, highlight selected item
    - Emit structure selection on button click
    - Show only during Preparation phase
    - _Requirements: 12.4, 12.5, 12.7_
  - [ ]* 9.3 Write property test for shop unlock progression
    - **Property 21: Shop Unlock Progression**
    - **Validates: Requirement 12.5**
  - [ ] 9.4 Create Context Menu scene
    - Create `scenes/ui/context_menu.tscn` with PanelContainer containing structure name, health display, sell button, repair button, close button
    - Create `scripts/ui/context_menu.gd` that shows/hides on structure click
    - Display sell value (calculated via Economy) and repair cost (if damaged)
    - Emit sell_structure/repair_structure actions on button press
    - _Requirements: 12.6_
  - [ ] 9.5 Create Game Over screen
    - Create `scenes/ui/game_over_screen.tscn` with centered overlay showing "GAME OVER", wave reached, restart button
    - Create `scripts/ui/game_over_screen.gd` connecting to GameState.game_over_triggered
    - Show on Game_Over phase, hide on restart
    - Emit restart action on button press
    - _Requirements: 12.8_
  - [ ] 9.6 Create Start Wave button
    - Add "Start Wave" Button to HUD/UI layer, visible only during Preparation phase
    - Connect pressed signal to PhaseManager.start_wave()
    - _Requirements: 12.7, 9.2_

- [ ] 10. Implement VFX
  - [ ] 10.1 Implement VFXManager with floating text
    - Create `scripts/managers/vfx_manager.gd` extending Node3D
    - Implement spawn_floating_text(world_pos, text, color): instantiate Label3D or billboarded label, tween upward + fade out over 1 second, auto-free
    - Connect to GameState.enemy_killed to show bounty text
    - _Requirements: 15.1, 15.4_
  - [ ] 10.2 Implement destruction effects and invalid placement indicator
    - Implement spawn_destruction_effect(world_pos): GPUParticles3D one-shot burst of 8-12 orange cubes, 0.5s lifetime
    - Implement spawn_invalid_placement(grid_pos): red flash PlaneMesh that fades over 1 second via tween
    - Connect destruction to structure_destroyed signal, invalid indicator to placement_failed signal
    - _Requirements: 15.2, 15.3_

- [ ] 11. Wire everything together in main scene
  - [ ] 11.1 Complete main scene wiring
    - Add all manager nodes to main.tscn in correct order (GridManager, PathfindingManager, SpawnManager, CombatManager, PhaseManager, VFXManager)
    - Add GameCamera, entity container nodes (StructuresContainer, EnemiesContainer, ProjectilesContainer)
    - Add UI CanvasLayer with HUD, ShopPanel, ContextMenu, GameOverScreen, StartWaveButton
    - Wire signal connections between managers (placement_succeeded → pathfinding.mark_dirty, etc.)
    - Wire UI actions to appropriate managers (start_wave button → phase_manager, sell → grid_manager, etc.)
    - Ensure _physics_process pipeline: SpawnManager.update → PathfindingManager.update_if_dirty → CombatManager.update (enemies self-update via their own _physics_process)
    - _Requirements: 16.2, 16.4, 16.6_
  - [ ] 11.2 Implement game restart flow
    - On restart: GameState.reset(), clear all groups, GridManager re-initialize, PathfindingManager re-sync, UI reset
    - _Requirements: 9.5_

- [ ] 12. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify full game loop: place structures → start wave → enemies spawn and path → towers fire → wave completes → next preparation phase
  - Verify game over + restart flow

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": ["1.1"]},
    {"tasks": ["1.2", "1.3", "1.4"]},
    {"tasks": ["1.5", "2.1"]},
    {"tasks": ["2.2", "2.3", "4.8", "9.1"]},
    {"tasks": ["2.4", "2.5", "4.1", "4.4"]},
    {"tasks": ["2.6", "4.2", "4.5", "9.2", "9.4", "9.5", "9.6"]},
    {"tasks": ["3", "4.3", "4.6", "9.3"]},
    {"tasks": ["4.7", "5.1", "8.1"]},
    {"tasks": ["5.2", "5.3", "8.2"]},
    {"tasks": ["6.1", "8.3"]},
    {"tasks": ["6.2", "10.1"]},
    {"tasks": ["7", "10.2"]},
    {"tasks": ["11.1"]},
    {"tasks": ["11.2"]},
    {"tasks": ["12"]}
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The Godot project lives at `core-defense/godot/` alongside the original TypeScript source
- All balance values from GameConfig must be verified against the original config.ts
- Use `_physics_process` (not `_process`) for all gameplay logic to maintain 60 Hz determinism
