## HUD Script
## Displays gold, wave info, enemies remaining, and core health.
## Connects to GameState signals for reactive updates.
extends CanvasLayer

@onready var gold_label: Label = %GoldLabel
@onready var wave_label: Label = %WaveLabel
@onready var enemies_label: Label = %EnemiesLabel
@onready var core_health_bar: ProgressBar = %CoreHealthBar

func _ready() -> void:
	GameState.gold_changed.connect(_on_gold_changed)
	GameState.core_damaged.connect(_on_core_damaged)
	GameState.phase_changed.connect(_on_phase_changed)
	GameState.wave_started.connect(_on_wave_started)

	# Initialize display with current values
	_on_gold_changed(GameState.gold)
	_update_core_health_bar(GameState.core_health, GameState.core_max_health)
	_update_wave_info_visibility()
	wave_label.text = "Wave: %d" % GameState.wave_number
	enemies_label.text = "Enemies: %d" % GameState.enemies_remaining


func _process(_delta: float) -> void:
	# Update enemies remaining each frame during combat since it changes frequently
	if GameState.phase == GameState.Phase.COMBAT:
		enemies_label.text = "Enemies: %d" % GameState.enemies_remaining


func _on_gold_changed(new_amount: int) -> void:
	gold_label.text = "Gold: %d" % new_amount


func _on_core_damaged(current_health: int, max_health: int) -> void:
	_update_core_health_bar(current_health, max_health)


func _on_phase_changed(_old_phase: StringName, _new_phase: StringName) -> void:
	_update_wave_info_visibility()


func _on_wave_started(wave_number: int) -> void:
	wave_label.text = "Wave: %d" % wave_number
	enemies_label.text = "Enemies: %d" % GameState.enemies_remaining


func _update_core_health_bar(current_health: int, max_health: int) -> void:
	if max_health > 0:
		core_health_bar.value = float(current_health) / float(max_health) * 100.0
	else:
		core_health_bar.value = 0.0


func _update_wave_info_visibility() -> void:
	var in_combat := GameState.phase == GameState.Phase.COMBAT
	wave_label.visible = in_combat
	enemies_label.visible = in_combat
