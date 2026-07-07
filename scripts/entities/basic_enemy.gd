## BasicEnemy Entity
## Standard enemy type with moderate health, speed, and core damage.
## Does not attack barriers (structure_damage = 0).
extends BaseEnemy


func _ready() -> void:
	enemy_type = "basic"
	max_health = GameConfig.ENEMIES["basic"]["health"]
	move_speed = GameConfig.ENEMIES["basic"]["speed"]
	core_damage = GameConfig.ENEMIES["basic"]["damage"]
	structure_damage = GameConfig.ENEMIES["basic"]["structure_damage"]
	bounty = GameConfig.ENEMIES["basic"]["bounty"]
	super._ready()
