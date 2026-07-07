## VFXManager
## Manages floating damage text, destruction particles, and invalid placement indicators.
## Replaces vfx.ts from the original TypeScript source.
extends Node3D


# --- Public API ---

## Spawns floating text at the given world position.
## Text rises upward and fades over 1 second before auto-freeing.
func spawn_floating_text(world_pos: Vector3, text: String, color: Color) -> void:
	var label := Label3D.new()
	label.text = text
	label.modulate = color
	label.font_size = 32
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.global_position = world_pos + Vector3(0, 1.5, 0)
	add_child(label)

	# Tween upward movement + fade out
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "global_position", label.global_position + Vector3(0, 1.0, 0), 1.0)
	tween.tween_property(label, "modulate:a", 0.0, 1.0)
	tween.set_parallel(false)
	tween.tween_callback(label.queue_free)


## Spawns a destruction particle burst at the given world position.
## 8-12 orange cubes, one-shot burst, 0.5s lifetime.
func spawn_destruction_effect(world_pos: Vector3) -> void:
	var particles := GPUParticles3D.new()
	particles.global_position = world_pos
	particles.emitting = true
	particles.one_shot = true
	particles.amount = 10
	particles.lifetime = 0.5
	particles.explosiveness = 1.0

	# Create process material for the burst
	var material := ParticleProcessMaterial.new()
	material.direction = Vector3(0, 1, 0)
	material.spread = 180.0
	material.initial_velocity_min = 3.0
	material.initial_velocity_max = 6.0
	material.gravity = Vector3(0, -9.8, 0)
	material.color = Color(1.0, 0.5, 0.1)
	particles.process_material = material

	# Create a small box mesh for the particles
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.1, 0.1, 0.1)
	particles.draw_pass_1 = mesh

	add_child(particles)

	# Auto-free after lifetime
	get_tree().create_timer(0.6).timeout.connect(particles.queue_free)


## Spawns an invalid placement indicator (red flash) at the given grid position.
## A red semi-transparent PlaneMesh that fades over 1 second.
func spawn_invalid_placement(grid_pos: Vector2i) -> void:
	var indicator := MeshInstance3D.new()
	var plane_mesh := PlaneMesh.new()
	plane_mesh.size = Vector2(1.0, 1.0)
	indicator.mesh = plane_mesh

	var material := StandardMaterial3D.new()
	material.albedo_color = Color(1, 0, 0, 0.5)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	indicator.material_override = material

	indicator.global_position = Vector3(grid_pos.x + 0.5, 0.02, grid_pos.y + 0.5)
	add_child(indicator)

	# Tween fade out
	var tween := create_tween()
	tween.tween_property(material, "albedo_color:a", 0.0, 1.0)
	tween.tween_callback(indicator.queue_free)
