## CombatManager
## Manages tower targeting, projectile creation, damage resolution, and wave
## completion detection. Replaces combat.ts from the original TypeScript source.
## Requirements: 8.1, 8.8, 8.9, 8.10, 4.2
extends Node

# --- Signals ---
signal wave_enemies_cleared()

# --- Constants ---
const PROJECTILE_SCENE: PackedScene = preload("res://scenes/entities/projectile.tscn")
const PROJECTILE_SPEED: float = 10.0

# --- Exports ---
## Path to the container node that holds projectile instances.
@export var projectiles_container_path: NodePath = NodePath("")

## Path to the SpawnManager node for checking if spawner is still active.
@export var spawn_manager_path: NodePath = NodePath("")

# --- References ---
var _projectiles_container: Node = null
var _spawn_manager: Node = null

# --- Tracks towers whose fired signal we've already connected ---
var _connected_towers: Dictionary = {}


# --- Lifecycle ---

func _ready() -> void:
	# Resolve projectiles container reference
	if not projectiles_container_path.is_empty():
		_projectiles_container = get_node(projectiles_container_path)
	else:
		_projectiles_container = get_parent().get_node_or_null("ProjectilesContainer")

	# Resolve spawn manager reference
	if not spawn_manager_path.is_empty():
		_spawn_manager = get_node(spawn_manager_path)
	else:
		_spawn_manager = get_parent().get_node_or_null("SpawnManager")

	# Connect to GridManager.placement_succeeded to reconnect tower signals
	var grid_manager: Node = get_tree().get_first_node_in_group("grid_manager")
	if grid_manager and grid_manager.has_signal("placement_succeeded"):
		grid_manager.placement_succeeded.connect(_on_placement_succeeded)


# --- Public API ---

## Main update loop called each physics frame.
## Only processes during COMBAT phase.
func update(delta: float) -> void:
	if GameState.phase != GameState.Phase.COMBAT:
		return

	_update_towers(delta)
	_update_projectiles(delta)
	_check_wave_completion()


# --- Private Methods ---

## Updates all towers: gets enemies in range, calls tower.update_combat().
## Connects the tower's fired signal if not already connected.
func _update_towers(delta: float) -> void:
	for tower in get_tree().get_nodes_in_group("towers"):
		# Connect the fired signal if we haven't already
		if not _connected_towers.has(tower.get_instance_id()):
			if tower.has_signal("fired"):
				tower.fired.connect(_on_tower_fired)
				_connected_towers[tower.get_instance_id()] = true

		var enemies_in_range: Array = _get_enemies_in_range(tower)
		tower.update_combat(delta, enemies_in_range)


## Updates all projectile movement.
func _update_projectiles(delta: float) -> void:
	for projectile in get_tree().get_nodes_in_group("projectiles"):
		projectile.update_movement(delta)


## Returns all enemies within the tower's attack range.
## Uses Vector2 distance from tower.grid_position to enemy.grid_position.
func _get_enemies_in_range(tower) -> Array:
	var in_range: Array = []
	var tower_pos: Vector2 = Vector2(tower.grid_position)

	for enemy in get_tree().get_nodes_in_group("enemies"):
		if not is_instance_valid(enemy):
			continue
		var enemy_pos: Vector2 = Vector2(enemy.grid_position)
		var dist: float = tower_pos.distance_to(enemy_pos)
		if dist <= tower.attack_range:
			in_range.append(enemy)

	return in_range


## Called when a tower fires a projectile at a target.
## Instantiates a projectile, positions it at the tower, initializes with target/damage/aoe.
func _on_tower_fired(tower: BaseTower, target: BaseEnemy) -> void:
	if not is_instance_valid(target):
		return

	var projectile: Node3D = PROJECTILE_SCENE.instantiate()
	projectile.global_position = tower.global_position

	var is_aoe: bool = tower.aoe_radius > 0.0
	projectile.initialize(target, tower.damage, is_aoe, tower.aoe_radius)

	if _projectiles_container:
		_projectiles_container.add_child(projectile)
	else:
		add_child(projectile)


## Called when an enemy dies. Awards bounty, emits signals, decrements remaining.
func _on_enemy_died(enemy: BaseEnemy) -> void:
	# Award bounty via Economy
	var bounty: int = Economy.award_bounty(enemy.enemy_type)

	# Emit enemy_killed on GameState
	GameState.enemy_killed.emit(enemy, bounty)

	# Decrement enemies remaining
	GameState.enemies_remaining -= 1


## Called when an enemy reaches the core. Applies damage, decrements remaining.
func _on_enemy_reached_core(enemy: BaseEnemy, damage: int) -> void:
	# Damage the core via GameState
	GameState.damage_core(damage)

	# Decrement enemies remaining
	GameState.enemies_remaining -= 1

	# Emit enemy_reached_core signal
	GameState.enemy_reached_core.emit(damage)


## Checks if all enemies have been cleared and the wave is complete.
## Conditions: enemies_remaining <= 0, no enemies in group, spawner not active.
func _check_wave_completion() -> void:
	if GameState.enemies_remaining > 0:
		return

	# Check if any enemies still exist in the scene
	var enemies: Array = get_tree().get_nodes_in_group("enemies")
	if enemies.size() > 0:
		return

	# Check if the spawn manager is still actively spawning
	if _spawn_manager and "_active" in _spawn_manager and _spawn_manager._active:
		return

	# All conditions met — wave is cleared
	wave_enemies_cleared.emit()


## Connects an enemy's died and reached_core signals to this manager's handlers.
func _connect_enemy_signals(enemy: BaseEnemy) -> void:
	if not enemy.died.is_connected(_on_enemy_died):
		enemy.died.connect(_on_enemy_died)
	if not enemy.reached_core.is_connected(_on_enemy_reached_core):
		enemy.reached_core.connect(_on_enemy_reached_core)


## Called when a structure placement succeeds — reconnects tower signals
## in case a new tower was placed.
func _on_placement_succeeded(_position: Vector2i, _structure_type: String) -> void:
	# The next _update_towers call will pick up any new towers and connect
	# their fired signal, so no extra work needed here.
	pass
