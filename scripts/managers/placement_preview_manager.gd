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
