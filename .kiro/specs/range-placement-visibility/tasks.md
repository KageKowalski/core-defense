# Implementation Plan: Range and Placement Visibility

## Overview

This plan implements a `PlacementPreviewManager` that provides ghost structure previews and range cell highlighting during the Preparation phase. The work is broken into: creating the core computation function, building the manager script, adding ghost preview rendering, adding range highlight rendering, wiring into main.gd, and integration testing.

## Tasks

- [x] 1. Create PlacementPreviewManager script with range computation
  - [x] 1.1 Create `scripts/managers/placement_preview_manager.gd` with class structure and state variables
    - Extend Node3D, add docstring
    - Declare state variables: `_active_type`, `_hovered_cell`, `_ghost_instance`, `_range_mesh`, `_last_highlighted_cells`
    - Declare `@export var grid_manager_path: NodePath`
    - Add `_grid_manager` reference variable
    - Implement `_ready()` to resolve grid_manager reference (exported path → fallback sibling lookup)
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 1.2 Implement static `compute_cells_in_range(source: Vector2i, attack_range: float) -> Array[Vector2i]`
    - Iterate over square bounding box of `ceil(attack_range)` around source
    - Bounds-check each candidate against `GameConfig.GRID_WIDTH` / `GRID_HEIGHT`
    - Include candidate if Euclidean distance from source center to candidate center ≤ attack_range
    - Return the filtered Array[Vector2i]
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.3 Implement static helper `get_structure_range_from_config(structure_type: String) -> float`
    - Look up `GameConfig.STRUCTURES[type]["range"]`, return -1.0 if key absent
    - _Requirements: 2.1, 4.1_

  - [x] 1.4 Implement static helper `get_placed_structure_range(structure: Node3D) -> float`
    - Check if structure has `attack_range` property, return it; otherwise return -1.0
    - _Requirements: 3.1, 4.2_

  - [ ]* 1.5 Write property test for `compute_cells_in_range` correctness (Property 2)
    - **Property 2: Range cell set computation correctness**
    - Run 100+ random (source, range) pairs; verify every returned cell is in-bounds AND within Euclidean distance, and every in-bounds cell within distance IS returned
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 1.6 Write property test for rangeless structures yielding empty set (Property 4)
    - **Property 4: Rangeless structures yield empty highlight set**
    - For structure types without "range" key, verify `get_structure_range_from_config` returns -1.0 and no cells are highlighted
    - **Validates: Requirements 4.1, 4.2**

