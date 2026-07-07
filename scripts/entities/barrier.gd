## Barrier Entity
## A defensive wall structure that blocks enemy paths.
## Brute enemies can attack and destroy barriers.
extends BaseStructure


func _ready() -> void:
	structure_type = "barrier"
	max_health = GameConfig.STRUCTURES["barrier"]["max_health"]
	original_cost = GameConfig.STRUCTURES["barrier"]["cost"]
	super._ready()
