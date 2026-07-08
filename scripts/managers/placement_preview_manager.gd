## PlacementPreviewManager
## Manages ghost structure preview and range cell highlighting during Preparation phase.
## Displays a translucent ghost of the selected structure on hovered cells and highlights
## cells within attack range for both shop selection preview and placed structure hover.
## Requirements: 1.1, 2.1, 3.1
extends Node3D


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