- [x] 2. Implement ghost preview rendering
  - [x] 2.1 Implement `set_active_type(structure_type: String)` method
    - Free existing `_ghost_instance` if present
    - Instantiate scene from `GridManager.STRUCTURE_SCENES[structure_type]`
    - Apply transparent material override recursively to all MeshInstance3D children (opacity 0.5, unshaded, alpha transparency)
    - Disable processing on ghost node (`set_physics_process(false)`, `set_process(false)`)
    - Store as `_ghost_instance`, add as child, set `visible = false` initially
    - _Requirements: 1.1, 1.5_

  - [x] 2.2 Implement `clear_active_type()` method
    - Free `_ghost_instance` if present, set to null
    - Clear `_active_type` to ""
    - Clear range highlight
    - _Requirements: 1.4_

  - [x] 2.3 Implement ghost visibility logic within `update_hover(cell: Vector2i)`
    - If no active type or cell is `Vector2i(-1, -1)`, hide ghost
    - Query `_grid_manager.get_cell(cell)` — if empty dict (out of bounds) or occupied, hide ghost
    - Otherwise, position ghost at `_grid_manager.grid_to_world(cell)` and show it
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 2.4 Write property test for ghost visibility decision (Property 1)
    - **Property 1: Ghost visibility decision**
    - For 100+ random state combinations (phase, selection, cell validity, occupancy), verify ghost is visible iff: phase==PREPARATION AND selection active AND cell in-bounds AND cell unoccupied
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 3. Implement range highlight rendering
  - [x] 3.1 Create range highlight mesh infrastructure in `_ready()`
    - Create a `MeshInstance3D` with `ImmediateMesh`, add as child
    - Create and assign the range material (Color(0.2, 0.6, 1.0, 0.35), alpha, unshaded, cull disabled)
    - Store reference as `_range_mesh`
    - _Requirements: 2.1, 3.1_

  - [x] 3.2 Implement `_rebuild_range_mesh(cells: Array[Vector2i])` private method
    - Clear existing ImmediateMesh surface
    - If cells is empty, return (mesh stays cleared)
    - Begin a PRIMITIVE_TRIANGLES surface
    - For each cell, add two triangles forming a quad at y=0.015 covering the cell area
    - End surface
    - _Requirements: 2.1, 2.2, 3.1_

  - [x] 3.3 Integrate range computation into `update_hover()` for shop selection
    - When ghost is visible and `get_structure_range_from_config(_active_type)` > 0, compute cells and rebuild mesh
    - When ghost is hidden, clear range mesh
    - Store `_last_highlighted_cells` to skip rebuild when unchanged
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Integrate range computation into `update_hover()` for placed structure hover
    - When no active type, check if hovered cell has a structure via `_grid_manager.get_structure_at(cell)`
    - If structure exists, call `get_placed_structure_range(structure)` — if > 0, compute and show range
    - If no structure or range ≤ 0, clear range mesh
    - _Requirements: 3.1, 3.2, 4.2_

  - [ ]* 3.5 Write property test for range-combat parity (Property 3)
    - **Property 3: Range highlight matches combat targeting range**
    - For any placed tower, verify the range value used for highlighting equals `tower.attack_range`; for shop preview, verify it equals `GameConfig.STRUCTURES[type]["range"]`
    - **Validates: Requirements 2.1, 3.1, 5.1, 5.2**

- [x] 4. Implement phase-aware cleanup
  - [x] 4.1 Implement `on_phase_changed(old_phase: StringName, new_phase: StringName)` method
    - If `new_phase != "PREPARATION"`: hide ghost, clear range mesh, reset `_hovered_cell`
    - _Requirements: 1.4, 2.3_

- [x] 5. Wire PlacementPreviewManager into main scene
  - [x] 5.1 Add `PlacementPreviewManager` node to `scenes/main.tscn`
    - Add as child of root (sibling to GridManager, VFXManager)
    - Set `grid_manager_path` export to point to GridManager node
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 5.2 Update `main.gd` to forward shop selection state to PlacementPreviewManager
    - Add `@onready var placement_preview_manager` reference
    - In `_on_structure_selected()`: call `placement_preview_manager.set_active_type(structure_type)`
    - In `_on_selection_cleared()`: call `placement_preview_manager.clear_active_type()`
    - Connect `GameState.phase_changed` to `placement_preview_manager.on_phase_changed`
    - _Requirements: 1.1, 1.4, 2.1_

  - [x] 5.3 Update `main.gd` to forward mouse hover position each frame
    - Add `_process(delta)` to main.gd (visual update, per coding standards)
    - Each frame, raycast current mouse position to get hovered grid cell
    - Call `placement_preview_manager.update_hover(cell)`
    - _Requirements: 1.2, 2.2, 3.1_

- [x] 6. Checkpoint — Verify full integration
  - Ensure the game runs without errors after all changes
  - Verify ghost preview appears when selecting a tower and hovering a valid cell
  - Verify range highlight appears for towers but not barriers
  - Verify hovering a placed tower shows its range
  - Verify everything hides when combat phase starts
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    { "tasks": [1] },
    { "tasks": [2, 3, 4] },
    { "tasks": [5] },
    { "tasks": [6] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional property-based tests — GdUnit4 is not yet set up in this project.
- The `_process()` addition to main.gd is acceptable per coding standards since it only drives visual updates (ghost/range rendering), not gameplay logic.
- `compute_cells_in_range` is deliberately static and pure to enable unit testing without scene tree dependencies.
- The range highlight mesh uses `y = 0.015` to render above the existing grid overlay lines at `y = 0.01`.
