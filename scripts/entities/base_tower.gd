## BaseTower Entity
## Base class for all tower types. Extends BaseStructure with combat
## capabilities: targeting, fire cooldowns, and the fired signal.
class_name BaseTower
extends BaseStructure

signal fired(tower: BaseTower, target: BaseEnemy)

@export var attack_range: float = 3.0
@export var damage: int = 15
@export var fire_rate: float = 1.5
@export var targeting_priority: String = "closest_to_core"
@export var aoe_radius: float = 0.0

var fire_cooldown: float = 0.0
var current_target: BaseEnemy = null


func _ready() -> void:
	super._ready()
	add_to_group("towers")


func update_combat(delta: float, enemies_in_range: Array) -> void:
	fire_cooldown = maxf(0.0, fire_cooldown - delta)

	if fire_cooldown > 0.0:
		return

	_validate_target(enemies_in_range)

	if current_target == null:
		current_target = _select_target(enemies_in_range)

	if current_target == null:
		return

	# Fire at current target
	fired.emit(self, current_target)
	fire_cooldown = 1.0 / fire_rate


func _validate_target(enemies_in_range: Array) -> void:
	if current_target == null:
		return
	if not is_instance_valid(current_target):
		current_target = null
		return
	if current_target.current_health <= 0:
		current_target = null
		return
	if not enemies_in_range.has(current_target):
		current_target = null


func _select_target(enemies: Array) -> BaseEnemy:
	if enemies.is_empty():
		return null

	match targeting_priority:
		"closest_to_core":
			return _get_closest_to_core(enemies)
		"highest_health":
			return _get_highest_health(enemies)

	return enemies[0]


func _get_closest_to_core(enemies: Array) -> BaseEnemy:
	var best: BaseEnemy = null
	var best_cost: float = INF

	for enemy in enemies:
		var e: BaseEnemy = enemy as BaseEnemy
		if e == null or not is_instance_valid(e):
			continue
		var remaining: float = float(e.path.size() - e.path_index)
		if remaining < best_cost:
			best_cost = remaining
			best = e

	return best


func _get_highest_health(enemies: Array) -> BaseEnemy:
	var best: BaseEnemy = null
	var best_health: int = -1

	for enemy in enemies:
		var e: BaseEnemy = enemy as BaseEnemy
		if e == null or not is_instance_valid(e):
			continue
		if e.current_health > best_health:
			best_health = e.current_health
			best = e

	return best
