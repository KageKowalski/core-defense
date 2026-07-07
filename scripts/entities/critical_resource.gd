## CriticalResource Entity
## The 2x2 core at the center of the grid that enemies target.
## Occupies cells (9,9), (10,9), (9,10), (10,10) on the 20x20 grid.
extends Node3D

var max_health: int = GameConfig.CRITICAL_RESOURCE["max_health"]
var current_health: int
var cells: Array[Vector2i] = []


func _ready() -> void:
	current_health = max_health
	# Populate the 4 center cells of the 20x20 grid
	cells = [
		Vector2i(9, 9),
		Vector2i(10, 9),
		Vector2i(9, 10),
		Vector2i(10, 10),
	]
	# Connect to GameState core_damaged signal for visual feedback
	GameState.core_damaged.connect(_on_core_damaged)


func _on_core_damaged(current_hp: int, max_hp: int) -> void:
	current_health = current_hp
	_update_visual_feedback()


func _update_visual_feedback() -> void:
	# Lerp mesh color from gold to red based on damage taken
	var health_ratio: float = float(current_health) / float(max_health)
	var mesh_instance := get_node_or_null("MeshInstance3D") as MeshInstance3D
	if mesh_instance == null:
		return
	var material := mesh_instance.get_surface_override_material(0) as StandardMaterial3D
	if material == null:
		material = mesh_instance.mesh.surface_get_material(0) as StandardMaterial3D
		if material == null:
			return
		# Duplicate so we don't modify the shared resource
		material = material.duplicate() as StandardMaterial3D
		mesh_instance.set_surface_override_material(0, material)
	# Gold (1.0, 0.84, 0.0) at full health -> Red (1.0, 0.2, 0.0) at zero
	var gold_color := Color(1.0, 0.84, 0.0)
	var damaged_color := Color(1.0, 0.2, 0.0)
	material.albedo_color = gold_color.lerp(damaged_color, 1.0 - health_ratio)
