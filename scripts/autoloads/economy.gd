## Economy Autoload
## Gold transaction logic. Replaces economy.ts.
## All gold mutations go through GameState.gold and emit GameState.gold_changed.
extends Node


## Returns true if the player can afford the given cost.
func can_afford(cost: int) -> bool:
	return GameState.gold >= cost


## Attempts to deduct the given amount from the player's gold.
## Returns true if successful, false if insufficient funds or negative amount.
## Gold cannot go below zero (Req 4.4).
func deduct(amount: int) -> bool:
	if amount < 0 or GameState.gold < amount:
		return false
	GameState.gold -= amount
	GameState.gold_changed.emit(GameState.gold)
	return true


## Credits gold to the player's total.
## Ignores negative or zero amounts.
func credit(amount: int) -> void:
	if amount <= 0:
		return
	GameState.gold += amount
	GameState.gold_changed.emit(GameState.gold)


## Calculates the sell value for a structure.
## Formula: floor((currentHealth / maxHealth) × originalCost × 0.5)
## Edge cases: max_health=0 or original_cost=0 returns 0.
func calculate_sell_value(current_health: int, max_health: int, original_cost: int) -> int:
	if max_health <= 0 or original_cost <= 0:
		return 0
	return int(floor(float(current_health) / float(max_health) * float(original_cost) * GameConfig.ECONOMY["sell_multiplier"]))


## Calculates the repair cost for a structure.
## Formula: ceil(((maxHealth - currentHealth) / maxHealth) × originalCost × 0.7)
## Edge cases: max_health=0, original_cost=0, or currentHealth >= maxHealth returns 0.
func calculate_repair_cost(current_health: int, max_health: int, original_cost: int) -> int:
	if max_health <= 0 or original_cost <= 0 or current_health >= max_health:
		return 0
	var damage_fraction := float(max_health - current_health) / float(max_health)
	return int(ceil(damage_fraction * float(original_cost) * GameConfig.ECONOMY["repair_multiplier"]))


## Returns the wave completion bonus for the given wave number.
## Formula: 20 + (waveNumber - 1) × 5
func get_wave_bonus(wave_number: int) -> int:
	return GameConfig.ECONOMY["wave_bonus_base"] + (wave_number - 1) * GameConfig.ECONOMY["wave_bonus_increment"]


## Returns the bounty amount for a given enemy type.
## Looks up the bounty from GameConfig.ENEMIES dict.
## Returns 0 if enemy type is not found.
func get_enemy_bounty(enemy_type: String) -> int:
	return GameConfig.ENEMIES.get(enemy_type, {}).get("bounty", 0)


## Credits the bounty for the given enemy type to gold and returns the amount.
func award_bounty(enemy_type: String) -> int:
	var bounty := get_enemy_bounty(enemy_type)
	credit(bounty)
	return bounty


## Credits the wave bonus for the given wave number to gold and returns the amount.
func award_wave_bonus(wave_number: int) -> int:
	var bonus := get_wave_bonus(wave_number)
	credit(bonus)
	return bonus
