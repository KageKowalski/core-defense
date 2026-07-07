# Requirements Document

## Introduction

This document specifies the requirements for converting the "Core Defense" tower defense game from TypeScript/Three.js/Vite to Godot 4.7 with GDScript. The conversion must preserve all gameplay mechanics, balance values, and player experience while leveraging Godot's native architecture (scene tree, signals, resources, built-in physics loop).

## Glossary

- **Grid**: A 20×20 cell-based game board where structures are placed and enemies navigate
- **Cell**: A single unit of the grid identified by (column, row) coordinates as Vector2i
- **Critical_Resource**: The 2×2 core structure at the grid center that enemies attempt to reach
- **Structure**: A player-placed entity on the grid (Barrier, Basic Tower, Sniper Tower, AOE Tower)
- **Enemy**: An entity that spawns at grid edges and pathfinds toward the Critical Resource
- **Projectile**: A moving entity fired by towers that tracks and damages enemies
- **Phase**: The current game state (Preparation, Combat, Game_Over)
- **Wave**: A numbered round of enemy spawns during the Combat phase
- **Bounty**: Gold awarded to the player when an enemy is destroyed by a tower
- **Pathfinding**: A* algorithm finding shortest walkable path from a position to the core
- **Sealed_Core**: A state where no walkable path exists from any grid edge to the Critical Resource
- **GameState**: The autoload singleton holding all mutable game state
- **Economy**: The autoload singleton managing all gold transactions
- **GridManager**: The node managing the grid model, cell occupancy, and structure placement
- **PathfindingManager**: The node managing A* pathfinding with dirty-flag recalculation
- **SpawnManager**: The node managing wave composition and staggered enemy spawning
- **CombatManager**: The node managing tower targeting, projectile creation, and damage resolution
- **PhaseManager**: The node managing phase state machine transitions

## Requirements

### Requirement 1: Grid Initialization and Core Placement

**User Story:** As a player, I want a 20×20 grid with the Critical Resource at the center, so that I have a defined play area with a clear objective to defend.

#### Acceptance Criteria

1. WHEN the game scene loads, THE GridManager SHALL initialize a 20×20 grid where all cells start as walkable with no occupant
2. WHEN the grid is initialized, THE GridManager SHALL place the Critical Resource at the 4 center cells (rows 9-10, columns 9-10) and mark them as non-walkable core cells
3. THE Critical_Resource SHALL have 100 max health and 100 starting health
4. THE GridManager SHALL provide a coordinate conversion function that maps grid positions (col, row) to world positions (col + 0.5, 0, row + 0.5) using a cell size of 1.0

### Requirement 2: Structure Placement

**User Story:** As a player, I want to place structures on the grid during preparation phase, so that I can build defenses against incoming enemies.

#### Acceptance Criteria

1. WHILE the game is in Preparation phase, THE GridManager SHALL allow structure placement on any empty walkable non-core cell
2. WHEN a player attempts to place a structure on an occupied cell or core cell, THE GridManager SHALL reject the placement and emit a placement_failed signal with reason "cell_occupied"
3. WHEN a player attempts to place a structure without sufficient gold, THE GridManager SHALL reject the placement and emit a placement_failed signal with reason "insufficient_gold"
4. WHEN a placement would cause a Sealed_Core condition, THE GridManager SHALL reject the placement and emit a placement_failed signal with reason "would_seal_core"
5. WHEN a structure is successfully placed, THE Economy SHALL deduct the structure cost from player gold
6. WHEN a structure is placed, THE GridManager SHALL mark the cell as non-walkable and occupied, instantiate the structure scene, and emit placement_succeeded
7. WHEN a structure is placed or removed, THE PathfindingManager SHALL mark pathfinding as dirty for recalculation

### Requirement 3: Structure Selling and Repair

**User Story:** As a player, I want to sell structures for partial gold refund and repair damaged structures, so that I can adapt my defense strategy between waves.

#### Acceptance Criteria

