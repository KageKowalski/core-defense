## GridManager
## Manages the 20x20 grid model, cell occupancy, structure placement/sell/repair.
## Replaces grid.ts and placement.ts from the original TypeScript source.
extends Node3D

# --- Signals ---
signal placement_succeeded(position: Vector2i, structure_type: String)
signal placement_failed(position: Vector2i, reason: String)

# --- Constants ---
## Preloaded structure scenes for instantiation.
const STRUCTURE_SCENES: Dictionary = {
	"barrier": preload("res://scenes/entities/barrier.tscn"),
	"basic_tower": preload("res://scenes/entities/basic_tower.tscn"),
	"sniper_tower": preload("res://scenes/entities/sniper_tower.tscn"),
	"aoe_tower": preload("res://scenes/entities/aoe_tower.tscn"),
}

# --- Exports ---
## Path to the PathfindingManager node for seal-core checks and dirty marking.
@export var pathfinding_manager_path: NodePath = NodePath("")

# --- State ---
## 2D array of cell dictionaries: cells[row][col] = {"occupant": null, "is_walkable": true, "is_core": false}
var cells: Array[Array] = []

## Tracks placed structure nodes by grid position: Vector2i -> Node reference
var structure_nodes: Dictionary = {}

# --- References ---
var pathfinding_manager: Node = null


# --- Lifecycle ---

func _ready() -> void:
	_initialize_grid()
	_place_critical_resource()
	add_to_group("grid_manager")

	# Resolve PathfindingManager reference
	if not pathfinding_manager_path.is_empty():
		pathfinding_manager = get_node(pathfinding_manager_path)
	else:
		# Fallback: try to find PathfindingManager as a sibling
		pathfinding_manager = get_parent().get_node_or_null("PathfindingManager")


# --- Public API ---

## Returns the cell dictionary at the given position.
## pos.x = column, pos.y = row. Returns empty Dictionary {} if out of bounds.
func get_cell(pos: Vector2i) -> Dictionary:
	if pos.x < 0 or pos.x >= GameConfig.GRID_WIDTH or pos.y < 0 or pos.y >= GameConfig.GRID_HEIGHT:
		return {}
	return cells[pos.y][pos.x]


## Returns whether the cell at the given position is walkable.
## Returns false for out-of-bounds positions.
func is_walkable(pos: Vector2i) -> bool:
	var cell := get_cell(pos)
	return cell.get("is_walkable", false)


## Converts a grid position (col, row) to a world position.
## Formula: Vector3(col + 0.5, 0, row + 0.5)
func grid_to_world(pos: Vector2i) -> Vector3:
	return Vector3(pos.x + 0.5, 0, pos.y + 0.5)


## Attempts to place a structure at the given grid position.
## Validates: bounds, occupancy/core, gold, seal-core check, phase.
## Returns true if placement succeeded, false otherwise. Emits appropriate signals.
func try_place_structure(pos: Vector2i, structure_type: String) -> bool:
	# Phase check: only during PREPARATION
	if GameState.phase != GameState.Phase.PREPARATION:
		placement_failed.emit(pos, "wrong_phase")
		return false

	# Bounds check
	var cell := get_cell(pos)
	if cell.is_empty():
		placement_failed.emit(pos, "out_of_bounds")
		return false

	# Occupied or core check
	if cell["occupant"] != null or cell["is_core"]:
		placement_failed.emit(pos, "cell_occupied")
		return false

	# Affordability check
	var cost: int = GameConfig.STRUCTURES[structure_type]["cost"]
	if not Economy.can_afford(cost):
		placement_failed.emit(pos, "insufficient_gold")
		return false

	# Anti-blocking check: would placing here seal the core?
	if pathfinding_manager and pathfinding_manager.would_seal_core_if_blocked(pos):
		placement_failed.emit(pos, "would_seal_core")
		return false

	# All checks passed — execute placement
	Economy.deduct(cost)

	# Instantiate the structure scene
	var scene: PackedScene = STRUCTURE_SCENES[structure_type]
	var structure_node: Node3D = scene.instantiate()

	# Position at grid center
	structure_node.position = grid_to_world(pos)

	# Set grid_position on the structure if it has the property
	if "grid_position" in structure_node:
		structure_node.grid_position = pos

	# Mark cell as occupied and non-walkable
	cell["occupant"] = structure_type
	cell["is_walkable"] = false

	# Store reference and add to scene tree
	structure_nodes[pos] = structure_node
	add_child(structure_node)

	# Emit success signal
	placement_succeeded.emit(pos, structure_type)

	# Notify GameState
	GameState.structure_placed.emit(structure_node)

	# Mark pathfinding as dirty for recalculation
	if pathfinding_manager:
		pathfinding_manager.mark_dirty()

	return true


