# CLAUDE.md - Project Guide for ReplicaIslandReborn

## Project Overview

This project is a web port of **Replica Island**, one of the earliest and most popular open-source Android games. The original game was written in Java for Android by Chris Pruett and Genki Mine, released under the Apache 2.0 license.

### User Request

> In the folder `Original` lies the source code for one of very popular Android games called "Replica Island"
>
> It was one of the earliest open-source games for Android, written in Java
>
> I want to port "Replica Island" as a web game, probably combination of React + Canvas - this would lie in the root directly of the repository

### About Replica Island

Replica Island is a side-scrolling platformer starring the Android robot as its protagonist on a dangerous mission to find a mysterious power source. The game includes all art, dialog, level layouts, and other data along with the code.

---

## Directory Structure

### Original Game (`/Original`)

The original Android/Java source code lives here:

```
Original/
├── AndroidManifest.xml      # Android app manifest
├── COPYING                  # Apache 2.0 license
├── README.TXT               # Original project documentation
├── default.properties       # Android build properties
├── res/                     # Android resources
│   ├── anim/                # Animation XML definitions (fades, slides, etc.)
│   ├── drawable/            # XML drawables (borders, configs)
│   ├── drawable-ja/         # Japanese-specific drawables
│   ├── drawable-normal-mdpi/# Medium-density screen drawables
│   ├── layout/              # Activity layouts (menus, dialogs, game over, etc.)
│   ├── raw/                 # Binary game data
│   │   ├── collision.bin    # Collision data (line segments & normals)
│   │   ├── level_*.bin      # Level binary data files
│   │   ├── *.ogg            # Sound effects
│   │   └── bwv_115.mid      # Background music (MIDI)
│   ├── values/              # Strings, styles, arrays, character configs
│   ├── values-*/            # Localized strings (ja, en) and input configs (dpad, wheel, nonav)
│   └── xml/                 # Game configuration XMLs
│       ├── level_tree.xml   # Non-linear level progression tree
│       ├── level_*_dialog_*.xml  # Dialog scripts per level
│       └── preferences.xml  # Game preferences schema
├── src/com/replica/replicaisland/  # Main Java source code
│   ├── AndouKun.java        # Core game Activity (main entry point)
│   ├── Game.java            # Abstraction layer, bootstraps game
│   ├── GameThread.java      # Main game loop thread
│   ├── MainLoop.java        # Game graph head, polled per frame
│   ├── GameRenderer.java    # Rendering thread (OpenGL)
│   ├── GameObject*.java     # Game entity management
│   ├── *Component.java      # Component system (animation, collision, physics, etc.)
│   ├── LevelBuilder.java    # Level loading and construction
│   ├── TiledWorld.java      # Tile-based world rendering
│   └── ... (100+ Java files)
└── tools/
    └── ExtractPoints.js     # Photoshop script for collision extraction
```

### Key Architecture Concepts (Original)

1. **Game Loop**: `AndouKun.java` → `Game.java` → `GameThread.java` → `MainLoop.java`
2. **Entity-Component System**: `GameObject` contains `GameComponent` children implementing features
3. **Render Pipeline**: Render commands queued by game thread, executed by separate render thread
4. **Object Manager**: `GameObjectManager` activates/deactivates objects based on camera proximity

### Web Port (`/` - Root Directory)

The React + Canvas web port will live in the repository root:

```
/
├── CLAUDE.md                # This file
├── LICENSE                  # Project license
├── README.md                # Project overview
├── Original/                # Original Android source (reference)
├── package.json             # NPM dependencies
├── tsconfig.json            # TypeScript configuration
├── eslint.config.js         # ESLint configuration
├── vite.config.ts           # Vite build configuration
├── index.html               # HTML entry point
├── public/                  # Static assets
│   ├── assets/              # Game assets (sprites, sounds, levels)
│   │   ├── sprites/         # Converted sprite sheets
│   │   ├── audio/           # Converted audio files (MP3/WebAudio)
│   │   └── levels/          # Converted level data (JSON)
│   └── favicon.ico
└── src/                     # React + TypeScript source
    ├── main.tsx             # React entry point
    ├── App.tsx              # Main app component
    ├── components/          # React UI components
    │   ├── Game.tsx         # Main game canvas component
    │   ├── MainMenu.tsx     # Menu screens
    │   ├── LevelSelect.tsx  # Level selection
    │   └── HUD.tsx          # Heads-up display overlay
    ├── engine/              # Game engine (ported from Java)
    │   ├── GameLoop.ts      # Main game loop
    │   ├── Renderer.ts      # Canvas 2D rendering
    │   ├── InputSystem.ts   # Keyboard/touch input handling
    │   ├── CollisionSystem.ts
    │   ├── PhysicsSystem.ts
    │   └── SoundSystem.ts   # Web Audio API
    ├── entities/            # Game objects and components
    │   ├── GameObject.ts
    │   ├── Player.ts
    │   ├── Enemy.ts
    │   └── components/      # Component implementations
    ├── levels/              # Level loading and management
    │   ├── LevelLoader.ts
    │   ├── TileMap.ts
    │   └── LevelTree.ts
    ├── utils/               # Utility functions
    │   ├── Vector2.ts
    │   ├── ObjectPool.ts
    │   └── AssetLoader.ts
    ├── hooks/               # Custom React hooks
    │   └── useGameLoop.ts
    ├── context/             # React context providers
    │   └── GameContext.tsx
    └── types/               # TypeScript type definitions
        └── index.ts
```

