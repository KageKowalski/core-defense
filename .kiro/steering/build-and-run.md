# Build & Run Instructions

## Prerequisites

- Godot 4.7 (stable) installed and available on PATH as `godot` (or via Godot editor).
- GdUnit4 addon installed locally for testing (see Testing section below).

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

GdUnit4 is used for unit and property-based testing.

**Important:** The `addons/` folder is local-only and ignored by git (via `.gitignore`). It is not included in the remote repository. Each developer must install GdUnit4 locally.

### Installing GdUnit4

1. Open the Godot editor with this project.
2. Go to AssetLib → search "GdUnit4" → install it.
3. Enable the plugin: Project → Project Settings → Plugins → GdUnit4 → Enable.

The addon installs to `addons/gdUnit4/` which is already in `.gitignore`.

### Running Tests

```bash
# Run all tests from command line
godot --headless --script res://addons/gdUnit4/bin/GdUnitCmdTool.gd --run-all
```

Or use the GdUnit4 panel inside the Godot editor.

## Export

Export presets are not configured yet. When needed:
1. Open Project → Export in the Godot editor.
2. Add platform templates (Windows, Linux, Web, etc.).
3. Exported builds go to `export/` (already in `.gitignore`).
