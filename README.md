# Replica Island Reborn

A web port of **Replica Island**, one of the earliest and most popular open-source Android games. Originally written in Java by Chris Pruett and Genki Mine, this project brings the classic side-scrolling platformer to the web using React, TypeScript, and HTML5 Canvas.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)

## About the Game

Replica Island is a side-scrolling platformer featuring the Android robot on a dangerous mission to find a mysterious power source. The original game includes all art, dialog, level layouts, and other data along with the source code.

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Runtime**: Bun
- **Rendering**: HTML5 Canvas 2D API
- **Audio**: Web Audio API

## Prerequisites

- [Bun](https://bun.sh/) runtime
- Modern web browser with Canvas support

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/evgenyvinnik/ReplicaIslandReborn.git
cd ReplicaIslandReborn

# Install dependencies
bun install
```

### Development

```bash
# Start development server
bun run dev

# Open browser at http://localhost:5173
```

### Building for Production

```bash
# Type check and build
bun run build

# Preview production build
bun run preview
```

### Other Commands

```bash
# Run type checking
bun run typecheck

# Lint code
bun run lint

# Lint and fix issues
bun run lint:fix

# Run tests
bun test
```

## Project Structure

```
├── src/                     # React + TypeScript source
│   ├── main.tsx             # React entry point
│   ├── App.tsx              # Main app component
│   ├── components/          # React UI components
│   │   ├── Game.tsx         # Main game canvas component
│   │   ├── LevelSelect.tsx  # Level selection screen
│   │   └── HUD.tsx          # Heads-up display overlay
│   ├── engine/              # Game engine
│   │   ├── GameLoop.ts      # Main game loop
│   │   ├── RenderSystem.ts  # Canvas 2D rendering
│   │   ├── InputSystem.ts   # Keyboard/touch input
│   │   ├── CollisionSystem.ts
│   │   └── SoundSystem.ts   # Web Audio API
│   ├── entities/            # Game objects and components
│   ├── levels/              # Level loading and management
│   ├── utils/               # Utility functions
│   ├── hooks/               # Custom React hooks
│   ├── context/             # React context providers
│   └── types/               # TypeScript type definitions
├── public/                  # Static assets
│   └── assets/              # Game assets (sprites, sounds, levels)
├── Original/                # Original Android source code (reference)
└── package.json             # Project dependencies and scripts
```

## Original Game

The `Original/` directory contains the complete source code for the original Android version of Replica Island, preserved for reference during the porting process.

## Project Statistics

### Web Port (This Project)

Source Lines of Code (SLOC) - non-empty lines:

| Extension | Lines |
|-----------|------:|
| .ts | 12,483 |
| .tsx | 3,008 |
| .md | 1,766 |
| .json | 290 |
| .css | 279 |
| .mjs | 100 |
| .js | 76 |
| .html | 32 |
| **Total** | **18,034** |

*Run `bun run sloc` to recalculate. Excludes `node_modules/`, `dist/`, and `Original/` directories.*

### Original Android Implementation

Source Lines of Code (SLOC) - non-empty lines:

| Extension | Lines |
|-----------|------:|
| .java | 25,789 |
| .xml | 3,444 |
| .js | 240 |
| **Total** | **29,473** |

*The original Android game in the `Original/` directory, excluding `.svn/` metadata.*

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

The original Replica Island game is also released under the Apache 2.0 license by Google Inc.
