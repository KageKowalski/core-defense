## SniperTower Entity
## Long-range, high-damage tower with slow fire rate.
## Targets the enemy with the highest health.
extends BaseTower


func _ready() -> void:
	var config: Dictionary = GameConfig.STRUCTURES["sniper_tower"]
	structure_type = "sniper_tower"
	max_health = config["max_health"]
	original_cost = config["cost"]
	attack_range = config["range"]
	damage = config["damage"]
	fire_rate = config["fire_rate"]
	targeting_priority = config["targeting"]
	super._ready()
