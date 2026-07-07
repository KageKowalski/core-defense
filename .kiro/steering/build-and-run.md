# Build & Run Instructions

## Prerequisites

- Godot 4.7 (stable) installed and available on PATH as `godot` (or via Godot editor).
- No external plugins or dependencies required.

## Running the Game

### From Godot Editor
1. Open Godot and import the project at `core-defense/project.godot`.
2. Press F5 (or the Play button) to run the main scene (`scenes/main.tscn`).

### From Command Line
```bash
godot --path ./core-defense
```

## Project Configuration

Key settings in `project.godot`:
- Main scene: `res://scenes/main.tscn`
- Physics tick: 60 Hz (engine default)
- Renderer: Forward Plus
- Viewport: 1280×720

## Autoloads (loaded automatically by Godot)

| Name       | Path                               |
|------------|-------------------------------------|
| GameConfig | `res://scripts/autoloads/game_config.gd` |
| GameState  | `res://scripts/autoloads/game_state.gd`  |
| Economy    | `res://scripts/autoloads/economy.gd`     |

## Testing

Tests are not yet set up. When added, they will use GdUnit4:
```bash
# Run all tests (once GdUnit4 is installed)
godot --headless --script res://addons/gdUnit4/bin/GdUnitCmdTool.gd --run-all
```

## Export

Export presets are not configured yet. When needed:
1. Open Project → Export in the Godot editor.
2. Add platform templates (Windows, Linux, Web, etc.).
3. Exported builds go to `export/` (already in `.gitignore`).
