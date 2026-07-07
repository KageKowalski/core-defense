---
inclusion: manual
---

# Domain Glossary

Project-specific terminology for Core Defense.

## Game Entities

| Term              | Definition                                                                |
|-------------------|---------------------------------------------------------------------------|
| Grid              | The 20×20 cell-based game board                                           |
| Cell              | A single unit of the grid, identified by `Vector2i(col, row)`             |
| Critical Resource | The 2×2 core structure at the grid center (cells 9,9 through 10,10). The thing enemies try to reach. Also called "the core". |
| Structure         | A player-placed entity on the grid (Barrier, Basic Tower, Sniper Tower, AOE Tower) |
| Barrier           | A non-attacking structure that blocks enemy paths. Brutes can destroy it. |
| Tower             | A structure that automatically attacks enemies within range               |
| Enemy             | An entity that spawns at grid edges and pathfinds toward the core         |
| Basic Enemy       | Standard enemy: moderate health/speed, no structure damage                |
| Brute Enemy       | Heavy enemy: high health, slow, attacks barriers, appears wave 4+         |
| Projectile        | A moving entity fired by towers that tracks and damages enemies           |

## Game Mechanics

| Term            | Definition                                                                 |
|-----------------|----------------------------------------------------------------------------|
| Phase           | The current game state: Preparation, Combat, or Game_Over                  |
| Preparation     | Phase where players place/sell/repair structures. Combat is paused.         |
| Combat          | Phase where enemies spawn, move, and towers fire                           |
| Game_Over       | Phase entered when core health reaches 0. All systems freeze.              |
| Wave            | A numbered round of enemy spawns. Difficulty increases each wave.          |
| Bounty          | Gold awarded when a tower kills an enemy                                   |
| Wave Bonus      | Gold awarded when all enemies in a wave are cleared                        |
| Sealed Core     | A state where no walkable path exists from any grid edge to the core       |
| Anti-blocking   | The mechanic that prevents players from completely sealing the core with structures |
| Dirty Flag      | A pattern where `mark_dirty()` requests recalculation, executed once per frame |

## Technical Terms

| Term              | Definition                                                               |
|-------------------|--------------------------------------------------------------------------|
| Autoload          | A Godot singleton node that persists across scene changes                |
| Group             | A Godot mechanism for tagging and batch-querying nodes                   |
| Physics Frame     | A fixed-timestep tick at 60 Hz where all gameplay logic runs             |
| `_physics_process`| Godot callback for per-physics-frame logic (deterministic)               |
| AStarGrid2D       | Godot's built-in A* pathfinding on a grid                               |
| PackedVector2Array | Godot's optimized array type used for pathfinding waypoints             |
| `queue_free()`    | Godot method to safely remove a node at end of frame                     |

## Coordinate Systems

| System       | Format                        | Usage                          |
|--------------|-------------------------------|--------------------------------|
| Grid coords  | `Vector2i(col, row)`          | Cell addressing, pathfinding   |
| World coords | `Vector3(x, y, z)`           | 3D positioning of nodes        |
| Conversion   | `grid_to_world(pos) → Vector3(col + 0.5, 0, row + 0.5)` | Centers entity in cell |