1. WHILE the game is in Preparation phase, THE GridManager SHALL allow selling any placed structure
2. WHEN a structure is sold, THE Economy SHALL credit gold equal to floor((currentHealth / maxHealth) × originalCost × 0.5)
3. WHEN a structure is sold, THE GridManager SHALL remove the structure node, mark the cell as walkable and unoccupied, and trigger pathfinding recalculation
4. WHILE the game is in Preparation phase, THE GridManager SHALL allow repairing any damaged structure
5. WHEN a structure is repaired, THE Economy SHALL deduct gold equal to ceil(((maxHealth - currentHealth) / maxHealth) × originalCost × 0.7)
6. WHEN a structure is repaired, THE structure node SHALL have its current_health restored to max_health
7. IF a player attempts to sell or repair during Combat or Game_Over phase, THEN THE GridManager SHALL reject the action

### Requirement 4: Economy System

**User Story:** As a player, I want to earn gold from kills and wave completions, so that I can afford to build and upgrade my defenses.

#### Acceptance Criteria

1. THE Economy SHALL start the player with 100 gold at game start
2. WHEN an enemy is destroyed by a tower, THE Economy SHALL credit the enemy's bounty (Basic: 5g, Brute: 15g) to player gold
3. WHEN a wave is completed, THE Economy SHALL credit a wave bonus of (20 + (waveNumber - 1) × 5) gold
4. THE Economy SHALL prevent gold from going below zero on any deduction
5. WHEN gold changes, THE GameState SHALL emit a gold_changed signal with the new amount

### Requirement 5: Pathfinding

**User Story:** As a developer, I want enemies to find optimal paths to the core using A* pathfinding, so that enemies navigate intelligently around structures.

#### Acceptance Criteria

1. THE PathfindingManager SHALL use AStarGrid2D with 4-directional movement (no diagonals) on the 20×20 grid
2. WHEN pathfinding is marked dirty, THE PathfindingManager SHALL recalculate all active enemy paths once per physics frame
3. WHEN finding a path to the core, THE PathfindingManager SHALL target the nearest walkable cell adjacent to the 2×2 Critical Resource
4. WHEN the core is completely sealed (no walkable path from any edge to core), THE PathfindingManager SHALL detect this via BFS flood fill from core-adjacent cells
5. WHEN the core is sealed, THE PathfindingManager SHALL provide a fallback path to the nearest barrier for Brute enemies
6. THE PathfindingManager SHALL provide a would_seal_core_if_blocked function that temporarily blocks a cell and checks if the core becomes sealed

### Requirement 6: Enemy Movement

**User Story:** As a player, I want enemies to move along their calculated paths toward the core, so that the tower defense gameplay loop functions correctly.

#### Acceptance Criteria

1. THE BaseEnemy SHALL move along its assigned path at its configured speed (Basic: 2 cells/sec, Brute: 1 cell/sec)
2. THE BaseEnemy SHALL interpolate its world position between waypoints for smooth visual movement
3. WHEN an enemy reaches the end of its path (core-adjacent cell), THE enemy SHALL emit reached_core signal with its damage value and remove itself from the scene
4. WHEN a Brute enemy encounters a barrier in its path, THE Brute SHALL stop moving and attack the barrier at 1 hit per second dealing 25 structure damage per hit
5. WHEN a barrier is destroyed by a Brute attack, THE GridManager SHALL free the cell, remove the barrier, and trigger pathfinding recalculation
6. WHEN pathfinding is recalculated, THE enemy SHALL receive a new path and reset its path index to 0

### Requirement 7: Wave Spawning

**User Story:** As a player, I want enemies to spawn in waves with increasing difficulty, so that the game provides escalating challenge.

#### Acceptance Criteria

1. WHEN a wave begins, THE SpawnManager SHALL calculate composition as: total = 5 + (waveNumber - 1) × 2, brutes = max(0, waveNumber - 3), basics = total - brutes
2. WHEN spawning enemies, THE SpawnManager SHALL use a staggered interval of clamp(2.0 - waveNumber × 0.1, 0.3, 2.0) seconds between spawns
3. WHEN selecting spawn positions, THE SpawnManager SHALL choose 2-4 random grid edges and cycle through them for each spawn
4. WHEN a spawn position yields no valid path to core, THE SpawnManager SHALL try alternative positions on other edges (up to 5 attempts per edge)
5. THE SpawnManager SHALL distribute Brute enemies evenly throughout the spawn queue
6. WHEN all enemies in the wave are spawned, THE SpawnManager SHALL become inactive until the next wave begins

