## BaseEnemy Entity
## Base class for all enemy types. Handles path-following movement,
## barrier attacks (for brutes), and damage/death logic.
class_name BaseEnemy
extends CharacterBody3D

signal died(enemy: BaseEnemy)
signal reached_core(enemy: BaseEnemy, damage: int)

@export var enemy_type: String = "basic"
@export var max_health: int = 50
@export var move_speed: float = 2.0
@export var core_damage: int = 10
@export var structure_damage: int = 0
@export var bounty: int = 5

var current_health: int
var grid_position: Vector2i = Vector2i.ZERO
var path: PackedVector2Array = PackedVector2Array()
var path_index: int = 0
var interpolation: float = 0.0
var is_attacking_barrier: bool = false
var attack_cooldown: float = 0.0


func _ready() -> void:
	current_health = max_health
	add_to_group("enemies")


func _physics_process(delta: float) -> void:
	if is_attacking_barrier:
		_update_barrier_attack(delta)
		return
	if path.is_empty() or path_index >= path.size() - 1:
		return
	_move_along_path(delta)


func take_damage(amount: int) -> void:
	current_health -= amount
	if current_health <= 0:
		current_health = 0
		died.emit(self)
		# Deferred free so signal handlers can still access global_position this frame
		call_deferred("queue_free")


func set_path(new_path: PackedVector2Array) -> void:
	path = new_path
	path_index = 0
	interpolation = 0.0


func _move_along_path(delta: float) -> void:
	interpolation += move_speed * delta

	while interpolation >= 1.0 and path_index < path.size() - 1:
		interpolation -= 1.0
		path_index += 1
		grid_position = Vector2i(path[path_index])

		if path_index >= path.size() - 1:
			reached_core.emit(self, core_damage)
			queue_free()
			return

	# Interpolate world position between current and next waypoint
	if path_index < path.size() - 1:
		var current_wp := Vector3(path[path_index].x + 0.5, 0.25, path[path_index].y + 0.5)
		var next_wp := Vector3(path[path_index + 1].x + 0.5, 0.25, path[path_index + 1].y + 0.5)
		global_position = current_wp.lerp(next_wp, min(interpolation, 1.0))


func _update_barrier_attack(delta: float) -> void:
	attack_cooldown -= delta

	if attack_cooldown <= 0.0:
		# Deal structure_damage to the barrier at the next waypoint
		if path_index < path.size() - 1:
			var barrier_pos := Vector2i(path[path_index + 1])
			var grid_manager := get_tree().get_first_node_in_group("grid_manager")
			if grid_manager and grid_manager.has_method("get_structure_at"):
				var barrier = grid_manager.get_structure_at(barrier_pos)
				if barrier and barrier.has_method("take_damage"):
					barrier.take_damage(structure_damage)
					if not is_instance_valid(barrier) or barrier.current_health <= 0:
						is_attacking_barrier = false
				else:
					# Barrier no longer exists
					is_attacking_barrier = false
			else:
				is_attacking_barrier = false
		else:
			is_attacking_barrier = false

		# Reset cooldown to 1 second (1 hit per second)
		attack_cooldown = 1.0
