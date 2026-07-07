## Projectile Entity
## Tracks and moves toward a target enemy, dealing damage on impact.
## Supports both single-target and AOE (area of effect) damage.
extends Node3D

signal hit(projectile: Node3D, target: BaseEnemy)
signal aoe_hit(projectile: Node3D, position: Vector3, radius: float, damage: int)

var target: BaseEnemy = null
var damage: int = 0
var speed: float = 10.0
var is_aoe: bool = false
var aoe_radius: float = 0.0


func initialize(p_target: BaseEnemy, p_damage: int, p_is_aoe: bool, p_aoe_radius: float) -> void:
	target = p_target
	damage = p_damage
	is_aoe = p_is_aoe
	aoe_radius = p_aoe_radius
	add_to_group("projectiles")


func update_movement(delta: float) -> void:
	# Dissipate if target no longer exists
	if not is_instance_valid(target):
		queue_free()
		return

	# Move toward target position
	var target_pos: Vector3 = target.global_position
	var direction: Vector3 = (target_pos - global_position).normalized()
	global_position += direction * speed * delta

	# Check if we hit the target (distance threshold)
	if global_position.distance_to(target_pos) < 0.2:
		_apply_damage()
		queue_free()


func _apply_damage() -> void:
	if is_aoe:
		var impact_pos: Vector3 = global_position
		var enemies: Array = get_tree().get_nodes_in_group("enemies")
		for enemy in enemies:
			if is_instance_valid(enemy) and enemy is BaseEnemy:
				if impact_pos.distance_to(enemy.global_position) <= aoe_radius:
					enemy.take_damage(damage)
		aoe_hit.emit(self, impact_pos, aoe_radius, damage)
	else:
		if is_instance_valid(target):
			target.take_damage(damage)
		hit.emit(self, target)
