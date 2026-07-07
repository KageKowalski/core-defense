## SpawnManager
## Manages wave composition, staggered enemy spawning, and edge selection.
## Replaces spawning.ts from the TypeScript source.
## Calculates wave composition, builds a spawn queue with evenly distributed brutes,
## selects random spawn edges, and spawns enemies at configurable intervals.
extends Node

# --- Constants ---
const ENEMY_SCENES: Dictionary = {
	"basic": preload("res://scenes/entities/basic_enemy.tscn"),
	"brute": preload("res://scenes/entities/brute_enemy.tscn"),
}

# --- State ---
var _spawn_queue: Array[String] = []
var _spawn_edges: Array[String] = []
var _spawn_index: int = 0
var _spawn_timer: float = 0.0
var _spawn_interval: float = 2.0
var _active: bool = false

# --- References ---
@export var pathfinding_manager_path: NodePath = NodePath("")
@export var enemies_container_path: NodePath = NodePath("")

var _pathfinding_manager: Node = null
var _enemies_container: Node = null


# --- Lifecycle ---

func _ready() -> void:
	# Resolve PathfindingManager reference
	if not pathfinding_manager_path.is_empty():
		_pathfinding_manager = get_node(pathfinding_manager_path)
	else:
		_pathfinding_manager = get_parent().get_node_or_null("PathfindingManager")

	# Resolve EnemiesContainer reference
	if not enemies_container_path.is_empty():
		_enemies_container = get_node(enemies_container_path)
	else:
		_enemies_container = get_parent().get_node_or_null("EnemiesContainer")


# --- Public API ---

## Begins spawning for a new wave. Calculates composition, builds queue,
## selects spawn edges, and activates the spawner.
func begin_wave(wave_number: int) -> void:
	var composition := _get_wave_composition(wave_number)
	_spawn_queue = _build_spawn_queue(composition)
	_spawn_edges = _select_spawn_edges()
	_spawn_index = 0
	_spawn_timer = 0.0
	_spawn_interval = composition["interval"]
	_active = true
	GameState.enemies_remaining = composition["total"]


## Called each physics frame. Advances the spawn timer and spawns enemies
## when the interval elapses, until the queue is exhausted.
func update(delta: float) -> void:
	if not _active:
		return

	_spawn_timer += delta

	while _spawn_timer >= _spawn_interval and _spawn_index < _spawn_queue.size():
		_spawn_timer -= _spawn_interval
		_spawn_enemy()

	# Deactivate once all enemies are spawned
	if _spawn_index >= _spawn_queue.size():
		_active = false


## Returns whether the spawner is currently active (still spawning enemies).
func is_active() -> bool:
	return _active


## Returns the number of enemies still waiting to be spawned from the queue.
func get_enemies_remaining_to_spawn() -> int:
	if _spawn_queue.is_empty():
		return 0
	return _spawn_queue.size() - _spawn_index


## Resets all spawn state for a new game or between waves.
func reset() -> void:
	_spawn_queue.clear()
	_spawn_edges.clear()
	_spawn_index = 0
	_spawn_timer = 0.0
	_spawn_interval = 2.0
	_active = false


# --- Internal Helpers ---

## Calculates wave composition for the given wave number.
## total = 5 + (N-1)*2, brute = max(0, N-3), basic = total - brute
## interval = clamp(2.0 - N*0.1, 0.3, 2.0)
func _get_wave_composition(wave_number: int) -> Dictionary:
	var total: int = GameConfig.SPAWN["base_enemy_count"] + (wave_number - 1) * GameConfig.SPAWN["enemy_count_increment"]
	var brute_count: int = maxi(0, wave_number - GameConfig.SPAWN["brute_start_wave"] + 1)
	var basic_count: int = total - brute_count
	var interval: float = clampf(
		2.0 - wave_number * 0.1,
		GameConfig.SPAWN["min_interval"],
		GameConfig.SPAWN["max_interval"]
	)
	return {
		"basic": basic_count,
		"brute": brute_count,
		"total": total,
		"interval": interval,
	}