### Requirement 8: Combat System

**User Story:** As a player, I want towers to automatically target and fire at enemies within range, so that my placed defenses actively engage threats.

#### Acceptance Criteria

1. WHILE in Combat phase, THE CombatManager SHALL update all tower targeting and fire cooldowns each physics frame
2. THE Basic Tower SHALL target the enemy closest to the core (lowest remaining path cost) within range 3
3. THE Sniper Tower SHALL target the enemy with highest current health within range 6
4. THE AOE Tower SHALL target the enemy closest to the core within range 2.5
5. WHEN a tower fires, THE CombatManager SHALL instantiate a projectile that tracks the target at speed 10 cells/sec
6. WHEN a projectile reaches its target, THE projectile SHALL apply damage (Basic: 15, Sniper: 60, AOE: 20)
7. WHEN an AOE projectile hits, THE CombatManager SHALL apply damage to all enemies within 1.0 cell radius of the impact point
8. WHEN an enemy's health reaches zero, THE enemy SHALL emit a died signal and remove itself from the scene
9. IF a projectile's target is destroyed before impact, THEN THE projectile SHALL dissipate (remove itself)
10. WHEN a tower's target leaves range or is destroyed, THE tower SHALL select a new target from enemies currently in range

### Requirement 9: Phase Management

**User Story:** As a player, I want clear game phases (preparation, combat, game over), so that I can understand when to build and when combat occurs.

#### Acceptance Criteria

1. THE PhaseManager SHALL enforce valid transitions: Preparation→Combat, Combat→Preparation, Combat→Game_Over, Game_Over→Preparation
2. WHEN the player clicks "Start Wave" during Preparation, THE PhaseManager SHALL transition to Combat phase and signal wave_started
3. WHEN all enemies in a wave are destroyed or reach the core and no enemies remain to spawn, THE PhaseManager SHALL transition to Preparation phase, increment wave number, and award wave bonus
4. WHEN core health reaches zero, THE PhaseManager SHALL transition to Game_Over phase and freeze all systems
5. WHEN the player clicks "Restart" during Game_Over, THE PhaseManager SHALL reset all state, clear all entities from the scene tree, and transition to Preparation phase
6. WHILE in Game_Over phase, THE CombatManager and SpawnManager SHALL not process any updates

### Requirement 10: Structure Balance Values

**User Story:** As a player, I want structures with specific stats that match the original game's balance, so that gameplay feels identical to the TypeScript version.

#### Acceptance Criteria

1. THE Barrier SHALL cost 10 gold and have 150 max health with no attack capability
2. THE Basic Tower SHALL cost 25 gold, have 50 max health, range 3, damage 15, fire rate 1.5 shots/sec, and target priority "closest to core"
3. THE Sniper Tower SHALL cost 50 gold, have 40 max health, range 6, damage 60, fire rate 0.4 shots/sec, and target priority "highest health"
4. THE AOE Tower SHALL cost 50 gold, have 40 max health, range 2.5, damage 20, fire rate 0.8 shots/sec, AOE radius 1.0, and target priority "closest to core"

### Requirement 11: Enemy Balance Values

**User Story:** As a player, I want enemies with specific stats that match the original game's balance, so that difficulty progression is preserved.

#### Acceptance Criteria

1. THE Basic Enemy SHALL have 50 health, speed 2 cells/sec, 10 core damage, 0 structure damage, and 5 gold bounty
2. THE Brute Enemy SHALL have 200 health, speed 1 cell/sec, 25 core damage, 25 structure damage, and 15 gold bounty
3. THE Brute Enemy SHALL only appear from wave 4 onward (brute count = max(0, waveNumber - 3))

### Requirement 12: User Interface

**User Story:** As a player, I want a clear UI showing gold, wave info, and shop options, so that I can make informed strategic decisions.

#### Acceptance Criteria

