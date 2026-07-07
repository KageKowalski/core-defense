## PathfindingManager
## A* pathfinding with dirty-flag recalculation, sealed-core detection,
## and anti-blocking fallback. Replaces pathfinding.ts from the TypeScript source.
## Uses Godot's AStarGrid2D for 4-directional (no diagonals) pathfinding on 20x20 grid.
extends Node

# --- References ---
## Reference to GridManager node (set via @onready or exported path).
@export var grid_manager_path: NodePath = NodePath("")
var grid_manager: Node = null

# --- Internal State ---
var astar: AStarGrid2D
var _dirty: bool = false
var _core_cells: Array[Vector2i] = []
var _core_adjacent_cells: Array[Vector2i] = []


# --- Lifecycle ---

func _ready() -> void:
	# Resolve GridManager reference
	if not grid_manager_path.is_empty():
		grid_manager = get_node(grid_manager_path)
	else:
		# Fallback: try to find GridManager as a sibling
		grid_manager = get_parent().get_node_or_null("GridManager")

	# Setup AStarGrid2D
	astar = AStarGrid2D.new()
	astar.region = Rect2i(0, 0, GameConfig.GRID_WIDTH, GameConfig.GRID_HEIGHT)
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_NEVER
	astar.update()

	# Compute core cells and their adjacent walkable cells
	_compute_core_cells()

	# Initial walkability sync
	_sync_walkability()


# --- Public API ---

## Marks pathfinding as dirty, triggering recalculation on next update.
## Called when a structure is placed, sold, or destroyed.
func mark_dirty() -> void:
	_dirty = true


## If pathfinding is dirty, syncs walkability from GridManager, recalculates
## all enemy paths, and clears the dirty flag. Call once per physics frame.
func update_if_dirty() -> void:
	if _dirty:
		_sync_walkability()
		_recalculate_all_enemy_paths()
		_dirty = false


## Finds the shortest path from the given position to any walkable cell
## adjacent to the core. Returns empty PackedVector2Array if no path exists.
func find_path_to_core(from: Vector2i) -> PackedVector2Array:
	var best_path: PackedVector2Array = PackedVector2Array()
	var best_cost: float = INF

	for target in _core_adjacent_cells:
		if astar.is_point_solid(target):
			continue
		# Skip if start position is solid (enemy might be on a structure cell)
		if astar.is_point_solid(from):
			continue
		var path := astar.get_point_path(from, target)
		if path.size() > 0 and path.size() < best_cost:
			best_path = path
			best_cost = path.size()

	return best_path


## Returns true if the core is completely sealed off - no walkable path exists
## from any core-adjacent walkable cell to any grid edge.
## Uses BFS flood fill from core-adjacent walkable cells.
func is_core_sealed() -> bool:
	var visited: Dictionary = {}
	var queue: Array[Vector2i] = []

	# Seed BFS with walkable core-adjacent cells
	for cell in _core_adjacent_cells:
		if not astar.is_point_solid(cell):
			queue.append(cell)
			visited[cell] = true

	# If no walkable cells adjacent to core, it's sealed
	if queue.is_empty():
		return true

	# BFS: check if any reached cell is on the grid edge
	while queue.size() > 0:
		var current: Vector2i = queue.pop_front()
		if _is_edge_cell(current):
			return false
		for neighbor in _get_walkable_neighbors(current):
			if not visited.has(neighbor):
				visited[neighbor] = true
				queue.append(neighbor)

	return true


## Temporarily blocks a cell and checks if the core would become sealed.
## Used for placement validation to prevent anti-blocking violations.
func would_seal_core_if_blocked(pos: Vector2i) -> bool:
	astar.set_point_solid(pos, true)
	var sealed := is_core_sealed()
	astar.set_point_solid(pos, false)
	return sealed


