# Coding Standards — GDScript

These conventions apply to all GDScript in this project. Follow them when writing or modifying code.

## General Style

- Use tabs for indentation (Godot default).
- Use `snake_case` for variables, functions, signals, and file names.
- Use `PascalCase` for class names, node names, and enums.
- Use `SCREAMING_SNAKE_CASE` for constants.
- Prefix private methods and variables with a single underscore: `_my_internal_var`.
- One blank line between functions. Two blank lines between major sections (signals, constants, exports, state, lifecycle, public API, private methods).

## Script Structure (top to bottom)

Every script should follow this section order:

1. Class docstring (## comment at the very top)
2. `class_name` declaration (if applicable)
3. `extends` declaration
4. Signals
5. Constants / preloads
6. `@export` variables
7. Instance variables (state)
8. `@onready` variable declarations
9. `_ready()` and other lifecycle callbacks
10. Public API methods
11. Private helper methods

## Documentation

- Every script must start with a `##` docstring describing its purpose.
- Every public function must have a `##` docstring above it.
- Reference requirement numbers in docstrings when relevant: `## Requirements: 8.1, 8.8`

## Node References

- Use `@onready` for node references resolved at ready time.
- Use `%NodeName` (unique name syntax) for UI nodes accessed via `@onready`.
- Use `@export var path: NodePath` when a reference crosses scene boundaries.
- Fallback pattern: try exported path first, then `get_parent().get_node_or_null("SiblingName")`.

## Signals

- Prefer signals over direct function calls for inter-system communication.
- Define signal parameter types explicitly: `signal fired(tower: BaseTower, target: BaseEnemy)`.
- Connect signals in `_ready()`.
- Use `@warning_ignore("unused_signal")` on signals emitted by external systems.

## Groups

- Entities self-register to groups in `_ready()` via `add_to_group("group_name")`.
- Query groups via `get_tree().get_nodes_in_group("group_name")`.
- Standard groups: `enemies`, `towers`, `structures`, `projectiles`, `grid_manager`.

## Gameplay Logic

- All gameplay logic runs in `_physics_process(delta)`, not `_process(delta)`.
- `_process(delta)` is acceptable only for purely visual/UI updates (e.g., HUD label refresh).
- Use `is_instance_valid(node)` before accessing any node reference that could have been freed.

## Configuration

- All balance values live in `GameConfig` (autoload). Never hardcode numeric balance values in entity scripts.
- Entity scripts read their config in `_ready()` from `GameConfig.STRUCTURES[type]` or `GameConfig.ENEMIES[type]`.

## State Mutations

- All gold mutations go through `Economy.deduct()` / `Economy.credit()`.
- All phase transitions go through `GameState.set_phase()`.
- Emit `GameState.gold_changed` after any gold mutation.
- Never modify `GameState.gold` directly outside of `Economy`.

## Scene Organization

- Each entity type has its own `.tscn` file in `scenes/entities/`.
- Each UI panel has its own `.tscn` file in `scenes/ui/`.
- Preload scenes as constants at the top of scripts that instantiate them.
- Use `queue_free()` for entity removal (never `free()`).

## Error Handling

- Validate inputs at function boundaries (bounds checks, null checks, phase checks).
- Emit `placement_failed` with a reason string rather than silently failing.
- Guard against freed nodes with `is_instance_valid()` in any loop over groups.

## Naming Conventions

| Thing               | Convention          | Example                    |
|---------------------|---------------------|----------------------------|
| Script file         | snake_case.gd       | `base_tower.gd`           |
| Scene file          | snake_case.tscn     | `basic_enemy.tscn`        |
| Class name          | PascalCase          | `BaseTower`                |
| Signal              | past_tense_verb     | `fired`, `died`, `reached_core` |
| Export var          | snake_case          | `attack_range`             |
| Constant            | UPPER_SNAKE         | `GRID_WIDTH`               |
| Private method      | _underscore_prefix  | `_validate_target()`       |
| Enum values         | UPPER_SNAKE         | `Phase.PREPARATION`        |
