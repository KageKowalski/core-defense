## GameState Autoload
## Central mutable state authority. Replaces state.ts.
## Holds all game state and emits signals on every mutation for UI/VFX reactivity.
extends Node

# --- Signals ---
# These signals are emitted by external systems (Economy, CombatManager, PhaseManager, GridManager)
# that mutate GameState and notify listeners. Suppress UNUSED_SIGNAL warnings.
signal phase_changed(old_phase: StringName, new_phase: StringName)
@warning_ignore("unused_signal")
signal gold_changed(new_amount: int)
signal core_damaged(current_health: int, max_health: int)
signal game_over_triggered(wave_reached: int)
@warning_ignore("unused_signal")
signal wave_started(wave_number: int)
@warning_ignore("unused_signal")
signal enemy_killed(enemy_node: Node, bounty: int)
@warning_ignore("unused_signal")
signal enemy_reached_core(damage: int)
@warning_ignore("unused_signal")
signal structure_placed(structure_node: Node)
@warning_ignore("unused_signal")
signal structure_sold(position: Vector2i, refund: int)
@warning_ignore("unused_signal")
signal structure_destroyed(position: Vector2i)
@warning_ignore("unused_signal")
signal wave_complete(wave_number: int)

# --- Phase Enum ---
enum Phase { PREPARATION, COMBAT, GAME_OVER }

# --- State Variables ---
var phase: Phase = Phase.PREPARATION
var gold: int = GameConfig.STARTING_GOLD
var wave_number: int = 1
var core_health: int = GameConfig.CRITICAL_RESOURCE["max_health"]
var core_max_health: int = GameConfig.CRITICAL_RESOURCE["max_health"]
var enemies_remaining: int = 0

# --- Methods ---

## Transitions to a new phase and emits phase_changed with old and new phase names.
func set_phase(new_phase: Phase) -> void:
	var old := phase
	phase = new_phase
	phase_changed.emit(Phase.keys()[old], Phase.keys()[new_phase])


## Applies damage to the core, clamping health to 0 minimum.
## Emits core_damaged, and triggers game_over if health reaches 0.
func damage_core(amount: int) -> void:
	core_health = max(0, core_health - amount)
	core_damaged.emit(core_health, core_max_health)
	if core_health <= 0:
		set_phase(Phase.GAME_OVER)
		game_over_triggered.emit(wave_number)


## Resets all state to initial values for a new game.
func reset() -> void:
	phase = Phase.PREPARATION
	gold = GameConfig.STARTING_GOLD
	wave_number = 1
	core_health = GameConfig.CRITICAL_RESOURCE["max_health"]
	core_max_health = GameConfig.CRITICAL_RESOURCE["max_health"]
	enemies_remaining = 0