## Builds the spawn queue from composition, distributing brutes evenly.
func _build_spawn_queue(composition: Dictionary) -> Array[String]:
	var queue: Array[String] = []
	var basic_count: int = composition["basic"]
	var brute_count: int = composition["brute"]
	var total_count: int = composition["total"]

	# If no brutes, fill with basics
	if brute_count == 0:
		for i in range(basic_count):
			queue.append("basic")
		return queue

	# Distribute brutes evenly throughout the queue
	var brute_interval: int = total_count / (brute_count + 1)
	var next_brute_pos: int = brute_interval
	var brutes_placed: int = 0

	for i in range(total_count):
		if brutes_placed < brute_count and i == next_brute_pos:
			queue.append("brute")
			brutes_placed += 1
			next_brute_pos += brute_interval
		else:
			queue.append("basic")

	# Ensure all brutes are placed (handle rounding edge cases)
	var actual_brute_count := queue.count("brute")
	while actual_brute_count < brute_count:
		# Replace the last basic with a brute
		var last_basic_idx := queue.rfind("basic")
		if last_basic_idx >= 0:
			queue[last_basic_idx] = "brute"
		actual_brute_count += 1

	return queue


## Selects 2-4 random edges for spawning this wave.
func _select_spawn_edges() -> Array[String]:
	var all_edges: Array[String] = ["top", "bottom", "left", "right"]
	all_edges.shuffle()
	var count: int = randi_range(2, 4)
	var selected: Array[String] = []
	for i in range(count):
		selected.append(all_edges[i])
	return selected


## Returns a random grid position on the specified edge.
func _get_spawn_position(edge: String) -> Vector2i:
	match edge:
		"top":
			return Vector2i(randi_range(0, GameConfig.GRID_WIDTH - 1), 0)
		"bottom":
			return Vector2i(randi_range(0, GameConfig.GRID_WIDTH - 1), GameConfig.GRID_HEIGHT - 1)
		"left":
			return Vector2i(0, randi_range(0, GameConfig.GRID_HEIGHT - 1))
		"right":
			return Vector2i(GameConfig.GRID_WIDTH - 1, randi_range(0, GameConfig.GRID_HEIGHT - 1))
	return Vector2i.ZERO


## Spawns a single enemy from the queue at the current index.
## Gets the enemy type, selects an edge, finds a valid spawn position with
## pathfinding, instantiates the scene, assigns the path, and adds to container.
func _spawn_enemy() -> void:
	if _spawn_index >= _spawn_queue.size():
		return

	var enemy_type: String = _spawn_queue[_spawn_index]
	var edge: String = _spawn_edges[_spawn_index % _spawn_edges.size()]
	var position: Vector2i = _get_spawn_position(edge)

	# Try to find a path from this position
	var path: PackedVector2Array = PackedVector2Array()
	if _pathfinding_manager and _pathfinding_manager.has_method("find_path_to_core"):
		path = _pathfinding_manager.find_path_to_core(position)

	# If pathfinding fails, try alternative positions
	if path.is_empty():
		var alt_result := _try_alternative_spawn_positions(edge)
		if alt_result.size() > 0:
			path = alt_result
			# Update position to the start of the found path
			position = Vector2i(path[0])

	# Instantiate the enemy scene
	if ENEMY_SCENES.has(enemy_type):
		var enemy_scene: PackedScene = ENEMY_SCENES[enemy_type]
		var enemy_instance: Node = enemy_scene.instantiate()

		# Set enemy grid position
		if "grid_position" in enemy_instance:
			enemy_instance.grid_position = position

		# Assign path before adding to tree (doesn't require tree access)
		if enemy_instance.has_method("set_path") and not path.is_empty():
			enemy_instance.set_path(path)

		# Add to tree FIRST, then set global_position (requires being in tree)
		if _enemies_container:
			_enemies_container.add_child(enemy_instance)
		else:
			add_child(enemy_instance)

		if enemy_instance is Node3D:
			enemy_instance.global_position = Vector3(
				position.x + 0.5, 0.25, position.y + 0.5
			)

	_spawn_index += 1


## Tries alternative spawn positions on other edges when pathfinding fails
## from the initial edge. Tries up to 5 positions per alternative edge.
func _try_alternative_spawn_positions(failed_edge: String) -> PackedVector2Array:
	var all_edges: Array[String] = ["top", "bottom", "left", "right"]
	var other_edges: Array[String] = []
	for e in all_edges:
		if e != failed_edge:
			other_edges.append(e)

	for edge in other_edges:
		for attempt in range(5):
			var pos := _get_spawn_position(edge)
			if _pathfinding_manager and _pathfinding_manager.has_method("find_path_to_core"):
				var path: PackedVector2Array = _pathfinding_manager.find_path_to_core(pos)
				if not path.is_empty():
					return path

	return PackedVector2Array()
