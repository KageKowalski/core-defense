## Main Scene Script
## Root script for the Core Defense game. Handles input, physics pipeline,
## signal wiring between managers/UI, and grid overlay rendering.
## Requirements: 13.2, 13.3, 13.8, 14.1, 14.2, 14.3, 14.4, 16.2, 16.4, 16.6, 9.5
extends Node3D

# --- Manager References ---
@onready var grid_manager: Node3D = $GridManager
@onready var pathfinding_manager: Node = $PathfindingManager
@onready var spawn_manager: Node = $SpawnManager
@onready var combat_manager: Node = $CombatManager
@onready var phase_manager: Node = $PhaseManager
@onready var vfx_manager: Node3D = $VFXManager
@onready var game_camera: Camera3D = $GameCamera

# --- Container References ---
@onready var enemies_container: Node3D = $EnemiesContainer
@onready var projectiles_container: Node3D = $ProjectilesContainer

# --- UI References ---
@onready var hud: Node = $UILayer/HUD
@onready var shop_panel: PanelContainer = $UILayer/ShopPanel
@onready var context_menu: PanelContainer = $UILayer/ContextMenu
@onready var game_over_screen: Control = $UILayer/GameOverScreen
@onready var start_wave_button: Button = $UILayer/StartWaveButton

# --- Grid Overlay ---
@onready var grid_overlay: Node3D = $GridOverlay

# --- State ---
var _selected_structure_type: String = ""


# --- Lifecycle ---

func _ready() -> void:
	_wire_signals()
	_generate_grid_overlay()

	# Connect phase_changed to control grid overlay visibility
	GameState.phase_changed.connect(_on_phase_changed)

	# Connect VFX triggers
	GameState.enemy_killed.connect(_on_enemy_killed_vfx)
	GameState.structure_destroyed.connect(_on_structure_destroyed_vfx)
	grid_manager.placement_failed.connect(_on_placement_failed_vfx)


func _physics_process(delta: float) -> void:
	# Main game loop pipeline: spawn → pathfind → combat
	spawn_manager.update(delta)
	pathfinding_manager.update_if_dirty()
	combat_manager.update(delta)

	# Connect signals for any newly spawned enemies
	_connect_new_enemy_signals()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			var grid_pos := _screen_to_grid(event.position)
			if grid_pos != Vector2i(-1, -1):
				_handle_left_click(grid_pos)
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			_clear_selection()

	elif event is InputEventKey and event.pressed:
		if event.keycode == KEY_ESCAPE:
			_clear_selection()


# --- Signal Wiring ---

func _wire_signals() -> void:
	# GridManager signals
	grid_manager.placement_succeeded.connect(_on_placement_succeeded)

	# UI → Manager wiring
	start_wave_button.start_wave_pressed.connect(phase_manager.start_wave)
	game_over_screen.restart_requested.connect(_on_restart_requested)
	shop_panel.structure_selected.connect(_on_structure_selected)
	shop_panel.selection_cleared.connect(_on_selection_cleared)
	context_menu.sell_requested.connect(_on_sell_requested)
	context_menu.repair_requested.connect(_on_repair_requested)


# --- Input Handling ---

## Converts a screen position to grid coordinates via Y=0 plane intersection.
## Returns Vector2i(-1, -1) if the position is out of bounds or invalid.
func _screen_to_grid(screen_pos: Vector2) -> Vector2i:
	var camera := get_viewport().get_camera_3d()
	if not camera:
		return Vector2i(-1, -1)

	var from := camera.project_ray_origin(screen_pos)
	var dir := camera.project_ray_normal(screen_pos)

	# Intersect with Y=0 plane
	if dir.y == 0:
		return Vector2i(-1, -1)

	var t := -from.y / dir.y
	if t < 0:
		return Vector2i(-1, -1)

	var hit := from + dir * t
	var col := int(floor(hit.x))
	var row := int(floor(hit.z))

	# Bounds check
	if col >= 0 and col < GameConfig.GRID_WIDTH and row >= 0 and row < GameConfig.GRID_HEIGHT:
		return Vector2i(col, row)

	return Vector2i(-1, -1)


