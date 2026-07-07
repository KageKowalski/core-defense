## Start Wave Button Script
## Displays a "Start Wave" button during the Preparation phase.
## Emits start_wave_pressed when clicked so PhaseManager can begin combat.
extends Button

signal start_wave_pressed()


func _ready() -> void:
	pressed.connect(_on_pressed)
	GameState.phase_changed.connect(_on_phase_changed)
	# Game starts in PREPARATION phase, so button should be visible initially
	visible = true


func _on_pressed() -> void:
	start_wave_pressed.emit()


func _on_phase_changed(_old_phase: StringName, new_phase: StringName) -> void:
	visible = (new_phase == "PREPARATION")
