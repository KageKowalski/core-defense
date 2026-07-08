# Project Status

This is a living document. Update it when features are completed or new work begins.

## Current State: Core Implementation Complete

The Godot 4.7 conversion is feature-complete. All 16 requirement areas from the original TypeScript version have been implemented.

## Completed Systems

- [x] Project structure and autoloads (GameConfig, GameState, Economy)
- [x] GridManager (20×20 grid, placement, sell, repair, seal-core prevention)
- [x] PathfindingManager (AStarGrid2D, dirty-flag, sealed-core BFS, brute fallback)
- [x] SpawnManager (wave composition, staggered spawning, edge selection)
- [x] CombatManager (tower targeting, projectile creation, damage resolution)
- [x] PhaseManager (state machine, wave start/complete, game over, restart)
- [x] VFXManager (floating text, destruction particles, invalid placement flash)
- [x] Entity hierarchy (BaseStructure, BaseTower, BaseEnemy with concrete types)
- [x] All structure types (Barrier, Basic Tower, Sniper Tower, AOE Tower)
- [x] All enemy types (Basic, Brute with barrier-attack behavior)
- [x] Projectile system (tracking, single-target, AOE splash)
- [x] Critical Resource (2×2 core with damage feedback)
- [x] HUD (gold, wave, enemies, core health bar)
- [x] Shop Panel (unlock progression, affordability, selection)
- [x] Context Menu (sell/repair on structure click)
- [x] Game Over Screen (wave reached display, restart button)
- [x] Start Wave Button (phase-aware visibility)
- [x] GameCamera (orthographic, isometric angles)
- [x] Input handling (screen-to-grid raycasting, placement, context menu)
- [x] Grid overlay (semi-transparent lines, visible during Preparation only)
- [x] Main scene wiring (signal connections, physics pipeline)
- [x] PlacementPreviewManager (ghost preview, range highlighting during Preparation)

## Not Yet Implemented

- [ ] Property-based tests (GdUnit4) — GdUnit4 installed, optional PBT tests defined but not written
- [ ] Custom `.tres` resource files (currently using dictionary-based config in GameConfig)
- [ ] Sound effects / music
- [ ] Tower upgrade system
- [ ] Additional enemy types beyond Basic and Brute
- [ ] Difficulty settings
- [ ] Save/load system

## Known Issues

- `GameState.structure_destroyed` signal is connected in `main.gd` (for VFX) but is never emitted anywhere. Structure destruction VFX does not trigger.

## Origin

This project was converted from a TypeScript/Three.js/Vite implementation. The original source informed all balance values and gameplay mechanics. The `.kiro/specs/godot-conversion/` directory contains the full requirements, design, and task documents from the conversion process.
