# Requirements Document

## Introduction

This feature adds visual feedback during the Preparation phase to help players understand structure placement and tower range. When a shop item is selected and the mouse hovers over an eligible cell, a ghost preview of the structure appears on the hovered cell, and cells within its attack range are highlighted. Similarly, hovering over an already-placed tower highlights its range cells. Barriers and other structures without a practical range do not trigger range highlighting.

## Glossary

- **Ghost_Preview**: A translucent visual representation of a structure shown at the hovered grid cell before placement is confirmed.
- **Range_Highlight**: A colored overlay applied to grid cells within a tower's attack range to indicate coverage area.
- **Grid_Cell**: A single 1×1 unit square on the 20×20 game grid, identified by a Vector2i coordinate.
- **Shop_Selection**: The currently selected structure type from the Shop Panel that the player intends to place.
- **Placed_Structure**: A structure instance that has already been purchased and exists on the grid.
- **Range_Indicator_System**: The system responsible for computing which cells fall within range and rendering the Range_Highlight overlay.
- **Attack_Range**: The numeric range value defined in GameConfig.STRUCTURES for tower types, measured in grid units from the tower center.
- **Preparation_Phase**: The game phase during which players may place, sell, and repair structures.

## Requirements

### Requirement 1: Ghost Preview on Hover

**User Story:** As a player, I want to see a translucent preview of the selected structure on the hovered cell, so that I can visualize where the structure will be placed before committing.

#### Acceptance Criteria

1. WHILE a Shop_Selection is active AND the game is in Preparation_Phase, WHEN the mouse hovers over an unoccupied Grid_Cell, THE Ghost_Preview SHALL display a translucent representation of the selected structure at that cell's world position.
2. WHEN the mouse moves to a different Grid_Cell, THE Ghost_Preview SHALL update its position to the newly hovered cell.
3. WHEN the mouse moves off the grid or onto an occupied cell, THE Ghost_Preview SHALL be hidden.
4. WHEN the Shop_Selection is cleared or the phase changes, THE Ghost_Preview SHALL be removed from the scene.
5. THE Ghost_Preview SHALL render with reduced opacity to visually distinguish it from placed structures.

### Requirement 2: Range Highlighting for Shop Selection

**User Story:** As a player, I want to see which cells are within a tower's attack range while previewing placement, so that I can make informed placement decisions.

#### Acceptance Criteria

1. WHILE a Shop_Selection is active AND the selected structure has an Attack_Range defined in GameConfig, WHEN the Ghost_Preview is visible on a Grid_Cell, THE Range_Indicator_System SHALL highlight all Grid_Cells whose center is within Attack_Range of the hovered cell center.
2. WHEN the Ghost_Preview moves to a new cell, THE Range_Indicator_System SHALL recalculate and update the highlighted cells to reflect the new position.
3. WHEN the Ghost_Preview is hidden or removed, THE Range_Indicator_System SHALL clear all range highlights.

### Requirement 3: Range Highlighting for Placed Structures

**User Story:** As a player, I want to see the range of my placed towers by hovering over them, so that I can evaluate my defense coverage.

#### Acceptance Criteria

1. WHILE the game is in Preparation_Phase AND no Shop_Selection is active, WHEN the mouse hovers over a Placed_Structure that has an Attack_Range, THE Range_Indicator_System SHALL highlight all Grid_Cells within that structure's Attack_Range.
2. WHEN the mouse moves away from the Placed_Structure, THE Range_Indicator_System SHALL clear all range highlights.

### Requirement 4: No Range for Rangeless Structures

**User Story:** As a player, I want the range indicator to only appear for structures that have a meaningful range, so that the UI remains clean and informative.

#### Acceptance Criteria

1. WHEN a Shop_Selection is a structure type without an Attack_Range defined in GameConfig (such as barriers), THE Range_Indicator_System SHALL not display any Range_Highlight cells.
2. WHEN hovering over a Placed_Structure without an Attack_Range, THE Range_Indicator_System SHALL not display any Range_Highlight cells.

### Requirement 5: Range Calculation

**User Story:** As a player, I want the range highlight to accurately represent the tower's coverage area, so that I can trust the visual feedback when planning my defense.

#### Acceptance Criteria

1. THE Range_Indicator_System SHALL compute range using Euclidean distance from the source cell center to each candidate cell center.
2. THE Range_Indicator_System SHALL include a Grid_Cell in the highlight if the Euclidean distance from the source cell center to the candidate cell center is less than or equal to the Attack_Range value.
3. THE Range_Indicator_System SHALL only highlight cells that are within the grid bounds (0 to GRID_WIDTH-1 on x, 0 to GRID_HEIGHT-1 on y).
