# Scene Tree Reference

Complete hierarchy of the main scene and how nodes relate to each other.

## main.tscn — Root Scene Tree

```
Main (Node3D) [script: main.gd]
├── GridManager (Node3D) [script: grid_manager.gd]
│   └── (dynamically added structure nodes)
├── PathfindingManager (Node) [script: pathfinding_manager.gd]
├── SpawnManager (Node) [script: spawn_manager.gd]
├── CombatManager (Node) [script: combat_manager.gd]
├── PhaseManager (Node) [script: phase_manager.gd]
├── VFXManager (Node3D) [script: vfx_manager.gd]
│   └── (dynamically added VFX nodes)
├── GameCamera (Camera3D) [script: game_camera.gd]
├── StructuresContainer (Node3D) [currently unused — structures added to GridManager]
├── EnemiesContainer (Node3D) [enemies added here by SpawnManager]
├── ProjectilesContainer (Node3D) [projectiles added here by CombatManager]
├── CriticalResource (instance of critical_resource.tscn)
│   └── MeshInstance3D (golden BoxMesh 2×1.5×2)
├── GroundPlane (MeshInstance3D) [PlaneMesh 20×20, dark green, at (10,0,10)]
├── GridOverlay (Node3D)
│   └── (dynamically generated ImmediateMesh with grid lines)
├── AmbientLight (DirectionalLight3D) [energy 0.4]
├── DirectionalLight (DirectionalLight3D) [energy 1.0, shadows enabled]
└── UILayer (CanvasLayer)
    ├── HUD (instance of hud.tscn) [CanvasLayer with labels + health bar]
    ├── ShopPanel (instance of shop_panel.tscn) [PanelContainer, left side]
    ├── ContextMenu (instance of context_menu.tscn) [PanelContainer, centered]
    ├── GameOverScreen (instance of game_over_screen.tscn) [Control, full screen]
    └── StartWaveButton (instance of start_wave_button.tscn) [Button, bottom center]
```

## Entity Scene Structures

### barrier.tscn
```
Barrier (Node3D) [script: barrier.gd]
└── MeshInstance3D [BoxMesh 0.8×1.0×0.8, brown, y=0.5]
```

### basic_tower.tscn
```
BasicTower (Node3D) [script: basic_tower.gd]
└── MeshInstance3D [BoxMesh 0.7×1.2×0.7, blue, y=0.6]
```

### sniper_tower.tscn
```
SniperTower (Node3D) [script: sniper_tower.gd]
└── MeshInstance3D [BoxMesh 0.7×1.2×0.7, purple, y=0.6]
```

### aoe_tower.tscn
```
AoeTower (Node3D) [script: aoe_tower.gd]
└── MeshInstance3D [BoxMesh 0.7×1.2×0.7, orange-red, y=0.6]
```

### basic_enemy.tscn
```
BasicEnemy (CharacterBody3D) [script: basic_enemy.gd]
├── MeshInstance3D [BoxMesh 0.4×0.5×0.4, green, y=0.25]
└── CollisionShape3D [BoxShape3D 0.4×0.5×0.4, y=0.25]
```

### brute_enemy.tscn
```
BruteEnemy (CharacterBody3D) [script: brute_enemy.gd]
├── MeshInstance3D [BoxMesh 0.6×0.8×0.6, dark red, y=0.4]
└── CollisionShape3D [BoxShape3D 0.6×0.8×0.6, y=0.4]
```

### projectile.tscn
```
Projectile (Node3D) [script: projectile.gd]
└── MeshInstance3D [SphereMesh radius=0.15, yellow]
```

### critical_resource.tscn
```
CriticalResource (Node3D) [script: critical_resource.gd, position: (10,0,10)]
└── MeshInstance3D [BoxMesh 2×1.5×2, gold, y=0.75]
```

## UI Scene Structures

### hud.tscn
```
HUD (CanvasLayer) [script: hud.gd]
└── TopBar (HBoxContainer)
    ├── LeftPanel (MarginContainer)
    │   └── VBox (VBoxContainer)
    │       ├── %GoldLabel (Label)
    │       ├── %WaveLabel (Label)
    │       └── %EnemiesLabel (Label)
    ├── CenterPanel (MarginContainer)
    │   └── VBox (VBoxContainer)
    │       ├── CoreHealthLabel (Label)
    │       └── %CoreHealthBar (ProgressBar)
    └── RightSpacer (Control)
```

### shop_panel.tscn
```
ShopPanel (PanelContainer) [script: shop_panel.gd]
└── MarginContainer
    └── VBoxContainer
        ├── TitleLabel (Label) "Shop"
        ├── Separator (HSeparator)
        ├── %BarrierButton (Button, toggle)
        ├── %BasicTowerButton (Button, toggle)
        ├── %SniperTowerButton (Button, toggle)
        └── %AoeTowerButton (Button, toggle)
```

### context_menu.tscn
```
ContextMenu (PanelContainer) [script: context_menu.gd, hidden by default]
└── MarginContainer
    └── VBoxContainer
        ├── %NameLabel (Label)
        ├── %HealthLabel (Label)
        ├── Separator (HSeparator)
        ├── %SellButton (Button)
        ├── %RepairButton (Button)
        └── %CloseButton (Button)
```

### game_over_screen.tscn
```
GameOverScreen (Control) [script: game_over_screen.gd, hidden by default]
├── Background (ColorRect) [black, 70% opacity]
└── CenterContainer
    └── VBoxContainer
        ├── GameOverLabel (Label) "GAME OVER" [font size 48]
        ├── %WaveReachedLabel (Label) [font size 24]
        └── %RestartButton (Button) "Restart"
```

### start_wave_button.tscn
```
StartWaveButton (Button) [script: start_wave_button.gd, bottom center]
```

## Export NodePath Connections

| Manager            | Export Path                       | Resolves To          |
|--------------------|-----------------------------------|----------------------|
| GridManager        | `pathfinding_manager_path`        | `../PathfindingManager` |
| PathfindingManager | `grid_manager_path`               | `../GridManager`     |
| SpawnManager       | `pathfinding_manager_path`        | `../PathfindingManager` |
| SpawnManager       | `enemies_container_path`          | `../EnemiesContainer`|
| CombatManager      | `projectiles_container_path`      | `../ProjectilesContainer` |
| CombatManager      | `spawn_manager_path`              | `../SpawnManager`    |
| PhaseManager       | `spawn_manager_path`              | `../SpawnManager`    |
| PhaseManager       | `grid_manager_path`               | `../GridManager`     |
