## BaseStructure
## Base class for all placeable structures (barriers and towers).
## Provides health, damage handling, and destroyed signal.
class_name BaseStructure
extends Node3D

signal destroyed(structure: BaseStructure)

@export var structure_type: String = ""
@export var max_health: int = 100
@export var original_cost: int = 0

var current_health: int
var grid_position: Vector2i = Vector2i.ZERO


func _ready() -> void:
	current_health = max_health
	add_to_group("structures")


func take_damage(amount: int) -> void:
	current_health -= amount
	if current_health <= 0:
		current_health = 0
		destroyed.emit(self)