func _handle_left_click(grid_pos: Vector2i) -> void:
	# Only handle placement/interaction during Preparation phase
	if GameState.phase != GameState.Phase.PREPARATION:
		return

	# If we have a shop selection, try to place
	if _selected_structure_type != "":
		grid_manager.try_place_structure(grid_pos, _selected_structure_type)
		return

	# If cell has an existing structure and no shop selection, show context menu
	var structure: Node = grid_manager.get_structure_at(grid_pos)
	if structure:
		context_menu.show_for_structure(structure, grid_pos)


func _clear_selection() -> void:
	_selected_structure_type = ""
	context_menu.hide_menu()


# --- Signal Callbacks ---

func _on_structure_selected(structure_type: String) -> void:
	_selected_structure_type = structure_type
	context_menu.hide_menu()


func _on_selection_cleared() -> void:
	_selected_structure_type = ""


func _on_placement_succeeded(_position: Vector2i, _structure_type: String) -> void:
	# Pathfinding is already marked dirty by GridManager itself
	pass


func _on_sell_requested(pos: Vector2i) -> void:
	grid_manager.sell_structure(pos)


func _on_repair_requested(pos: Vector2i) -> void:
	grid_manager.repair_structure(pos)


func _on_restart_requested() -> void:
	phase_manager.restart_game()
	# Re-generate grid overlay after restart
	_generate_grid_overlay()


func _on_phase_changed(_old_phase: StringName, new_phase: StringName) -> void:
	# Show grid overlay only during Preparation
	if grid_overlay:
		grid_overlay.visible = (new_phase == "PREPARATION")


func _on_enemy_killed_vfx(enemy: Node, bounty: int) -> void:
	if is_instance_valid(enemy) and enemy is Node3D and enemy.is_inside_tree():
		vfx_manager.spawn_floating_text(
			enemy.global_position,
			"+%d" % bounty,
			Color(1, 0.84, 0)  # Gold color
		)


func _on_structure_destroyed_vfx(position: Vector2i) -> void:
	var world_pos := Vector3(position.x + 0.5, 0, position.y + 0.5)
	vfx_manager.spawn_destruction_effect(world_pos)


func _on_placement_failed_vfx(position: Vector2i, _reason: String) -> void:
	vfx_manager.spawn_invalid_placement(position)


# --- Enemy Signal Connection ---

## Connects died/reached_core signals for any new enemies that haven't been connected yet.
func _connect_new_enemy_signals() -> void:
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if is_instance_valid(enemy) and enemy.has_signal("died"):
			if not enemy.died.is_connected(combat_manager._on_enemy_died):
				combat_manager._connect_enemy_signals(enemy)


# --- Grid Overlay ---

## Generates the grid overlay lines showing cell boundaries.
## White semi-transparent lines drawn as an ImmediateMesh.
func _generate_grid_overlay() -> void:
	# Remove any existing mesh children
	for child in grid_overlay.get_children():
		child.queue_free()

	var mesh_instance := MeshInstance3D.new()
	var imm_mesh := ImmediateMesh.new()
	mesh_instance.mesh = imm_mesh

	# Create a material for the grid lines
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(1, 1, 1, 0.3)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh_instance.material_override = material

	# Draw horizontal lines (along X axis)
	imm_mesh.surface_begin(Mesh.PRIMITIVE_LINES)
	for row in range(GameConfig.GRID_HEIGHT + 1):
		imm_mesh.surface_add_vertex(Vector3(0, 0.01, row))
		imm_mesh.surface_add_vertex(Vector3(GameConfig.GRID_WIDTH, 0.01, row))

	# Draw vertical lines (along Z axis)
	for col in range(GameConfig.GRID_WIDTH + 1):
		imm_mesh.surface_add_vertex(Vector3(col, 0.01, 0))
		imm_mesh.surface_add_vertex(Vector3(col, 0.01, GameConfig.GRID_HEIGHT))
	imm_mesh.surface_end()

	grid_overlay.add_child(mesh_instance)
