---
inclusion: fileMatch
fileMatchPattern: "**/ui/**,**/scenes/ui/**"
---

# UI Patterns

Conventions and patterns used for all UI code in this project.

## Architecture

- All UI lives under a `CanvasLayer` node named `UILayer` in main.tscn.
- Each UI component is a separate `.tscn` scene instantiated under UILayer.
- UI scripts connect to `GameState` signals in `_ready()` for reactive updates.
- UI actions (buy, sell, start wave, restart) emit signals upward — `main.gd` wires them to managers.

## Node Access

- Use `%NodeName` (unique name in owner) for referencing UI child nodes.
- Declare with `@onready var my_node: Type = %MyNode`.
- Mark nodes as "unique name in owner" in the scene editor.

## Visibility Rules

| Component        | Visible During       | Hidden During             |
|------------------|---------------------|---------------------------|
| ShopPanel        | Preparation         | Combat, Game_Over         |
| StartWaveButton  | Preparation         | Combat, Game_Over         |
| ContextMenu      | When opened         | Default hidden            |
| GameOverScreen   | Game_Over           | Preparation, Combat       |
| Wave/Enemy labels| Combat              | Preparation, Game_Over    |
| Gold label       | Always              | Never                     |
| Core health bar  | Always              | Never                     |

## Affordability & Unlock

- Shop buttons are disabled (grayed out) when player can't afford the structure.
- Shop buttons are hidden entirely when the structure hasn't been unlocked yet.
- Unlock is wave-based: wave 1 → Barrier + Basic Tower; wave 2 → + Sniper; wave 3 → + AOE.
- Affordability updates on `gold_changed` signal.

## Selection Pattern

- ShopPanel uses toggle buttons. Clicking a selected button deselects it.
- `structure_selected(type: String)` signal sent to main.gd, which stores `_selected_structure_type`.
- Right-click or Escape clears selection.
- Selection is cleared on phase change.

## Context Menu Pattern

- Opened by clicking an existing structure with no shop selection active.
- Shows: structure name, health, sell value (via Economy), repair cost (if damaged).
- Repair button hidden when at full health, disabled when unaffordable.
- Emits `sell_requested` / `repair_requested` with the grid position.
- Closed by: clicking Sell/Repair, clicking Close, or right-click/Escape.
