## PhaseManager
## Manages phase state machine transitions (Preparation, Combat, Game_Over).
## Replaces phase-manager.ts from the TypeScript source.
## Validates transitions, orchestrates wave start/complete, game over, and restart.
extends Node

# --- Valid Phase Transitions ---
## Defines the allowed state machine transitions between game phases.
const VALID_TRANSITIONS: Dictionary = {
	GameState.Phase.PREPARATION: [GameState.Phase.COMBAT],
	GameState.Phase.COMBAT: [GameState.Phase.PREPARATION, GameState.Phase.GAME_OVER],
	GameState.Phase.GAME_OVER: [GameState.Phase.PREPARATION],
}

# --- Exports ---
## Path to the SpawnManager node for triggering wave spawns.
@export var spawn_manager_path: NodePath = NodePath("")

## Path to the GridManager node for restart re-initialization.
@export var grid_manager_path: NodePath = NodePath("")

# --- References ---
var spawn_manager: Node = null
var grid_manager: Node = null


# --- Lifecycle ---

func _ready() -> void:
	# Resolve SpawnManager reference
	if not spawn_manager_path.is_empty():
		spawn_manager = get_node(spawn_manager_path)
	else:
		spawn_manager = get_parent().get_node_or_null("SpawnManager")

	# Resolve GridManager reference
	if not grid_manager_path.is_empty():
		grid_manager = get_node(grid_manager_path)
	else:
		grid_manager = get_parent().get_node_or_null("GridManager")

	# Connect to CombatManager wave_enemies_cleared signal if available
	var combat_manager: Node = get_parent().get_node_or_null("CombatManager")
	if combat_manager and combat_manager.has_signal("wave_enemies_cleared"):
		combat_manager.wave_enemies_cleared.connect(_on_wave_enemies_cleared)

	# Connect to GameState game_over_triggered signal for game over handling
	GameState.game_over_triggered.connect(_on_game_over_triggered)


# --- Public API ---

## Starts a new wave. Only valid during Preparation phase.
## Transitions to Combat, emits wave_started, and triggers SpawnManager.
## Returns true if the wave was started, false if not in Preparation phase.
func start_wave() -> bool:
	if GameState.phase != GameState.Phase.PREPARATION:
		return false

	GameState.set_phase(GameState.Phase.COMBAT)
	GameState.wave_started.emit(GameState.wave_number)

	if spawn_manager and spawn_manager.has_method("begin_wave"):
		spawn_manager.begin_wave(GameState.wave_number)

	return true


## Completes the current wave: awards wave bonus, increments wave number,
## transitions back to Preparation phase, and emits wave_complete signal.
func complete_wave() -> void:
	Economy.award_wave_bonus(GameState.wave_number)
	GameState.wave_number += 1
	GameState.set_phase(GameState.Phase.PREPARATION)
	GameState.wave_complete.emit(GameState.wave_number - 1)


## Triggers game over by transitioning to the Game_Over phase.
func trigger_game_over() -> void:
	GameState.set_phase(GameState.Phase.GAME_OVER)


## Restarts the game: resets all state, clears entities from the scene tree,
## re-initializes the grid and pathfinding.
func restart_game() -> void:
	# Reset all game state to initial values
	GameState.reset()

	# Clear all entity groups from the scene tree
	get_tree().call_group("enemies", "queue_free")
	get_tree().call_group("projectiles", "queue_free")
	get_tree().call_group("structures", "queue_free")

	# Re-initialize the grid and place the critical resource
	if grid_manager:
		if grid_manager.has_method("_initialize_grid"):
			grid_manager._initialize_grid()
		if grid_manager.has_method("_place_critical_resource"):
			grid_manager._place_critical_resource()
		# Clear grid_manager's structure tracking
		if "structure_nodes" in grid_manager:
			grid_manager.structure_nodes.clear()

	# Re-sync pathfinding with the fresh grid
	var pathfinding_manager: Node = get_parent().get_node_or_null("PathfindingManager")
	if pathfinding_manager:
		if pathfinding_manager.has_method("mark_dirty"):
			pathfinding_manager.mark_dirty()
		if pathfinding_manager.has_method("update_if_dirty"):
			pathfinding_manager.update_if_dirty()


# --- Signal Callbacks ---

## Called when CombatManager signals that all wave enemies are cleared.
func _on_wave_enemies_cleared() -> void:
	if GameState.phase == GameState.Phase.COMBAT:
		complete_wave()


## Called when GameState signals game_over_triggered (core health reached 0).
func _on_game_over_triggered(_wave_reached: int) -> void:
	# The phase transition is already handled by GameState.damage_core(),
	# but we can perform any additional game over logic here if needed.
	pass