1. THE HUD SHALL display current gold amount, updating reactively via the gold_changed signal
2. WHILE in Combat phase, THE HUD SHALL display the current wave number and enemies remaining count
3. THE HUD SHALL display a core health bar that updates via the core_damaged signal
4. WHILE in Preparation phase, THE Shop Panel SHALL display available structures with costs, graying out unaffordable items
5. THE Shop Panel SHALL unlock structures progressively: Barrier and Basic Tower from wave 1, Sniper Tower from wave 2, AOE Tower from wave 3
6. WHEN a player clicks on an existing structure during Preparation phase, THE UI SHALL show a context menu with sell value and repair cost (if damaged)
7. WHILE in Preparation phase, THE UI SHALL display a "Start Wave" button
8. WHEN the game enters Game_Over phase, THE UI SHALL display a game over overlay showing the wave reached and a "Restart" button

### Requirement 13: 3D Rendering and Camera

**User Story:** As a player, I want a 3D isometric-style view of the game board, so that the visual experience matches the original Three.js rendering.

#### Acceptance Criteria

1. THE GameCamera SHALL use orthographic projection with 45° azimuth and 60° elevation angles, looking at the grid center
2. THE game scene SHALL include a ground plane mesh matching the 20×20 grid dimensions with a dark green color
3. WHILE in Preparation phase, THE scene SHALL display a semi-transparent white grid overlay showing cell boundaries
4. THE Critical Resource SHALL render as a 2×2 golden box mesh at the grid center with visible height (1.5 units)
5. THE structures SHALL render as colored box meshes: Barrier (brown, 0.8×1.0), Basic Tower (blue, 0.7×1.2), Sniper Tower (purple, 0.7×1.2), AOE Tower (orange-red, 0.7×1.2)
6. THE enemies SHALL render as colored box meshes: Basic (green, 0.4×0.5), Brute (dark red, 0.6×0.8)
7. THE projectiles SHALL render as yellow sphere meshes (radius 0.15)
8. THE scene SHALL include ambient light and a directional light for 3D depth

### Requirement 14: Input Handling

**User Story:** As a player, I want to click on grid cells to place structures and interact with existing ones, so that I can control the game.

#### Acceptance Criteria

1. WHEN the player clicks on the game viewport, THE input handler SHALL raycast from the camera through the click position to the Y=0 ground plane to determine the grid cell
2. WHEN a valid grid cell is clicked during Preparation phase with a structure selected in the shop, THE input handler SHALL request placement at that cell
3. WHEN a valid grid cell containing an existing structure is clicked during Preparation phase with no shop selection, THE input handler SHALL open the context menu for that structure
4. THE input handler SHALL convert screen coordinates to grid coordinates using Camera3D.project_ray_origin and project_ray_normal

### Requirement 15: Visual Effects

**User Story:** As a player, I want visual feedback for kills, gold earned, and invalid actions, so that I understand what is happening in the game.

#### Acceptance Criteria

1. WHEN an enemy is killed, THE VFXManager SHALL spawn a floating text showing the bounty amount (e.g., "+5g") in gold color at the enemy's position
2. WHEN a structure is destroyed, THE VFXManager SHALL spawn a particle burst of 8-12 orange cubes that expand outward and fade over 0.5 seconds
3. WHEN a placement is rejected, THE VFXManager SHALL display a red flash indicator on the target cell that fades over 1 second
4. THE floating text SHALL animate upward and fade out over 1 second

### Requirement 16: Godot Project Structure

**User Story:** As a developer, I want a well-organized Godot project following conventions, so that the codebase is maintainable and extensible.

#### Acceptance Criteria

1. THE project SHALL use autoload singletons for GameConfig, GameState, and Economy accessible from any script
2. THE project SHALL use separate scene files (.tscn) for each entity type (barriers, towers, enemies, projectiles, critical resource)
3. THE project SHALL organize scripts into autoloads/, managers/, entities/, ui/, and camera/ directories under res://scripts/
4. THE project SHALL use Godot signals for event decoupling between systems instead of direct function calls
5. THE project SHALL configure physics tick rate to 60 Hz to match the original fixed-timestep game loop
6. THE project SHALL use _physics_process for all gameplay logic to ensure deterministic simulation
