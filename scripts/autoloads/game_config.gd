## GameConfig Autoload
## Centralized balance data accessible globally. Replaces config.ts.
## All values are immutable at runtime - never modify these constants.
extends Node

# Grid dimensions
const GRID_WIDTH: int = 20
const GRID_HEIGHT: int = 20
const CELL_SIZE: float = 1.0

# Starting resources
const STARTING_GOLD: int = 100

# Camera angles (degrees)
const CAMERA_AZIMUTH: float = 45.0
const CAMERA_ELEVATION: float = 60.0

# Structure definitions - cost, health, and combat stats
const STRUCTURES: Dictionary = {
	"barrier": {
		"cost": 10,
		"max_health": 150,
	},
	"basic_tower": {
		"cost": 25,
		"max_health": 50,
		"range": 3.0,
		"damage": 15,
		"fire_rate": 1.5,
		"targeting": "closest_to_core",
	},
	"sniper_tower": {
		"cost": 50,
		"max_health": 40,
		"range": 6.0,
		"damage": 60,
		"fire_rate": 0.4,
		"targeting": "highest_health",
	},
	"aoe_tower": {
		"cost": 50,
		"max_health": 40,
		"range": 2.5,
		"damage": 20,
		"fire_rate": 0.8,
		"targeting": "closest_to_core",
		"aoe_radius": 1.0,
	},
}

# Enemy definitions - health, speed, damage, and bounty
const ENEMIES: Dictionary = {
	"basic": {
		"health": 50,
		"speed": 2.0,
		"damage": 10,
		"structure_damage": 0,
		"bounty": 5,
	},
	"brute": {
		"health": 200,
		"speed": 1.0,
		"damage": 25,
		"structure_damage": 25,
		"bounty": 15,
	},
}

# Economy multipliers and wave bonus formula
const ECONOMY: Dictionary = {
	"sell_multiplier": 0.5,
	"repair_multiplier": 0.7,
	"wave_bonus_base": 20,
	"wave_bonus_increment": 5,
}

# Spawn timing and wave scaling
const SPAWN: Dictionary = {
	"min_interval": 0.3,
	"max_interval": 2.0,
	"base_enemy_count": 5,
	"enemy_count_increment": 2,
	"brute_start_wave": 4,
}

# Critical Resource (core) stats
const CRITICAL_RESOURCE: Dictionary = {
	"max_health": 100,
}
