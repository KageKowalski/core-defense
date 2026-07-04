# Core Defense

A browser-based tower defense game built with TypeScript and Three.js. Defend your core from waves of enemies by strategically placing towers and barriers on a grid-based map.

## Table of Contents

- [Gameplay](#gameplay)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Architecture](#architecture)
- [Game Configuration](#game-configuration)
- [License](#license)

## Gameplay

- **Objective:** Protect the Critical Resource (core) at the center of the grid from incoming enemy waves.
- **Phases:**
  - **Preparation** — Place and manage structures (towers/barriers) using gold.
  - **Combat** — Enemies spawn and path toward the core; towers fire automatically.
- **Structures:**
  | Type | Cost | Description |
  |------|------|-------------|
  | Barrier | 10g | High-HP wall that blocks enemy paths |
  | Basic Tower | 25g | Balanced range/damage, targets closest to core |
  | Sniper Tower | 50g | Long range, high single-target damage, targets highest HP |
  | AOE Tower | 50g | Short range, area-of-effect splash damage |
- **Enemies:**
  | Type | HP | Speed | Bounty | Notes |
  |------|-----|-------|--------|-------|
  | Basic | 50 | 2 | 5g | Standard enemy |
  | Brute | 200 | 1 | 15g | Slow but tanky; damages barriers; appears from wave 4 |
- **Economy:** Earn gold by killing enemies and completing waves. Sell structures at 50% cost; repair damaged structures at 70% cost.

## Tech Stack

- **Language:** TypeScript (ES2020 target, strict mode)
- **Rendering:** [Three.js](https://threejs.org/) for 3D WebGL rendering
- **Build Tool:** [Vite](https://vitejs.dev/) 6
- **Testing:** [Vitest](https://vitest.dev/) 3 with [fast-check](https://github.com/dubzzz/fast-check) for property-based tests
- **Module System:** ESNext modules

## Project Structure

```
core-defense/
├── index.html              # Entry HTML with game container and UI styles
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite + Vitest configuration
└── src/
    ├── main.ts             # Application bootstrap and event wiring
    ├── models/
    │   ├── config.ts       # Game balance constants (costs, HP, speeds, etc.)
    │   ├── entities.ts     # Entity type interfaces (structures, enemies, projectiles)
    │   ├── entity-store.ts # Central entity collection management
    │   └── grid.ts         # Grid model, cell types, coordinate utilities
    └── systems/
        ├── combat.ts       # Targeting, firing, damage resolution
        ├── economy.ts      # Gold management, buy/sell/repair pricing
        ├── game-loop.ts    # Fixed-timestep update + render loop
        ├── input-system.ts # Mouse/touch input → grid coordinate mapping
        ├── movement.ts     # Enemy movement along paths
        ├── pathfinding.ts  # A* pathfinding on the grid
        ├── phase-manager.ts# Phase state machine (preparation/combat/game_over)
        ├── placement.ts    # Structure placement, selling, and repair logic
        ├── render-system.ts# Three.js scene, camera, and mesh management
        ├── spawning.ts     # Wave enemy spawning schedules
        ├── state.ts        # Top-level game state manager
        ├── system-pipeline.ts # Per-frame system execution order
        ├── ui-system.ts    # HUD, shop panel, and context menu management
        └── vfx.ts          # Visual effects (floating text, destruction FX)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- npm (included with Node.js)

### Installation

```bash
git clone https://github.com/KageKowalski/core-defense.git
cd core-defense
npm install
```

### Running the Game

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`) in a modern browser.

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Vite dev server with hot reload |
| `build` | `npm run build` | Type-check and produce production build |
| `preview` | `npm run preview` | Serve the production build locally |
| `test` | `npm test` | Run all unit and property-based tests once |
| `test:watch` | `npm run test:watch` | Run tests in watch mode |

## Architecture

The game follows an **Entity-Component-System (ECS)** inspired architecture:

1. **Models** define the data (entities, grid, configuration).
2. **Systems** operate on that data each frame in a deterministic pipeline order.
3. **Events** decouple systems — the pipeline emits events (e.g., `enemy_killed`, `wave_complete`) consumed by UI/VFX layers.

### Key Design Decisions

- **Fixed-timestep game loop** ensures deterministic simulation independent of frame rate.
- **Pathfinding (A\*)** recalculates when grid topology changes (structure placed/sold).
- **Separation of simulation and rendering** — logic runs at a fixed tick rate; Three.js renders interpolated state at display refresh rate.

## Game Configuration

All balance values are centralized in [`src/models/config.ts`](src/models/config.ts). Key tunables include:

- Grid dimensions (default 20×20)
- Starting gold (100)
- Structure costs, HP, range, damage, fire rates
- Enemy HP, speed, bounties
- Economy multipliers (sell at 50%, repair at 70%)
- Wave scaling (base enemy count + increment per wave)

## License

This project is private and not currently published under an open-source license.
