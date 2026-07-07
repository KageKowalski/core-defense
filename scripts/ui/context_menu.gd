## Context Menu Script
## Shows sell/repair options when a player clicks on an existing structure.
## Displays structure name, health, sell value, and repair cost.
## Requirement 12.6: Context menu with sell value and repair cost (if damaged).
extends PanelContainer

signal sell_requested(position: Vector2i)
signal repair_requested(position: Vector2i)

var _current_position: Vector2i = Vector2i.ZERO
var _current_structure: Node = null

@onready var name_label: Label = %NameLabel
@onready var health_label: Label = %HealthLabel
@onready var sell_button: Button = %SellButton
@onready var repair_button: Button = %RepairButton
@onready var close_button: Button = %CloseButton


func _ready() -> void:
	visible = false
	sell_button.pressed.connect(_on_sell_pressed)
	repair_button.pressed.connect(_on_repair_pressed)
	close_button.pressed.connect(_on_close_pressed)


## Shows the context menu for the given structure at the specified grid position.
## Populates labels with structure info and calculates sell/repair values via Economy.
func show_for_structure(structure: Node, grid_pos: Vector2i) -> void:
	_current_structure = structure
	_current_position = grid_pos

	# Get structure info
	var structure_name: String = _get_display_name(structure)
	var current_health: int = structure.current_health
	var max_health: int = structure.max_health
	var original_cost: int = structure.original_cost

	# Update labels
	name_label.text = "Name: %s" % structure_name
	health_label.text = "Health: %d/%d" % [current_health, max_health]

	# Calculate sell value via Economy
	var sell_value := Economy.calculate_sell_value(current_health, max_health, original_cost)
	sell_button.text = "Sell: %dg" % sell_value

	# Calculate repair cost — hide repair button if at full health
	if current_health >= max_health:
		repair_button.visible = false
	else:
		var repair_cost := Economy.calculate_repair_cost(current_health, max_health, original_cost)
		repair_button.text = "Repair: %dg" % repair_cost
		repair_button.visible = true
		repair_button.disabled = not Economy.can_afford(repair_cost)

	visible = true


## Hides the context menu and clears references.
func hide_menu() -> void:
	visible = false
	_current_structure = null
	_current_position = Vector2i.ZERO


func _on_sell_pressed() -> void:
	sell_requested.emit(_current_position)
	hide_menu()


func _on_repair_pressed() -> void:
	repair_requested.emit(_current_position)
	hide_menu()


func _on_close_pressed() -> void:
	hide_menu()


## Returns a human-readable display name for the structure.
func _get_display_name(structure: Node) -> String:
	if structure.has_method("get_structure_type"):
		var stype: String = structure.get_structure_type()
		return stype.capitalize().replace("_", " ")
	# Fallback: derive from node name or class
	var node_name: String = structure.name
	return node_name.capitalize().replace("_", " ")