---

## Coding Conventions

### Technology Stack

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Rendering**: HTML5 Canvas 2D API
- **Audio**: Web Audio API
- **Styling**: CSS Modules or Tailwind CSS
- **State Management**: React Context + useReducer (or Zustand if needed)

### ESLint Configuration

Use the following ESLint setup:

```javascript
// eslint.config.js
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // React
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];
```

### Code Style Guidelines

1. **File Naming**:
   - React components: `PascalCase.tsx` (e.g., `MainMenu.tsx`)
   - Utilities/hooks: `camelCase.ts` (e.g., `useGameLoop.ts`)
   - Types: `camelCase.ts` or grouped in `types/index.ts`

2. **Component Structure**:
   ```tsx
   // Imports (external, then internal, then types)
   import { useState, useEffect } from 'react';
   import { useGameContext } from '../context/GameContext';
   import type { GameState } from '../types';
   
   // Types/Interfaces
   interface Props {
     initialLevel: number;
   }
   
   // Component
   export function GameCanvas({ initialLevel }: Props): JSX.Element {
     // Hooks first
     // Event handlers
     // Render
   }
   ```

3. **Game Engine Code**:
   - Separate game logic from React rendering
   - Use `requestAnimationFrame` for the game loop
   - Implement object pooling for frequently created/destroyed objects
   - Keep rendering code decoupled from game state updates

4. **Comments**:
   - Document complex algorithms and game mechanics
   - Reference original Java code when porting: `// Ported from: Original/src/.../FileName.java`

---

## How to Execute the Port

### Prerequisites

- Node.js 18+ and npm (or pnpm/yarn)
- Modern web browser with Canvas support

### Development Setup

```bash
# Clone the repository
git clone https://github.com/evgenyvinnik/ReplicaIslandReborn.git
cd ReplicaIslandReborn

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser at http://localhost:5173
```

### Available Scripts

```bash
npm run dev        # Start Vite dev server with hot reload
npm run build      # Build for production
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
npm run lint:fix   # Run ESLint with auto-fix
npm run typecheck  # Run TypeScript type checking
npm run test       # Run tests (Vitest)
```

### Building for Production

```bash
npm run build
# Output will be in /dist folder
# Deploy the dist folder to any static hosting (Vercel, Netlify, GitHub Pages)
```

---

## Important Gotchas and Things to Know

### Porting Challenges

1. **Binary Level Data**: The original game uses `.bin` files for levels. These need to be:
   - Reverse-engineered or converted to JSON format
   - The `LevelBuilder.java` file shows how levels are loaded

2. **Collision System**: The collision data (`collision.bin`) contains line segments and normals.
   - Reference `ExtractPoints.js` in tools for format understanding
   - Consider converting to a tile-based or polygon collision system

3. **OpenGL to Canvas**: Original uses OpenGL ES for rendering.
   - Canvas 2D is sufficient for this 2D platformer
   - May need to batch draw calls for performance
   - Consider WebGL if performance issues arise

4. **Object Pooling**: The original heavily uses object pools to avoid GC pauses.
   - JavaScript GC is less predictable than Java's
   - Implement similar pooling for bullets, particles, effects

5. **Input System**: Original handles Android touch, D-pad, trackball.
   - Web version needs: keyboard, mouse/touch, gamepad API
   - Mobile web needs virtual joystick overlay

### Asset Conversion

1. **Sprites**: Original likely uses texture atlases with OpenGL.
   - Extract and convert to PNG sprite sheets
   - Consider using a sprite sheet packing tool

2. **Audio**: OGG files need conversion for broader browser support.
   - Convert to MP3 or use multiple formats
   - Web Audio API for sound effects
   - Handle audio autoplay restrictions

3. **Levels**: Binary `.bin` files need parsing.
   - Study `LevelBuilder.java` and `TiledWorld.java`
   - Convert to JSON for easier web consumption

### Performance Considerations

1. **Game Loop**: Use `requestAnimationFrame` with delta time.
   - Original uses fixed timestep; consider similar approach
   - Reference `GameThread.java` for timing logic

2. **Canvas Optimization**:
   - Minimize canvas state changes
   - Use offscreen canvases for complex backgrounds
   - Consider layer separation (background, game, UI)

3. **Mobile Performance**:
   - Test on low-end mobile devices
   - Implement quality settings if needed
   - Watch memory usage on mobile Safari

### Browser Compatibility

- Target modern browsers (Chrome, Firefox, Safari, Edge)
- Test touch input on iOS Safari and Android Chrome
- Handle visibility change (pause when tab hidden)
- Implement proper fullscreen support

### Original Game Loop Reference

```
AndouKun.java (Activity lifecycle, input events)
    └── Game.java (Bootstrap, event passing)
        └── GameThread.java (Main loop timing)
            └── MainLoop.java (Game graph root)
                ├── GameObjectManager (Entity management)
                │   └── GameObject (Entity with components)
                └── Various Systems (Camera, Collision, etc.)
```

---

## Resources

- [Original Replica Island Source](https://code.google.com/archive/p/replicaisland/)
- [Game Programming Patterns](https://gameprogrammingpatterns.com/) - For architecture reference
- [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
