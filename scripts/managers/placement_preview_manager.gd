## PlacementPreviewManager
## Manages ghost structure preview and range cell highlighting during Preparation phase.
## Displays a translucent ghost of the selected structure on hovered cells and highlights
## cells within attack range for both shop selection preview and placed structure hover.
## Requirements: 1.1, 2.1, 3.1
extends Node3D


# --- Constants ---

## Ghost preview opacity (translucent to distinguish from placed structures).
## Requirements: 1.5
const GHOST_OPACITY: float = 0.5

## Ghost material color (white with reduced alpha for translucent preview).
## Requirements: 1.5
const GHOST_COLOR_VALID := Color(1.0, 1.0, 1.0, GHOST_OPACITY)

## Color used for the range highlight overlay (soft blue with alpha).
const RANGE_COLOR := Color(0.2, 0.6, 1.0, 0.35)


# --- Exports ---

## Path to the GridManager node for cell queries and world position conversion.
@export var grid_manager_path: NodePath = NodePath("")


# --- State ---

## Current shop selection structure type (or "" if none active).
var _active_type: String = ""

## Currently hovered grid cell coordinate.
var _hovered_cell: Vector2i = Vector2i(-1, -1)

## The ghost preview node instance (translucent structure preview).
var _ghost_instance: Node3D = null

## MeshInstance3D used to render the range highlight overlay.
var _range_mesh: MeshInstance3D = null

## Material applied to the range highlight mesh.
var _range_material: StandardMaterial3D = null

## Last set of cells highlighted for range, used to avoid unnecessary rebuilds.
var _last_highlighted_cells: Array[Vector2i] = []


# --- References ---

var _grid_manager: Node3D = null


# --- Lifecycle ---

func _ready() -> void:
	# Resolve GridManager reference: exported path first, fallback to sibling lookup
	if not grid_manager_path.is_empty():
		_grid_manager = get_node(grid_manager_path)
	else:
		_grid_manager = get_parent().get_node_or_null("GridManager")

	# Create range highlight mesh infrastructure
	_range_mesh = MeshInstance3D.new()
	_range_mesh.mesh = ImmediateMesh.new()
	_range_material = _create_range_material()
	_range_mesh.material_override = _range_material
	add_child(_range_mesh)


# --- Public API ---

## Called by main.gd when shop selection changes. Instantiates a ghost preview
## of the selected structure type with transparent material applied.
## Requirements: 1.1, 1.5
func set_active_type(structure_type: String) -> void:
	_active_type = structure_type

	# Free existing ghost instance if present
	if is_instance_valid(_ghost_instance):
		_ghost_instance.queue_free()
		_ghost_instance = null

	# Instantiate scene from GridManager's structure scenes dictionary
	if not is_instance_valid(_grid_manager):
		return
	var scene: PackedScene = _grid_manager.STRUCTURE_SCENES.get(structure_type)
	if scene == null:
		return

	_ghost_instance = scene.instantiate()

	# Apply transparent material override recursively to all MeshInstance3D children
	_apply_ghost_material(_ghost_instance)

	# Disable processing so ghost doesn't execute any gameplay logic
	_ghost_instance.set_physics_process(false)
	_ghost_instance.set_process(false)

	# Add as child and start hidden (update_hover will show it on valid cells)
	add_child(_ghost_instance)
	_ghost_instance.visible = false


## Called by main.gd when the shop selection is cleared. Frees the ghost preview,
## resets active type, and clears the range highlight overlay.
## Requirements: 1.4
func clear_active_type() -> void:
	if is_instance_valid(_ghost_instance):
		_ghost_instance.queue_free()
		_ghost_instance = null

	_active_type = ""

	if is_instance_valid(_range_mesh) and _range_mesh.mesh != null:
		_range_mesh.mesh.clear_surfaces()

	_last_highlighted_cells.clear()


## Called by main.gd every _process frame with the current hovered grid cell.
## Handles ghost visibility, range highlight for shop selection, and range display
## for placed structure hover.
## Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 4.2
func update_hover(cell: Vector2i) -> void:
	_hovered_cell = cell

	if not is_instance_valid(_grid_manager):
		return

	# --- Shop selection mode (active type set) ---
	if _active_type != "":
		var ghost_visible := false

		# Validate cell: not invalid sentinel, in-bounds, and unoccupied
		if cell != Vector2i(-1, -1):
			var cell_data: Dictionary = _grid_manager.get_cell(cell)
			if not cell_data.is_empty() and cell_data["occupant"] == null:
				ghost_visible = true

		if ghost_visible:
			# Position and show ghost
			if is_instance_valid(_ghost_instance):
				_ghost_instance.position = _grid_manager.grid_to_world(cell)
				_ghost_instance.visible = true

			# Compute and show range highlight if structure has range
			var attack_range: float = get_structure_range_from_config(_active_type)
			if attack_range > 0:
				var cells_in_range: Array[Vector2i] = compute_cells_in_range(cell, attack_range)
				if cells_in_range != _last_highlighted_cells:
					_last_highlighted_cells = cells_in_range
					_rebuild_range_mesh(cells_in_range)
			else:
				# Structure has no range (e.g. barrier) — clear any existing highlight
				if not _last_highlighted_cells.is_empty():
					_last_highlighted_cells.clear()
					_rebuild_range_mesh([])
		else:
			# Hide ghost
			if is_instance_valid(_ghost_instance):
				_ghost_instance.visible = false

			# Clear range highlight
			if not _last_highlighted_cells.is_empty():
				_last_highlighted_cells.clear()
				_rebuild_range_mesh([])
		return

	# --- Placed structure hover mode (no active type) ---
	if cell == Vector2i(-1, -1):
		if not _last_highlighted_cells.is_empty():
			_last_highlighted_cells.clear()
			_rebuild_range_mesh([])
		return

	var structure: Node = _grid_manager.get_structure_at(cell)
	if structure != null:
		var placed_range: float = get_placed_structure_range(structure)
		if placed_range > 0:
			var cells_in_range: Array[Vector2i] = compute_cells_in_range(cell, placed_range)
			if cells_in_range != _last_highlighted_cells:
				_last_highlighted_cells = cells_in_range
				_rebuild_range_mesh(cells_in_range)
			return

	# No structure or range ≤ 0 — clear range mesh
	if not _last_highlighted_cells.is_empty():
		_last_highlighted_cells.clear()
		_rebuild_range_mesh([])


