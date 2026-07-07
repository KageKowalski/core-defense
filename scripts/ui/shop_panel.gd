## Shop Panel Script
## Displays structure purchase buttons during Preparation phase.
## Handles unlock progression, affordability checks, and structure selection.
extends PanelContainer

signal structure_selected(structure_type: String)
signal selection_cleared()

var selected_type: String = ""

@onready var barrier_button: Button = %BarrierButton
@onready var basic_tower_button: Button = %BasicTowerButton
@onready var sniper_tower_button: Button = %SniperTowerButton
@onready var aoe_tower_button: Button = %AoeTowerButton


func _ready() -> void:
	GameState.gold_changed.connect(_on_gold_changed)
	GameState.phase_changed.connect(_on_phase_changed)

	barrier_button.pressed.connect(_on_button_pressed.bind("barrier"))
	basic_tower_button.pressed.connect(_on_button_pressed.bind("basic_tower"))
	sniper_tower_button.pressed.connect(_on_button_pressed.bind("sniper_tower"))
	aoe_tower_button.pressed.connect(_on_button_pressed.bind("aoe_tower"))

	update_shop()
	_update_visibility()


func update_shop() -> void:
	var current_gold := GameState.gold
	var wave := GameState.wave_number

	# Unlock progression: wave 1 → Barrier + Basic Tower; wave 2 → +Sniper; wave 3 → +AOE
	barrier_button.visible = wave >= 1
	basic_tower_button.visible = wave >= 1
	sniper_tower_button.visible = wave >= 2
	aoe_tower_button.visible = wave >= 3

	# Gray out unaffordable items
	barrier_button.disabled = current_gold < GameConfig.STRUCTURES["barrier"]["cost"]
	basic_tower_button.disabled = current_gold < GameConfig.STRUCTURES["basic_tower"]["cost"]
	sniper_tower_button.disabled = current_gold < GameConfig.STRUCTURES["sniper_tower"]["cost"]
	aoe_tower_button.disabled = current_gold < GameConfig.STRUCTURES["aoe_tower"]["cost"]

	# Highlight the currently selected button
	_update_button_highlight()


func _on_button_pressed(structure_type: String) -> void:
	if selected_type == structure_type:
		# Deselect if already selected
		selected_type = ""
		selection_cleared.emit()
	else:
		selected_type = structure_type
		structure_selected.emit(structure_type)
	_update_button_highlight()


func _on_gold_changed(_new_amount: int) -> void:
	update_shop()


func _on_phase_changed(_old_phase: StringName, _new_phase: StringName) -> void:
	_update_visibility()
	# Clear selection on phase change
	if selected_type != "":
		selected_type = ""
		selection_cleared.emit()
		_update_button_highlight()
	update_shop()


func _update_visibility() -> void:
	visible = GameState.phase == GameState.Phase.PREPARATION


func _update_button_highlight() -> void:
	# Reset all button styles (flat = not highlighted)
	barrier_button.button_pressed = (selected_type == "barrier")
	basic_tower_button.button_pressed = (selected_type == "basic_tower")
	sniper_tower_button.button_pressed = (selected_type == "sniper_tower")
	aoe_tower_button.button_pressed = (selected_type == "aoe_tower")