## Sells the structure at the given grid position.
## Only allowed during PREPARATION phase. Returns true if sold successfully.
func sell_structure(pos: Vector2i) -> bool:
	# Phase check: only during PREPARATION
	if GameState.phase != GameState.Phase.PREPARATION:
		return false

	# Check if a structure exists at this position
	if not structure_nodes.has(pos):
		return false

	var structure_node: Node3D = structure_nodes[pos]

	# Calculate sell value based on structure's current/max health and original cost
	var current_health: int = structure_node.current_health if "current_health" in structure_node else 0
	var max_health: int = structure_node.max_health if "max_health" in structure_node else 0
	var original_cost: int = structure_node.original_cost if "original_cost" in structure_node else 0

	var sell_value: int = Economy.calculate_sell_value(current_health, max_health, original_cost)

	# Credit gold to the player
	Economy.credit(sell_value)

	# Remove the node from the scene tree
	structure_node.queue_free()

	# Mark cell as walkable and unoccupied
	var cell := get_cell(pos)
	cell["occupant"] = null
	cell["is_walkable"] = true

	# Remove from structure tracking
	structure_nodes.erase(pos)

	# Emit structure_sold signal on GameState
	GameState.structure_sold.emit(pos, sell_value)

	# Mark pathfinding as dirty for recalculation
	if pathfinding_manager:
		pathfinding_manager.mark_dirty()

	return true


## Repairs the structure at the given grid position to full health.
## Only allowed during PREPARATION phase. Returns true if repaired successfully.
func repair_structure(pos: Vector2i) -> bool:
	# Phase check: only during PREPARATION
	if GameState.phase != GameState.Phase.PREPARATION:
		return false

	# Check if a structure exists at this position
	if not structure_nodes.has(pos):
		return false

	var structure_node: Node3D = structure_nodes[pos]

	# Get health properties
	var current_health: int = structure_node.current_health if "current_health" in structure_node else 0
	var max_health: int = structure_node.max_health if "max_health" in structure_node else 0
	var original_cost: int = structure_node.original_cost if "original_cost" in structure_node else 0

	# Already at full health, nothing to repair
	if current_health >= max_health:
		return false

	# Calculate repair cost
	var repair_cost: int = Economy.calculate_repair_cost(current_health, max_health, original_cost)

	# Check affordability
	if not Economy.can_afford(repair_cost):
		return false

	# Deduct repair cost
	Economy.deduct(repair_cost)

	# Restore health to max
	structure_node.current_health = max_health

	return true


## Returns the structure node at the given grid position, or null if none exists.
## Used by brute enemies to find barriers to attack.
func get_structure_at(pos: Vector2i) -> Node:
	return structure_nodes.get(pos, null)


# --- Private Methods ---

## Initializes the 20x20 grid with all cells set to walkable, no occupant, not core.
func _initialize_grid() -> void:
	cells.clear()
	for row in range(GameConfig.GRID_HEIGHT):
		var row_arr: Array = []
		for col in range(GameConfig.GRID_WIDTH):
			row_arr.append({"occupant": null, "is_walkable": true, "is_core": false})
		cells.append(row_arr)


## Places the Critical Resource at the 4 center cells of the grid.
## For a 20x20 grid, the center cells are: (row=9, col=9), (row=9, col=10), (row=10, col=9), (row=10, col=10)
func _place_critical_resource() -> void:
	var center_row: int = GameConfig.GRID_HEIGHT / 2 - 1  # 9
	var center_col: int = GameConfig.GRID_WIDTH / 2 - 1   # 9

	var core_positions: Array[Vector2i] = [
		Vector2i(center_col, center_row),          # col=9, row=9
		Vector2i(center_col + 1, center_row),      # col=10, row=9
		Vector2i(center_col, center_row + 1),      # col=9, row=10
		Vector2i(center_col + 1, center_row + 1),  # col=10, row=10
	]

	for pos in core_positions:
		var cell: Dictionary = cells[pos.y][pos.x]
		cell["occupant"] = "critical_resource"
		cell["is_walkable"] = false
		cell["is_core"] = true
