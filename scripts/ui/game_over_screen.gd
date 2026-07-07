## Game Over Screen Script
## Displays a semi-transparent overlay when the core is destroyed.
## Shows the wave reached and provides a restart button.
extends Control

signal restart_requested()

@onready var wave_reached_label: Label = %WaveReachedLabel
@onready var restart_button: Button = %RestartButton


func _ready() -> void:
	hide()
	GameState.game_over_triggered.connect(_on_game_over)
	restart_button.pressed.connect(_on_restart_pressed)


func _on_game_over(wave_reached: int) -> void:
	wave_reached_label.text = "Wave Reached: %d" % wave_reached
	show()


func _on_restart_pressed() -> void:
	restart_requested.emit()
	hide()