## Called when the game phase changes. Hides all previews if leaving Preparation phase.
## Requirements: 1.4, 2.3
func on_phase_changed(old_phase: StringName, new_phase: StringName) -> void:
	if new_phase != "PREPARATION":
		if is_instance_valid(_ghost_instance):
			_ghost_instance.visible = false
		if is_instance_valid(_range_mesh) and _range_mesh.mesh != null:
			_range_mesh.mesh.clear_surfaces()
		_hovered_cell = Vector2i(-1, -1)
		_last_highlighted_cells.clear()


# --- Pure Computation (static) ---

## Computes which grid cells fall within Euclidean distance of a source cell.
## Iterates a square bounding box of ceil(attack_range), bounds-checks each candidate
## against the grid dimensions, and includes it if its center-to-center distance
## from source is within attack_range.
## Requirements: 5.1, 5.2, 5.3
static func compute_cells_in_range(source: Vector2i, attack_range: float) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var range_int: int = int(ceil(attack_range))

	for dy in range(-range_int, range_int + 1):
		for dx in range(-range_int, range_int + 1):
			var candidate := Vector2i(source.x + dx, source.y + dy)
			# Bounds check
			if candidate.x < 0 or candidate.x >= GameConfig.GRID_WIDTH:
				continue
			if candidate.y < 0 or candidate.y >= GameConfig.GRID_HEIGHT:
				continue
			# Euclidean distance (cell centers are 1 unit apart)
			var dist := sqrt(float(dx * dx + dy * dy))
			if dist <= attack_range:
				result.append(candidate)

	return result


## Returns the attack range for a structure type from GameConfig, or -1.0 if none defined.
## Used for shop selection preview (structure not yet instantiated).
## Requirements: 2.1, 4.1
static func get_structure_range_from_config(structure_type: String) -> float:
	var config: Dictionary = GameConfig.STRUCTURES.get(structure_type, {})
	return config.get("range", -1.0)


## Returns the attack range for a placed structure instance.
## Reads the live instance property to stay in sync with combat targeting.
## Requirements: 3.1, 4.2
static func get_placed_structure_range(structure: Node3D) -> float:
	if structure is BaseTower:
		return structure.attack_range
	return -1.0


# --- Private Helpers ---

## Creates the material used for the range highlight overlay.
## Unshaded, alpha-blended, double-sided so it's visible from any camera angle.
func _create_range_material() -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = RANGE_COLOR
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	return mat


## Rebuilds the range highlight mesh from a set of grid cells.
## Clears any existing surface, then draws two triangles per cell forming quads at y=0.015.
## Requirements: 2.1, 2.2, 3.1
func _rebuild_range_mesh(cells: Array[Vector2i]) -> void:
	var mesh: ImmediateMesh = _range_mesh.mesh as ImmediateMesh
	mesh.clear_surfaces()

	if cells.is_empty():
		return

	mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for cell in cells:
		var x0: float = float(cell.x)
		var z0: float = float(cell.y)
		var x1: float = x0 + 1.0
		var z1: float = z0 + 1.0
		var y: float = 0.015

		# First triangle
		mesh.surface_add_vertex(Vector3(x0, y, z0))
		mesh.surface_add_vertex(Vector3(x1, y, z0))
		mesh.surface_add_vertex(Vector3(x1, y, z1))

		# Second triangle
		mesh.surface_add_vertex(Vector3(x0, y, z0))
		mesh.surface_add_vertex(Vector3(x1, y, z1))
		mesh.surface_add_vertex(Vector3(x0, y, z1))
	mesh.surface_end()


## Applies a translucent unshaded material override recursively to all MeshInstance3D
## children of the given node. Used to make the ghost preview visually distinct.
## Requirements: 1.5
func _apply_ghost_material(node: Node3D) -> void:
	for child in node.get_children():
		if child is MeshInstance3D:
			var mat := StandardMaterial3D.new()
			mat.albedo_color = GHOST_COLOR_VALID
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			child.material_override = mat
		if child is Node3D:
			_apply_ghost_material(child)
