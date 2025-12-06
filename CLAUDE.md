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

## CRITICAL: Original Implementation Architecture

### ⚠️ Important Notes for Porting

The original Replica Island uses a sophisticated **multi-threaded dual-buffered rendering architecture** with **phased component execution**. This is fundamentally different from typical single-threaded web game loops. Understanding this architecture is crucial for a correct port.

---

## Original Architecture Deep Dive

### Core Threading Model

The original game uses **two threads**:
1. **Game Thread** (`GameThread.java`): Updates game logic, fills render queue
2. **Render Thread** (`GameRenderer.java`): Consumes render queue, draws to screen

These threads synchronize via a **double-buffered render queue** managed by `RenderSystem.java`.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            GAME THREAD                                   │
│                                                                         │
│  GameThread.run() {                                                     │
│      while (!finished) {                                                │
│          renderer.waitDrawingComplete();  // Wait for render thread     │
│          timeDelta = calculateDelta();                                  │
│          if (timeDelta > 12ms) {                                        │
│              gameRoot.update(timeDelta);  // Update all game objects    │
│              renderSystem.swap(renderer); // Swap render queues         │
│          }                                                              │
│          sleep(16 - elapsed);  // Cap at ~60fps                         │
│      }                                                                  │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           RENDER THREAD                                  │
│                                                                         │
│  GameRenderer.onDrawFrame(GL10 gl) {                                    │
│      waitForDrawQueueChanged();           // Block until queue ready    │
│      DrawableBitmap.beginDrawing(gl);     // Set up OpenGL state        │
│      for (element : drawQueue) {                                        │
│          if (element.cameraRelative) {                                  │
│              x = (element.x - cameraX) + halfWidth;                     │
│              y = (element.y - cameraY) + halfHeight;                    │
│          }                                                              │
│          element.drawable.draw(x, y, scaleX, scaleY);                   │
│      }                                                                  │
│      DrawableBitmap.endDrawing(gl);       // Restore OpenGL state       │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

#### 1. BaseObject and Object Graph
All game objects derive from `BaseObject`:
```java
public abstract class BaseObject {
    static ObjectRegistry sSystemRegistry;  // Global system access
    
    public void update(float timeDelta, BaseObject parent) { }
    public abstract void reset();
}
```

#### 2. ObjectManager - Tree Structure
`ObjectManager` creates a tree of updateable objects:
```java
public class ObjectManager extends BaseObject {
    private FixedSizeArray<BaseObject> mObjects;
    private FixedSizeArray<BaseObject> mPendingAdditions;
    private FixedSizeArray<BaseObject> mPendingRemovals;
    
    @Override
    public void update(float timeDelta, BaseObject parent) {
        commitUpdates();  // Apply pending add/remove
        for (object : mObjects) {
            object.update(timeDelta, this);
        }
    }
}
```

#### 3. PhasedObject and Phase-Based Execution
Components are sorted and executed in **strict phase order**:
```java
public enum ComponentPhases {
    THINK,                  // 0: AI decisions
    PHYSICS,                // 1: Apply forces (gravity, impulses)
    POST_PHYSICS,           // 2: Friction, inertia, bounce
    MOVEMENT,               // 3: Update position from velocity
    COLLISION_DETECTION,    // 4: Detect intersections
    COLLISION_RESPONSE,     // 5: Resolve collisions, snap out
    POST_COLLISION,         // 6: Position is final for frame
    ANIMATION,              // 7: Select animation based on state
    PRE_DRAW,               // 8: Prepare drawable (SpriteComponent)
    DRAW,                   // 9: Schedule for rendering (RenderComponent)
    FRAME_END,              // 10: Cleanup
}
```

**This phase ordering is CRITICAL. Components MUST execute in this order!**

---

## Original File Documentation

### Core Game Loop Files

| File | Purpose | Key Connections |
|------|---------|-----------------|
| `AndouKun.java` | Android Activity, lifecycle management, input routing | Creates `Game`, handles touch/key events |
| `Game.java` | Bootstrap, creates all systems, level loading | Creates `MainLoop`, `GameRenderer`, all systems |
| `GameThread.java` | Game loop timing, synchronization with render thread | Calls `MainLoop.update()`, syncs with `GameRenderer` |
| `MainLoop.java` | Root of game object graph, contains `TimeSystem` | Updates `TimeSystem` first, then children |
| `GameRenderer.java` | OpenGL rendering, texture loading, draw queue consumer | Receives draw queue from `RenderSystem` |

### Object/Component System Files

| File | Purpose | Key Connections |
|------|---------|-----------------|
| `BaseObject.java` | Abstract base for all updateable objects | Has static `sSystemRegistry` for global access |
| `ObjectManager.java` | Container for child objects, tree node | Manages add/remove with pending lists |
| `PhasedObject.java` | Adds `phase` field for sorting | Extended by `GameComponent` |
| `PhasedObjectManager.java` | Sorts children by phase | Extended by `GameObject` |
| `GameObject.java` | Game entity (player, enemy, etc.) | Contains components, has position/velocity/action |
| `GameComponent.java` | Base for all components | Defines `ComponentPhases` enum |
| `GameObjectManager.java` | Manages all GameObjects, activation by distance | Activates/deactivates based on camera distance |
| `GameObjectFactory.java` | Spawns configured GameObjects (~6700 lines!) | Creates player, enemies, effects, etc. |
| `ObjectRegistry.java` | Global singleton registry for all systems | Accessed via `BaseObject.sSystemRegistry` |

### Rendering System Files

| File | Purpose | Key Connections |
|------|---------|-----------------|
| `RenderSystem.java` | Double-buffered render queue management | Receives `scheduleForDraw()` calls, swaps queues |
| `RenderComponent.java` | Schedules drawable for rendering | Phase=DRAW, calls `renderSystem.scheduleForDraw()` |
| `DrawableObject.java` | Abstract base for all drawables | Has `priority` and `parentPool` |
| `DrawableBitmap.java` | Single sprite/texture drawing | Uses OpenGL `glDrawTexfOES` extension |
| `DrawableFactory.java` | Object pool for drawables | Allocates `DrawableBitmap`, `ScrollableBitmap`, etc. |
| `ScrollableBitmap.java` | Parallax scrolling background | Used for background layers |
| `TiledVertexGrid.java` | Tile map rendering with vertex buffers | Generates OpenGL vertex data from `TiledWorld` |
| `TiledBackgroundVertexGrid.java` | Wrapper for tiled background drawing | Used by `ScrollerComponent` |

#### RenderSystem Double-Buffering
```java
public class RenderSystem extends BaseObject {
    private ObjectManager[] mRenderQueues;  // Two queues
    private int mQueueIndex;                // Current write queue
    
    // Called by components during DRAW phase
    public void scheduleForDraw(DrawableObject object, Vector2 position, 
                                int priority, boolean cameraRelative) {
        RenderElement element = mElementPool.allocate();
        element.set(object, position, priority, cameraRelative);
        mRenderQueues[mQueueIndex].add(element);
    }
    
    // Called at end of game update
    public void swap(GameRenderer renderer, float cameraX, float cameraY) {
        mRenderQueues[mQueueIndex].commitUpdates();
        renderer.setDrawQueue(mRenderQueues[mQueueIndex], cameraX, cameraY);
        
        // Clear the previous queue
        int lastQueue = (mQueueIndex == 0) ? 1 : 0;
        clearQueue(mRenderQueues[lastQueue].getObjects());
        
        mQueueIndex = (mQueueIndex + 1) % 2;  // Swap
    }
}
```

### Animation System Files

| File | Purpose | Key Connections |
|------|---------|-----------------|
| `SpriteComponent.java` | Manages sprite animations, provides drawable | Phase=PRE_DRAW, sets drawable on `RenderComponent` |
| `SpriteAnimation.java` | Collection of animation frames | Contains `AnimationFrame` array |
| `AnimationFrame.java` | Single frame: texture + hold time + collision volumes | May have attack/vulnerability collision volumes |
| `AnimationComponent.java` | Player-specific animation logic | Phase=ANIMATION, selects animation on `SpriteComponent` |
| `GenericAnimationComponent.java` | Generic animation selector | Maps `ActionType` to animation index |
| `EnemyAnimationComponent.java` | Enemy-specific animation logic | Handles enemy states and animations |

#### Animation Flow (CRITICAL!)
```
1. ANIMATION Phase:
   AnimationComponent/GenericAnimationComponent
   ├── Reads: GameObject.currentAction, velocity, touchingGround
   └── Writes: SpriteComponent.playAnimation(index)

2. PRE_DRAW Phase:
   SpriteComponent
   ├── Reads: mCurrentAnimationIndex, mAnimationTime
   ├── Gets: Current AnimationFrame from SpriteAnimation
   ├── Allocates: DrawableBitmap from DrawableFactory (fire-and-forget!)
   ├── Configures: texture, size, opacity, flip
   └── Writes: RenderComponent.setDrawable(bitmap)

3. DRAW Phase:
   RenderComponent
   ├── Reads: mDrawable, parent.position
   ├── Calculates: screen position (camera-relative if needed)
   ├── Culls: if not visible at position
   └── Calls: renderSystem.scheduleForDraw(drawable, position, priority)
```

**CRITICAL: Drawables are allocated EVERY FRAME from a pool, configured, passed to RenderComponent, then released back to pool after rendering. This is a "fire-and-forget" pattern!**

### Physics/Collision System Files

| File | Purpose | Key Connections |
|------|---------|-----------------|
| `GravityComponent.java` | Applies gravity to velocity | Phase=PHYSICS |
| `MovementComponent.java` | Updates position from velocity with interpolation | Phase=MOVEMENT |
| `CollisionSystem.java` | Background collision (ray casting through tiles) | Uses line segments from `collision.bin` |
| `BackgroundCollisionComponent.java` | Object vs background collision | Phase=COLLISION_RESPONSE, snaps out of collision |
| `DynamicCollisionComponent.java` | Object vs object collision volumes | Works with animation frame collision volumes |
| `GameObjectCollisionSystem.java` | Broad-phase object-object collision | Updated as a system, not a component |
| `HitReactionComponent.java` | Responds to being hit | Phase=COLLISION_RESPONSE |

#### Movement Pipeline
```
PHYSICS Phase:
├── GravityComponent: velocity.y += gravity * timeDelta

POST_PHYSICS Phase:
├── PhysicsComponent: Apply friction, bounce, air control

MOVEMENT Phase:
├── MovementComponent: 
│   ├── Interpolate velocity towards targetVelocity using acceleration
│   └── position += velocity * timeDelta

COLLISION_RESPONSE Phase:
├── BackgroundCollisionComponent:
│   ├── Cast rays from previous position to current position
│   ├── Find intersections with collision tiles
│   ├── Snap position out of collision
│   └── Set backgroundCollisionNormal on GameObject
```

### Level System Files

| File | Purpose | Key Connections |
|------|---------|-----------------|
| `LevelSystem.java` | Level loading, dimensions, spawning | Loads `.bin` files, creates `TiledWorld` |
| `LevelBuilder.java` | Creates background/foreground layers | Builds `ScrollerComponent` with `TiledVertexGrid` |
| `TiledWorld.java` | 2D array of tile indices | Used for collision, tile rendering, hot spots |
| `HotSpotSystem.java` | Special tile markers for AI/triggers | Used by `PatrolComponent`, NPCs |
| `LevelTree.java` | Level progression structure | Defines which levels unlock which |

#### Level File Format (`.bin`)
```
Byte 0: Signature (must be 96)
Byte 1: Layer count
Byte 2: Background image index
For each layer:
    Byte: Type (0=background, 1=collision, 2=objects, 3=hotspots)
    Byte: Tile index (theme)
    4 Bytes: Scroll speed (float)
    Then: TiledWorld data
        Byte 0: Signature (42)
        4 Bytes: Width (int)
        4 Bytes: Height (int)
        Remaining: Tile data (1 byte per tile)
```

### Camera System Files

| File | Purpose | Key Connections |
|------|---------|-----------------|
| `CameraSystem.java` | Tracks target, handles shake, snaps to world bounds | Updated in `MainLoop` after `GameObjectManager` |
| `CameraBiasComponent.java` | Temporarily biases camera position | Used for look-ahead |

#### Camera Update Flow
```
CameraSystem.update():
├── Apply camera shake if active
├── If target changed recently:
│   └── Ease interpolate to new target
├── Else:
│   ├── Follow target with dead zone (X_FOLLOW_DISTANCE, Y_UP/DOWN_FOLLOW_DISTANCE)
│   └── Apply bias if target is moving
├── Floor focal position (pixel-snap for crisp rendering!)
└── Snap to world bounds
```

### Input System Files

| File | Purpose | Key Connections |
|------|---------|-----------------|
| `InputSystem.java` | Raw input collection | Receives touch/key events from `AndouKun` |
| `InputGameInterface.java` | Converts raw input to game controls | Phase=THINK(?), reads `InputSystem`, sets directional/button state |
| `InputTouchScreen.java` | Touch input state | Multi-touch support |
| `InputKeyboard.java` | Keyboard input state | Key press/release tracking |
| `PlayerComponent.java` | Reads input, controls player | Phase=THINK, reads `InputGameInterface` |

### Time System

| File | Purpose | Key Connections |
|------|---------|-----------------|
| `TimeSystem.java` | Game time, freeze, time scale | Updated FIRST in `MainLoop` |

```java
public class TimeSystem extends BaseObject {
    private float mGameTime;      // Total game time (affected by scale/freeze)
    private float mRealTime;      // Total real time
    private float mFreezeDelay;   // Remaining freeze time
    private float mGameFrameDelta;// This frame's game time delta
    private float mTargetScale;   // Time scale multiplier
    
    @Override
    public void update(float timeDelta, BaseObject parent) {
        mRealTime += timeDelta;
        mRealFrameDelta = timeDelta;
        
        if (mFreezeDelay > 0) {
            mFreezeDelay -= timeDelta;
            mGameFrameDelta = 0.0f;  // Game is frozen!
        } else {
            float scale = calculateScale();  // Handle ease-in/out
            mGameTime += (timeDelta * scale);
            mGameFrameDelta = (timeDelta * scale);
        }
    }
}
```

**MainLoop passes the adjusted `mGameFrameDelta` to all other objects, not the raw timeDelta!**

---

## Complete Update Order

```
MainLoop.update(timeDelta):
│
├── 1. TimeSystem.update(timeDelta)
│       └── Calculates mGameFrameDelta (may be 0 if frozen, scaled, etc.)
│
├── 2. InputGameInterface.update(newTimeDelta)
│       └── Converts raw input to game controls
│
├── 3. GameObjectManager.update(newTimeDelta)
│       │
│       └── For each active GameObject (sorted by x position):
│           │
│           └── GameObject.update(newTimeDelta)  [PhasedObjectManager]
│               │
│               └── For each GameComponent (sorted by phase):
│                   │
│                   ├── Phase 0 THINK: PlayerComponent, AI components
│                   │   └── Set targetVelocity, currentAction
│                   │
│                   ├── Phase 1 PHYSICS: GravityComponent
│                   │   └── velocity += gravity * timeDelta
│                   │
│                   ├── Phase 2 POST_PHYSICS: PhysicsComponent
│                   │   └── Apply friction, air control
│                   │
│                   ├── Phase 3 MOVEMENT: MovementComponent
│                   │   └── position += interpolatedVelocity * timeDelta
│                   │
│                   ├── Phase 4 COLLISION_DETECTION: DynamicCollisionComponent
│                   │   └── Set collision volumes from animation frame
│                   │
│                   ├── Phase 5 COLLISION_RESPONSE: BackgroundCollisionComponent
│                   │   └── Snap out of background, set collision normal
│                   │
│                   ├── Phase 6 POST_COLLISION: (various)
│                   │   └── Position is final
│                   │
│                   ├── Phase 7 ANIMATION: AnimationComponent
│                   │   └── Select animation based on state
│                   │
│                   ├── Phase 8 PRE_DRAW: SpriteComponent
│                   │   └── Get frame, allocate DrawableBitmap, set on RenderComponent
│                   │
│                   ├── Phase 9 DRAW: RenderComponent
│                   │   └── scheduleForDraw() to RenderSystem
│                   │
│                   └── Phase 10 FRAME_END: (cleanup)
│
├── 4. CameraSystem.update(newTimeDelta)
│       └── Update focal position based on target
│
├── 5. GameObjectCollisionSystem.update(newTimeDelta)
│       └── Object-to-object collision detection
│
├── 6. HudSystem.update(newTimeDelta)
│       └── UI elements
│
└── 7. CollisionSystem.update(newTimeDelta)
        └── Swap temporary collision surfaces
```

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
│   ├── anim/                # Android View Animation XMLs (UI transitions, NOT game sprites)
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
│   └── ... (100+ Java files documented above)
└── tools/
    └── ExtractPoints.js     # Photoshop script for collision extraction
```

### Android View Animation XMLs (`Original/res/anim/`)

**⚠️ Important Clarification**: The `anim/` folder contains **Android View Animation XMLs** - these are NOT game sprite animations! These files define UI transition effects for the Android framework, used for screen transitions, menu animations, and cutscene sequences.

#### What These Files Are

Android View Animations are XML-defined transformations (alpha/fade, translate/slide, scale, rotate) applied to Android UI Views (Activities, Buttons, ImageViews). They are loaded via `AnimationUtils.loadAnimation()` and applied to views with `view.startAnimation()`.

#### Animation Categories

| Category | Files | Purpose | Used By |
|----------|-------|---------|---------|
| **Activity Transitions** | `activity_fade_in.xml`, `activity_fade_out.xml` | Fade effects between Android Activities/screens | All Activity transitions via `overridePendingTransition()` |
| **Button Effects** | `button_flicker.xml`, `button_slide.xml`, `ui_button.xml` | Button press feedback and selection highlights | `MainMenuActivity`, `LevelSelectActivity`, `DifficultyMenuActivity` |
| **Menu Slides** | `menu_show_left.xml`, `menu_show_right.xml`, `menu_hide_left.xml`, `menu_hide_right.xml` | Sliding menu panel animations | Menu UI transitions |
| **Fade Effects** | `fade.xml`, `fade_in.xml`, `fade_out.xml`, `fade_in_out.xml` | Alpha transitions for UI elements | `DiaryActivity`, `ExtrasMenuActivity` |
| **Wait/Loading** | `wait_message_fade.xml` | Pulsing fade for loading messages | `AndouKun.java` (main game activity) |
| **Cutscene: Kyle Death** | `kyle_fall.xml` | Frame-by-frame death animation (16 frames) | `AnimationPlayerActivity` (KYLE_DEATH) |
| **Cutscene: Endings** | `wanda_game_over.xml`, `kabocha_game_over.xml`, `rokudou_game_over.xml` | Game over text slide-in animations | `AnimationPlayerActivity` |
| **Cutscene: Parallax** | `horizontal_layer1_slide.xml`, `horizontal_layer2_slide.xml`, `rokudou_slide_*.xml` | Multi-layer parallax scrolling for endings | `AnimationPlayerActivity` |

#### Animation Types in Detail

**Alpha (Fade) Animations:**
```xml
<!-- activity_fade_in.xml: Fade from transparent to opaque -->
<alpha android:fromAlpha="0.0" android:toAlpha="1.0" android:duration="500" />

<!-- button_flicker.xml: Flicker 7 times for button feedback -->
<alpha android:fromAlpha="1.0" android:toAlpha="0.0" 
       android:duration="100" android:repeatCount="7" android:repeatMode="reverse" />
```

**Translate (Slide) Animations:**
```xml
<!-- menu_show_left.xml: Slide in from off-screen -->
<translate android:fromXDelta="960" android:toXDelta="0" android:duration="700" />

<!-- horizontal_layer1_slide.xml: Slow parallax scroll for cutscene -->
<translate android:fromXDelta="0" android:toXDelta="-170" 
           android:duration="6000" android:startOffset="2000" />
```

**Frame-by-Frame Animations:**
```xml
<!-- kyle_fall.xml: 16-frame death sequence -->
<animation-list android:oneshot="true">
    <item android:drawable="@drawable/anime_kyle_fall01" android:duration="83" />
    <item android:drawable="@drawable/anime_kyle_fall02" android:duration="83" />
    <!-- ... 14 more frames -->
</animation-list>
```

#### Web Port Equivalents

| Original Android | Web Port Equivalent | Status |
|------------------|---------------------|--------|
| `activity_fade_in/out.xml` | `FadeTransition.tsx` component | ✅ Implemented |
| `button_flicker.xml` | CSS animations or React state | ✅ CSS hover/active states |
| `fade.xml`, `fade_in/out.xml` | `FadeTransition.tsx` | ✅ Implemented |
| `menu_show/hide_*.xml` | React transitions/Framer Motion | ✅ React state transitions |
| `kyle_fall.xml` (cutscene) | Canvas animation or React component | ❌ Not implemented |
| `*_game_over.xml` (cutscene) | React animation components | ❌ Not implemented |
| `horizontal_layer*_slide.xml` | CSS keyframes or Canvas parallax | ❌ Not implemented |
| `rokudou_slide_*.xml` | Multi-layer parallax animation | ❌ Not implemented |

#### Key Differences: Android vs Web

1. **Android**: Animations are declarative XML, applied to View objects via the Android animation framework
2. **Web Port**: Uses React state/CSS transitions for UI, Canvas API for game rendering
3. **Game Sprite Animations**: Are NOT in `anim/` folder - they're defined programmatically in `GameObjectFactory.java` and `SpriteAnimation.java` using texture coordinates

#### Implementation Notes for Web Port

**Implemented (via `FadeTransition.tsx`):**
- Screen fade in/out for level transitions
- Black screen for loading states
- Customizable duration and color

**Not Yet Implemented:**
- Cutscene player for death/ending sequences
- Frame-by-frame animation playback (kyle_fall)
- Multi-layer parallax cutscene animations
- Button flicker/slide effects (low priority, CSS can handle)

### Key Architecture Concepts (Original)

1. **Dual-Threaded Rendering**: Game thread updates logic, render thread draws. They sync via double-buffered queue.
2. **Phased Component Execution**: Components execute in strict order (THINK→PHYSICS→MOVEMENT→COLLISION→ANIMATION→DRAW)
3. **Fire-and-Forget Drawables**: `SpriteComponent` allocates a fresh `DrawableBitmap` each frame from a pool
4. **Object Activation by Distance**: `GameObjectManager` only updates objects within activation radius of camera
5. **Global System Registry**: All systems accessible via `BaseObject.sSystemRegistry`

### Web Port (`/` - Root Directory)

The React + Canvas web port will live in the repository root:

```
/
├── CLAUDE.md                # This file
├── LICENSE                  # Project license
├── README.md                # Project overview
├── Original/                # Original Android source (reference)
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
├── eslint.config.js         # ESLint configuration
├── vite.config.ts           # Vite build configuration
├── index.html               # HTML entry point
├── public/                  # Static assets
│   ├── assets/              # Game assets (sprites, sounds, levels)
│   │   ├── sprites/         # Converted sprite sheets
│   │   ├── sounds/          # Converted audio files (MP3/WebAudio)
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
    │   ├── RenderSystem.ts  # Render queue management
    │   ├── InputSystem.ts   # Keyboard/touch input handling
    │   ├── CollisionSystem.ts
    │   ├── CameraSystem.ts
    │   ├── TimeSystem.ts
    │   ├── HotSpotSystem.ts
    │   ├── AnimationSystem.ts
    │   └── SoundSystem.ts   # Web Audio API
    ├── entities/            # Game objects and components
    │   ├── GameObject.ts
    │   ├── GameComponent.ts
    │   ├── GameObjectManager.ts
    │   ├── GameObjectFactory.ts
    │   └── components/      # Component implementations
    │       ├── GravityComponent.ts
    │       ├── MovementComponent.ts
    │       ├── SpriteComponent.ts
    │       ├── RenderComponent.ts
    │       ├── AnimationComponent.ts
    │       └── BackgroundCollisionComponent.ts
    ├── levels/              # Level loading and management
    │   ├── LevelParser.ts
    │   ├── LevelSystem.ts
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

## ⚠️ Critical Porting Requirements

### 1. Component Phase Ordering

**The web port MUST execute components in the correct phase order:**

```typescript
enum ComponentPhase {
    THINK = 0,              // AI decisions, input reading
    PHYSICS = 1,            // Apply gravity, forces
    POST_PHYSICS = 2,       // Friction, air control
    MOVEMENT = 3,           // Update position
    COLLISION_DETECTION = 4,// Set collision volumes
    COLLISION_RESPONSE = 5, // Resolve collisions
    POST_COLLISION = 6,     // Position is final
    ANIMATION = 7,          // Select animation
    PRE_DRAW = 8,           // Prepare drawable
    DRAW = 9,               // Schedule for rendering
    FRAME_END = 10,         // Cleanup
}
```

Each component must set its phase in the constructor and the `GameObject` must sort components by phase before updating.

### 2. Fire-and-Forget Drawable Pattern

**Original Pattern (MUST replicate):**
```java
// SpriteComponent.update() - PRE_DRAW phase
DrawableBitmap bitmap = factory.allocateDrawableBitmap();  // Get from pool
bitmap.setTexture(currentFrame.texture);
bitmap.setWidth(mWidth);
bitmap.setHeight(mHeight);
bitmap.setOpacity(mOpacity);
bitmap.setFlip(facingLeft, false);
render.setDrawable(bitmap);  // Pass to RenderComponent

// RenderComponent.update() - DRAW phase
renderSystem.scheduleForDraw(mDrawable, position, priority, cameraRelative);

// After rendering, drawable is released back to pool
```

**Why this matters:** The original creates a NEW drawable configuration each frame. The drawable object is pooled, but its state (texture, flip, opacity) is set fresh each frame. This allows different animation frames, flip states, and opacity values without any state management complexity.

### 3. Render Queue (Not Immediate Drawing)

**The web port should NOT draw immediately!** Instead:
1. Components call `scheduleForDraw()` during DRAW phase
2. Queue is sorted by priority (for proper layering)
3. After all updates, queue is rendered to canvas
4. Queue is cleared

This pattern allows:
- Proper z-ordering (priority-based sorting)
- Camera offset applied during rendering
- Potential batching optimizations
- Culling of off-screen objects

### 4. Camera-Relative vs Absolute Positioning

Some objects are camera-relative (move with the world), others are absolute (HUD elements). The original tracks this per-drawable:

```java
// RenderElement has cameraRelative flag
if (element.cameraRelative) {
    x = (element.x - cameraX) + halfWidth;
    y = (element.y - cameraY) + halfHeight;
}
```

### 5. TimeSystem Integration

**Always use TimeSystem's frame delta, not raw delta:**
```typescript
// BAD - doesn't handle freeze, time scale
update(rawDelta: number) {
    this.position.x += this.velocity.x * rawDelta;
}

// GOOD - respects TimeSystem
update(rawDelta: number) {
    const gameDelta = timeSystem.getFrameDelta();  // May be 0 if frozen!
    this.position.x += this.velocity.x * gameDelta;
}
```

### 6. Object Activation by Distance

`GameObjectManager` only updates objects within their `activationRadius` of the camera:
```java
final float distance2 = cameraFocus.distance2(gameObject.getPosition());
if (distance2 < (gameObject.activationRadius * gameObject.activationRadius)) {
    gameObject.update(timeDelta, this);
} else {
    // Move to inactive list
    mInactiveObjects.add(gameObject);
}
```

Objects far from the camera are NOT updated, saving CPU. They're re-activated when the camera approaches.

---

## UI/UX Design Requirements

### Phone Frame Navigation

The game UI is designed to look like an Android phone with a physical frame around the game canvas. The phone frame includes physical-style buttons that must be functional:

#### Back Button Implementation
- The **back "physical button"** on the phone frame UI must function as a navigation control
- Pressing the back button should **return the user to the previous screen**:
  - From gameplay → Main Menu
  - From Level Select → Main Menu
  - From Options Menu → Main Menu (or previous screen)
  - From Pause Menu → Resume Game or Main Menu
- Implement a **navigation stack** to properly track screen history
- The back button should respect game state (e.g., may prompt to save/confirm during gameplay)

### User Data Persistence

Implement persistent storage for user data using **Zustand** with **local storage** persistence:

#### Zustand Store Requirements
- Create a Zustand store for user/game state that persists across sessions
- Use the `persist` middleware to automatically sync with `localStorage`

#### Data to Persist
- **Game Progress**: Completed levels, unlocked content, current level
- **Player Stats**: High scores, total play time, achievements
- **User Preferences**: Sound volume, music volume, control preferences, difficulty settings
- **Inventory**: Collected items, pearls, unlockables

#### Implementation Pattern
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserDataState {
  // Progress
  completedLevels: string[];
  currentLevel: string;
  
  // Stats
  highScores: Record<string, number>;
  totalPlayTime: number;
  
  // Preferences
  soundVolume: number;
  musicVolume: number;
  
  // Actions
  completeLevel: (levelId: string, score: number) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  resetProgress: () => void;
}

export const useUserDataStore = create<UserDataState>()(
  persist(
    (set, get) => ({
      // Initial state and actions
    }),
    {
      name: 'replica-island-user-data', // localStorage key
    }
  )
);
```

#### Storage Key Convention
- Use the prefix `replica-island-` for all localStorage keys
- Primary store key: `replica-island-user-data`

---

## Coding Conventions

### Technology Stack

- **Framework**: React 19 with TypeScript and React Compiler
- **Build Tool**: Vite
- **Runtime**: Bun
- **Rendering**: HTML5 Canvas 2D API
- **Audio**: Web Audio API
- **Styling**: CSS Modules or Tailwind CSS
- **State Management**: 
  - React Context for game runtime state
  - **Zustand with persist middleware** for user data persistence (progress, settings, high scores)
- **Storage**: localStorage via Zustand persist middleware

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

- Bun runtime (https://bun.sh/)
- Modern web browser with Canvas support

### Development Setup

```bash
# Clone the repository
git clone https://github.com/evgenyvinnik/ReplicaIslandReborn.git
cd ReplicaIslandReborn

# Install dependencies
bun install

# Start development server
bun run dev

# Open browser at http://localhost:5173
```

### Available Scripts

```bash
bun run dev        # Start Vite dev server with hot reload
bun run build      # Build for production
bun run preview    # Preview production build locally
bun run lint       # Run ESLint
bun run lint:fix   # Run ESLint with auto-fix
bun run typecheck  # Run TypeScript type checking
bun test           # Run tests
```

### Building for Production

```bash
bun run build
# Output will be in /dist folder
# Deploy the dist folder to any static hosting (Vercel, Netlify, GitHub Pages)
```

---

## Important Gotchas and Things to Know

### Porting Challenges

1. **Binary Level Data**: The original game uses `.bin` files for levels. These need to be:
   - Reverse-engineered or converted to JSON format
   - The `LevelBuilder.java` file shows how levels are loaded
   - Format: signature(1) + layerCount(1) + bgIndex(1) + [layer data...]
   - Each layer: type(1) + tileIndex(1) + scrollSpeed(4 float) + TiledWorld data

2. **Collision System**: The collision data (`collision.bin`) contains line segments and normals.
   - Reference `ExtractPoints.js` in tools for format understanding
   - `CollisionSystem.java` uses Bresenham line algorithm for ray casting
   - Collision tiles contain arrays of `LineSegment` with normals

3. **OpenGL to Canvas**: Original uses OpenGL ES for rendering.
   - Canvas 2D is sufficient for this 2D platformer
   - Original uses `glDrawTexfOES` extension for fast bitmap drawing
   - `TiledVertexGrid` uses vertex buffers - convert to simple tile-by-tile drawing

4. **Object Pooling**: The original heavily uses object pools to avoid GC pauses.
   - `DrawableFactory` pools `DrawableBitmap` objects
   - `RenderElementPool` pools render queue entries  
   - `GameComponentPool` pools component instances
   - `HitPointPool` pools collision hit results

5. **Input System**: Original handles Android touch, D-pad, trackball.
   - Web version needs: keyboard, mouse/touch, gamepad API
   - Mobile web needs virtual joystick overlay
   - `InputGameInterface` converts raw input to game-level controls

### ⚠️ Animation System - Critical Details

**The original animation system is MORE than just playing frames!**

1. **Animation Frame = Texture + Collision Volumes**
   ```java
   public class AnimationFrame {
       public Texture texture;
       public float holdTime;
       FixedSizeArray<CollisionVolume> attackVolumes;      // Hitboxes!
       FixedSizeArray<CollisionVolume> vulnerabilityVolumes; // Hurtboxes!
   }
   ```
   
2. **Animation Selection is State-Based**
   - `AnimationComponent` (player) checks velocity, action, touching ground
   - `GenericAnimationComponent` maps `ActionType` to animation index
   - Animation doesn't just "play" - it's constantly re-evaluated each frame

3. **SpriteComponent Flow (PRE_DRAW phase)**
   ```java
   mAnimationTime += timeDelta;  // Accumulate time
   AnimationFrame frame = currentAnimation.getFrame(mAnimationTime);
   
   DrawableBitmap bitmap = factory.allocateDrawableBitmap();  // POOL!
   bitmap.setTexture(frame.texture);
   bitmap.setFlip(facingDirection.x < 0, facingDirection.y < 0);
   renderComponent.setDrawable(bitmap);
   
   // Also update collision volumes!
   collisionComponent.setCollisionVolumes(frame.attackVolumes, frame.vulnerabilityVolumes);
   ```

4. **Animation Frame Selection**
   ```java
   public AnimationFrame getFrame(float animationTime) {
       float cycleTime = mLoop ? (animationTime % mLength) : animationTime;
       // Binary search or linear search through frame start times
       // Return frame where cycleTime falls within holdTime
   }
   ```

### ⚠️ Rendering System - Critical Details

**The original does NOT draw during update! It queues draw commands.**

1. **RenderComponent (DRAW phase) queues, doesn't draw:**
   ```java
   mPositionWorkspace.set(parent.getPosition());
   mPositionWorkspace.add(mDrawOffset);
   
   if (mDrawable.visibleAtPosition(screenLocation)) {
       system.scheduleForDraw(mDrawable, mPositionWorkspace, mPriority, mCameraRelative);
   } else {
       // Release back to pool immediately if culled!
       drawableFactory.release(mDrawable);
       mDrawable = null;
   }
   ```

2. **RenderSystem sorts by priority for layering:**
   ```java
   public class RenderElement {
       DrawableObject mDrawable;
       float x, y;
       boolean cameraRelative;
       int phase;  // Based on priority + texture sorting
   }
   ```

3. **Priority determines layer order (from `SortConstants`):**
   - `BACKGROUND_START = -100`
   - `FOREGROUND = 0` (normal objects)
   - `OVERLAY = 50` (HUD, effects)
   
4. **Camera offset applied during render, not during update:**
   ```java
   // In GameRenderer.onDrawFrame():
   if (element.cameraRelative) {
       x = (element.x - mCameraX) + mHalfWidth;
       y = (element.y - mCameraY) + mHalfHeight;
   }
   element.mDrawable.draw(x, y, scaleX, scaleY);
   ```

### ⚠️ Coordinate System

**Original uses OpenGL coordinates: origin at BOTTOM-LEFT, Y increases UP!**

```
(0, height) ─────────────────── (width, height)
     │                              │
     │           Screen             │
     │                              │
     │                              │
  (0, 0) ──────────────────────── (width, 0)
```

Web Canvas is TOP-LEFT origin with Y increasing DOWN. You must:
- Flip Y when rendering: `canvasY = canvasHeight - worldY`
- Or use `ctx.scale(1, -1)` and `ctx.translate(0, -height)`

### Asset Conversion

1. **Sprites**: Original likely uses texture atlases with OpenGL.
   - Extract and convert to PNG sprite sheets
   - Consider using a sprite sheet packing tool
   - Individual textures per animation frame (not sprite sheets!)

2. **Audio**: OGG files need conversion for broader browser support.
   - Convert to MP3 or use multiple formats
   - Web Audio API for sound effects
   - Handle audio autoplay restrictions

3. **Levels**: Binary `.bin` files need parsing.
   - Study `LevelBuilder.java` and `TiledWorld.java`
   - Convert to JSON for easier web consumption
   - Format documented in Level System Files section above

### Performance Considerations

1. **Game Loop**: Use `requestAnimationFrame` with delta time.
   - Original uses fixed timestep; consider similar approach
   - Reference `GameThread.java` for timing logic
   - Cap delta at 100ms to prevent physics explosions
   - Target 60fps (16.67ms per frame)

2. **Canvas Optimization**:
   - Minimize canvas state changes
   - Use offscreen canvases for complex backgrounds
   - Consider layer separation (background, game, UI)
   - Batch draw calls where possible (e.g., tiles)

3. **Mobile Performance**:
   - Test on low-end mobile devices
   - Implement quality settings if needed
   - Watch memory usage on mobile Safari
   - Object pooling is critical for mobile

### Browser Compatibility

- Target modern browsers (Chrome, Firefox, Safari, Edge)
- Test touch input on iOS Safari and Android Chrome
- Handle visibility change (pause when tab hidden)
- Implement proper fullscreen support

### Original Game Loop Reference (Detailed)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRAME START                                      │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  GameThread.run()                                                            │
│  ├── Wait for render thread to finish previous frame                         │
│  ├── Calculate time delta (capped at 100ms)                                  │
│  ├── Only update if delta > 12ms (cap at ~83fps)                            │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  MainLoop.update(timeDelta)                                                  │
│  ├── TimeSystem.update(timeDelta)  ← Calculates gameFrameDelta               │
│  └── super.update(gameFrameDelta)  ← Updates children with GAME time         │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  InputGameInterface.update(gameFrameDelta)                                   │
│  └── Convert raw input → game controls (left, right, jump, attack)          │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  GameObjectManager.update(gameFrameDelta)                                    │
│  ├── For each ACTIVE object (within activation radius):                      │
│  │   └── GameObject.update(gameFrameDelta)                                   │
│  │       └── For each component (sorted by phase):                           │
│  │           ├── THINK: PlayerComponent, AI                                  │
│  │           ├── PHYSICS: GravityComponent                                   │
│  │           ├── POST_PHYSICS: PhysicsComponent                              │
│  │           ├── MOVEMENT: MovementComponent                                 │
│  │           ├── COLLISION_DETECTION: DynamicCollisionComponent              │
│  │           ├── COLLISION_RESPONSE: BackgroundCollisionComponent            │
│  │           ├── POST_COLLISION: various                                     │
│  │           ├── ANIMATION: AnimationComponent                               │
│  │           ├── PRE_DRAW: SpriteComponent → creates DrawableBitmap          │
│  │           ├── DRAW: RenderComponent → scheduleForDraw()                   │
│  │           └── FRAME_END: cleanup                                          │
│  └── Move inactive objects to inactive list                                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  CameraSystem.update(gameFrameDelta)                                         │
│  ├── Apply shake                                                             │
│  ├── Follow target with dead zone                                            │
│  ├── Ease to new target if target changed                                    │
│  ├── Apply bias from camera bias components                                  │
│  └── Snap to world bounds                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Other Systems: GameObjectCollisionSystem, HudSystem, CollisionSystem        │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  RenderSystem.swap(renderer, cameraX, cameraY)                               │
│  ├── Commit pending additions to render queue                                │
│  ├── Pass filled queue to renderer                                           │
│  ├── Clear previous queue, release drawables back to pool                    │
│  └── Swap queue index (0 → 1 → 0 → ...)                                      │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  GameRenderer.onDrawFrame(gl) [RENDER THREAD]                                │
│  ├── Wait for new queue (blocks until swap())                                │
│  ├── Set up OpenGL state                                                     │
│  ├── For each RenderElement (sorted by priority):                            │
│  │   ├── Apply camera offset if cameraRelative                               │
│  │   └── element.drawable.draw(x, y, scaleX, scaleY)                        │
│  └── Restore OpenGL state                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Sleep if frame completed in < 16ms                                          │
│                              FRAME END                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Original File List with Purposes

### Core Systems (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `AndouKun.java` | 769 | Android Activity, main entry point |
| `Game.java` | 571 | Bootstrap, system creation |
| `GameThread.java` | 148 | Game loop timing |
| `MainLoop.java` | 42 | Game graph root, TimeSystem integration |
| `GameRenderer.java` | 303 | OpenGL rendering |
| `BaseObject.java` | 48 | Abstract base class |
| `ObjectManager.java` | 145 | Object container |
| `PhasedObject.java` | 42 | Phase-based object |
| `PhasedObjectManager.java` | 102 | Sorted object manager |
| `ObjectRegistry.java` | 83 | Global system registry |

### Entity/Component System (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `GameObject.java` | 232 | Game entity |
| `GameComponent.java` | 51 | Component base class |
| `GameObjectManager.java` | 201 | Entity activation by distance |
| `GameObjectFactory.java` | 6773 | Entity spawning (HUGE!) |
| `GameComponentPool.java` | 55 | Component pooling |
| `GameObjectPool.java` | 44 | Entity pooling |

### Rendering (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `RenderSystem.java` | 143 | Double-buffered queue |
| `RenderComponent.java` | 109 | Schedules drawing |
| `DrawableObject.java` | 58 | Drawable base class |
| `DrawableBitmap.java` | 229 | Bitmap drawing |
| `DrawableFactory.java` | 149 | Drawable pooling |
| `ScrollableBitmap.java` | ~100 | Parallax background |
| `TiledVertexGrid.java` | 217 | Tile map rendering |
| `TiledBackgroundVertexGrid.java` | ~50 | Background tiles |
| `ScrollerComponent.java` | 119 | Parallax scrolling |
| `SortConstants.java` | ~20 | Priority constants |

### Animation (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `SpriteComponent.java` | 222 | Sprite management |
| `SpriteAnimation.java` | 99 | Animation definition |
| `AnimationFrame.java` | 49 | Frame data |
| `AnimationComponent.java` | 387 | Player animation |
| `GenericAnimationComponent.java` | 83 | Generic animation |
| `EnemyAnimationComponent.java` | ~300 | Enemy animation |
| `ButtonAnimationComponent.java` | ~100 | Button animation |
| `DoorAnimationComponent.java` | ~100 | Door animation |
| `FixedAnimationComponent.java` | ~50 | Static animation |
| `FadeDrawableComponent.java` | ~80 | Fade effects |

### Physics/Movement (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `GravityComponent.java` | 60 | Gravity |
| `MovementComponent.java` | 64 | Position update |
| `PhysicsComponent.java` | ~200 | Friction, bounce |
| `SimplePhysicsComponent.java` | ~100 | Simple physics |
| `Interpolator.java` | ~80 | Velocity interpolation |
| `Lerp.java` | ~50 | Linear interpolation |

### Collision (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `CollisionSystem.java` | 859 | Background collision |
| `CollisionVolume.java` | ~50 | Collision shape base |
| `AABoxCollisionVolume.java` | ~100 | Axis-aligned box |
| `SphereCollisionVolume.java` | ~100 | Circle collision |
| `BackgroundCollisionComponent.java` | 424 | Object vs world |
| `DynamicCollisionComponent.java` | ~150 | Object vs object |
| `GameObjectCollisionSystem.java` | ~300 | Broad phase |
| `HitReactionComponent.java` | ~300 | Hit responses |
| `HitPlayerComponent.java` | ~100 | Player hit |
| `CollisionParameters.java` | ~50 | Collision constants |
| `HitPoint.java` | ~30 | Hit result |
| `HitPointPool.java` | ~40 | Hit pooling |
| `LineSegment.java` | ~50 | Collision segment |

### Level System (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `LevelSystem.java` | 224 | Level management |
| `LevelBuilder.java` | 190 | Level construction |
| `TiledWorld.java` | 136 | Tile data |
| `HotSpotSystem.java` | 165 | AI hot spots |
| `LevelTree.java` | ~300 | Level progression |

### Camera (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `CameraSystem.java` | 226 | Camera following |
| `CameraBiasComponent.java` | ~50 | Camera bias |

### Input (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `InputSystem.java` | 142 | Raw input |
| `InputGameInterface.java` | ~300 | Game controls |
| `InputTouchScreen.java` | ~150 | Touch handling |
| `InputKeyboard.java` | ~100 | Keyboard handling |
| `InputXY.java` | ~50 | 2D input |
| `InputButton.java` | ~50 | Button state |

### Time (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `TimeSystem.java` | 112 | Game time |

### Sound (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `SoundSystem.java` | ~300 | Audio playback |

### Player (must port)
| File | Lines | Purpose |
|------|-------|---------|
| `PlayerComponent.java` | ~500 | Player logic |
| `InventoryComponent.java` | ~100 | Inventory |
| `MotionBlurComponent.java` | ~80 | Motion blur |

### AI Components (port as needed)
| File | Purpose |
|------|---------|
| `PatrolComponent.java` | Walk back and forth |
| `AttackAtDistanceComponent.java` | Ranged attack |
| `LaunchProjectileComponent.java` | Shoot bullets |
| `LifetimeComponent.java` | Self-destruct timer |
| `GhostComponent.java` | Ghost behavior |
| `NPCComponent.java` | NPC dialog |
| `PopOutComponent.java` | Pop-out enemies |
| `SleeperComponent.java` | Wake on proximity |
| `LauncherComponent.java` | Launch objects |
| `SolidSurfaceComponent.java` | Moving platforms |
| `TheSourceComponent.java` | Final boss |

### Utility (must port)
| File | Purpose |
|------|---------|
| `Vector2.java` | 2D vector |
| `FixedSizeArray.java` | Custom array |
| `TObjectPool.java` | Generic pool |
| `Utils.java` | Math utilities |
| `DebugLog.java` | Logging |
| `AllocationGuard.java` | Debug allocation |
| `ContextParameters.java` | Screen/game params |

---

## Resources

- [Original Replica Island Source](https://code.google.com/archive/p/replicaisland/)
- [Game Programming Patterns](https://gameprogrammingpatterns.com/) - For architecture reference
- [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
