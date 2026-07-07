## AoeTower Entity
## Short-range area-of-effect tower that damages all enemies within
## its aoe_radius around the impact point.
extends BaseTower


func _ready() -> void:
	var config: Dictionary = GameConfig.STRUCTURES["aoe_tower"]
	structure_type = "aoe_tower"
	max_health = config["max_health"]
	original_cost = config["cost"]
	attack_range = config["range"]
	damage = config["damage"]
	fire_rate = config["fire_rate"]
	targeting_priority = config["targeting"]
	aoe_radius = config["aoe_radius"]
	super._ready()