## Finds a path from the given position to the nearest barrier.
## Used as an anti-blocking fallback for Brute enemies when the core is sealed.
## Returns empty PackedVector2Array if no path to any barrier exists.
func find_path_to_nearest_barrier(from: Vector2i) -> PackedVector2Array:
	if astar.is_point_solid(from):
		return PackedVector2Array()

	# Find all barrier positions from GridManager
	var barrier_positions: Array[Vector2i] = []
	if grid_manager:
		for row in range(GameConfig.GRID_HEIGHT):
			for col in range(GameConfig.GRID_WIDTH):
				var cell: Dictionary = grid_manager.get_cell(Vector2i(col, row))
				if cell.get("occupant", null) == "barrier":
					barrier_positions.append(Vector2i(col, row))

	if barrier_positions.is_empty():
		return PackedVector2Array()

	# Sort barriers by Manhattan distance from 'from'
	barrier_positions.sort_custom(func(a: Vector2i, b: Vector2i) -> bool:
		var dist_a := absi(from.x - a.x) + absi(from.y - a.y)
		var dist_b := absi(from.x - b.x) + absi(from.y - b.y)
		return dist_a < dist_b
	)

	# Try to path to walkable cells adjacent to each barrier (nearest first)
	for barrier_pos in barrier_positions:
		var adjacent_walkable := _get_walkable_neighbors(barrier_pos)
		for adj_cell in adjacent_walkable:
			var path := astar.get_point_path(from, adj_cell)
			if path.size() > 0:
				return path

	return PackedVector2Array()


# --- Internal Helpers ---

## Finds the 4 core cells and computes the walkable cells adjacent to them.
func _compute_core_cells() -> void:
	_core_cells.clear()
	_core_adjacent_cells.clear()

	# Core cells for 20x20 grid: center 2x2 at (9,9), (10,9), (9,10), (10,10)
	var center_col: int = GameConfig.GRID_WIDTH / 2 - 1   # 9
	var center_row: int = GameConfig.GRID_HEIGHT / 2 - 1  # 9

	_core_cells = [
		Vector2i(center_col, center_row),          # (9, 9)
		Vector2i(center_col + 1, center_row),      # (10, 9)
		Vector2i(center_col, center_row + 1),      # (9, 10)
		Vector2i(center_col + 1, center_row + 1),  # (10, 10)
	]

	# Mark core cells as solid in AStarGrid2D
	for core_pos in _core_cells:
		astar.set_point_solid(core_pos, true)

	# Find all unique 4-directional neighbors of core cells that are within bounds
	var adjacent_set: Dictionary = {}
	var directions: Array[Vector2i] = [
		Vector2i(0, -1), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0)
	]

	for core_pos in _core_cells:
		for dir in directions:
			var adj: Vector2i = core_pos + dir
			if adj.x >= 0 and adj.x < GameConfig.GRID_WIDTH and adj.y >= 0 and adj.y < GameConfig.GRID_HEIGHT:
				# Skip other core cells
				if adj not in _core_cells and not adjacent_set.has(adj):
					adjacent_set[adj] = true
					_core_adjacent_cells.append(adj)


## Syncs AStarGrid2D solid points from GridManager cell walkability.
func _sync_walkability() -> void:
	if not grid_manager:
		return

	for row in range(GameConfig.GRID_HEIGHT):
		for col in range(GameConfig.GRID_WIDTH):
			var pos := Vector2i(col, row)
			var cell: Dictionary = grid_manager.get_cell(pos)
			var is_solid: bool = not cell.get("is_walkable", true)
			astar.set_point_solid(pos, is_solid)

	# Always call update after modifying points
	astar.update()


## Recalculates paths for all active enemies in the "enemies" group.
## If core is sealed, uses anti-blocking fallback for path assignment.
func _recalculate_all_enemy_paths() -> void:
	var enemies := get_tree().get_nodes_in_group("enemies")
	var sealed := is_core_sealed()

	for enemy in enemies:
		var enemy_pos: Vector2i = enemy.grid_position if "grid_position" in enemy else Vector2i.ZERO
		var new_path: PackedVector2Array

		if sealed:
			new_path = find_path_to_nearest_barrier(enemy_pos)
		else:
			new_path = find_path_to_core(enemy_pos)

		if enemy.has_method("set_path"):
			enemy.set_path(new_path)


## Returns walkable (non-solid) 4-directional neighbors within grid bounds.
func _get_walkable_neighbors(pos: Vector2i) -> Array[Vector2i]:
	var neighbors: Array[Vector2i] = []
	var directions: Array[Vector2i] = [
		Vector2i(0, -1), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0)
	]

	for dir in directions:
		var neighbor: Vector2i = pos + dir
		if neighbor.x >= 0 and neighbor.x < GameConfig.GRID_WIDTH and neighbor.y >= 0 and neighbor.y < GameConfig.GRID_HEIGHT:
			if not astar.is_point_solid(neighbor):
				neighbors.append(neighbor)

	return neighbors


## Returns true if the position is on any grid boundary (edge cell).
func _is_edge_cell(pos: Vector2i) -> bool:
	return pos.x == 0 or pos.x == GameConfig.GRID_WIDTH - 1 or pos.y == 0 or pos.y == GameConfig.GRID_HEIGHT - 1
