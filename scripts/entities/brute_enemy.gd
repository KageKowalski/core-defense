## BruteEnemy Entity
## Heavy enemy type with high health and core damage but slow speed.
## Can attack and destroy barriers (structure_damage = 25).
extends BaseEnemy


func _ready() -> void:
	enemy_type = "brute"
	max_health = GameConfig.ENEMIES["brute"]["health"]
	move_speed = GameConfig.ENEMIES["brute"]["speed"]
	core_damage = GameConfig.ENEMIES["brute"]["damage"]
	structure_damage = GameConfig.ENEMIES["brute"]["structure_damage"]
	bounty = GameConfig.ENEMIES["brute"]["bounty"]
	super._ready()
