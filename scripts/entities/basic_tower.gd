## BasicTower Entity
## Standard tower with balanced range, damage, and fire rate.
## Targets the enemy closest to the core.
extends BaseTower


func _ready() -> void:
	var config: Dictionary = GameConfig.STRUCTURES["basic_tower"]
	structure_type = "basic_tower"
	max_health = config["max_health"]
	original_cost = config["cost"]
	attack_range = config["range"]
	damage = config["damage"]
	fire_rate = config["fire_rate"]
	targeting_priority = config["targeting"]
	super._ready()
