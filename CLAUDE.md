# CLAUDE.md - Project Guide for ReplicaIslandReborn

## Project Overview

This project is a web port of **Replica Island**, one of the earliest and most popular open-source Android games. The original game was written in Java for Android by Chris Pruett and Genki Mine, released under the Apache 2.0 license.

### About Replica Island

Replica Island is a side-scrolling platformer starring the Android robot as its protagonist on a dangerous mission to find a mysterious power source. The game includes all art, dialog, level layouts, and other data along with the code.

---

## 🎮 Web Port Status (Current Implementation)

### Technology Stack
- **Framework**: React 19 + TypeScript with Vite
- **Rendering**: HTML5 Canvas 2D API
- **Audio**: Web Audio API
- **State Management**: Zustand (persistent) + React Context (runtime)
- **Build Tool**: Vite with Bun runtime

### Implementation Progress Summary

| Category | Status | Details |
|----------|--------|---------|
| **Core Engine** | ✅ 95% | 15 systems implemented |
| **Components** | ✅ 85% | 23 of ~27 components ported |
| **UI/Screens** | ✅ 90% | 17 React components |
| **Levels** | ✅ 100% | 40+ levels working |
| **Sound** | ✅ 100% | All SFX loaded and playing |
| **Music** | ❌ 0% | MIDI needs conversion |
| **Cutscenes** | ❌ 0% | AnimationPlayer not implemented |
| **Ghost Mechanic** | ❌ 0% | GhostComponent not ported |

### Implemented Engine Systems (15 total)

| System | File | Status | Notes |
|--------|------|--------|-------|
| SystemRegistry | `SystemRegistry.ts` | ✅ | Global system access (matches ObjectRegistry.java) |
| GameLoop | `GameLoop.ts` | ✅ | requestAnimationFrame with fixed timestep |
| TimeSystem | `TimeSystem.ts` | ✅ | Game time, freeze, time scale |
| InputSystem | `InputSystem.ts` | ✅ | Keyboard, touch, gamepad support |
| CameraSystem | `CameraSystem.ts` | ✅ | Following, shake, NPC focus, bounds |
| CollisionSystem | `CollisionSystem.ts` | ✅ | Tile-based background collision |
| GameObjectCollisionSystem | `GameObjectCollisionSystem.ts` | ✅ | Object-to-object sweep-and-prune |
| RenderSystem | `RenderSystem.ts` | ✅ | Canvas 2D with render queue, z-sorting |
| AnimationSystem | `AnimationSystem.ts` | ✅ | Frame timing, binary search lookup |
| SoundSystem | `SoundSystem.ts` | ✅ | Web Audio API, 32 concurrent sounds |
| HotSpotSystem | `HotSpotSystem.ts` | ✅ | 50+ hot spot types for AI/triggers |
| ChannelSystem | `ChannelSystem.ts` | ✅ | Event pub/sub (buttons → doors) |
| DialogSystem | `DialogSystem.ts` | ✅ | Conversation state machine |
| EffectsSystem | `EffectsSystem.ts` | ✅ | Explosions, smoke, dust particles |
| GameFlowEvent | `GameFlowEvent.ts` | ✅ | Level transitions, dialog triggers |

### Implemented Components (23 total)

| Component | Phase | Original | Status |
|-----------|-------|----------|--------|
| PlayerComponent | THINK | PlayerComponent.java | ✅ |
| PhysicsComponent | PHYSICS | PhysicsComponent.java | ✅ |
| MovementComponent | MOVEMENT | MovementComponent.java | ✅ |
| SpriteComponent | DRAW | SpriteComponent.java | ✅ |
| BackgroundCollisionComponent | COLLISION_RESPONSE | BackgroundCollisionComponent.java | ✅ |
| DynamicCollisionComponent | FRAME_END | DynamicCollisionComponent.java | ✅ |
| HitReactionComponent | PRE_DRAW | HitReactionComponent.java | ✅ |
| HitPlayerComponent | COLLISION_DETECTION | HitPlayerComponent.java | ✅ |
| InventoryComponent | THINK | InventoryComponent.java | ✅ |
| PatrolComponent | THINK | PatrolComponent.java | ✅ |
| EnemyAnimationComponent | ANIMATION | EnemyAnimationComponent.java | ✅ |
| NPCComponent | THINK | NPCComponent.java | ✅ |
| NPCAnimationComponent | ANIMATION | NPCAnimationComponent.java | ✅ |
| GenericAnimationComponent | ANIMATION | GenericAnimationComponent.java | ✅ |
| ButtonAnimationComponent | ANIMATION | ButtonAnimationComponent.java | ✅ |
| DoorAnimationComponent | ANIMATION | DoorAnimationComponent.java | ✅ |
| LauncherComponent | THINK | LauncherComponent.java | ✅ |
| LaunchProjectileComponent | POST_COLLISION | LaunchProjectileComponent.java | ✅ |
| SleeperComponent | THINK | SleeperComponent.java | ✅ |
| PopOutComponent | THINK | PopOutComponent.java | ✅ |
| AttackAtDistanceComponent | THINK | AttackAtDistanceComponent.java | ✅ |
| LifetimeComponent | THINK | LifetimeComponent.java | ✅ |
| TheSourceComponent | THINK | TheSourceComponent.java | ✅ |

### NOT Yet Implemented Components

| Component | Original | Priority | Notes |
|-----------|----------|----------|-------|
| GhostComponent | GhostComponent.java | HIGH | Possession mechanic |
| GravityComponent | GravityComponent.java | MEDIUM | Custom gravity zones |
| CameraBiasComponent | CameraBiasComponent.java | MEDIUM | Camera look-ahead |
| ChangeComponentsComponent | ChangeComponentsComponent.java | LOW | Dynamic component swapping |
| OrbitalMagnetComponent | OrbitalMagnetComponent.java | LOW | Collectible attraction |
| MotionBlurComponent | MotionBlurComponent.java | LOW | Visual effect |
| FadeDrawableComponent | FadeDrawableComponent.java | LOW | Per-object fade |

### React UI Components (17 total)

| Component | Purpose |
|-----------|---------|
| `Game.tsx` | Main game canvas, system orchestration (~1700 lines) |
| `MainMenu.tsx` | Title screen with original assets |
| `LevelSelect.tsx` | Level grid with unlock states |
| `DifficultyMenu.tsx` | Baby/Kids/Adults selection |
| `OptionsMenu.tsx` | Settings and key bindings |
| `PauseMenu.tsx` | In-game pause overlay |
| `HUD.tsx` | Fuel bar, coin/ruby counters, FPS |
| `GameOverScreen.tsx` | Death screen with retry |
| `LevelCompleteScreen.tsx` | Victory stats and next level |
| `DialogOverlay.tsx` | NPC conversation display |
| `LoadingScreen.tsx` | Level loading progress |
| `OnScreenControls.tsx` | Mobile virtual joystick |
| `FadeTransition.tsx` | Screen transitions |
| `PhoneFrame.tsx` | Android phone bezel aesthetic |
| `AndroidHomeScreen.tsx` | Fake home screen for immersion |
| `AndroidRecentsScreen.tsx` | Fake recents view |
| `SoundControls.tsx` | Volume controls |

---

## CRITICAL: Original Implementation Architecture

### ⚠️ Important Notes for Porting

The original Replica Island uses a sophisticated **multi-threaded dual-buffered rendering architecture** with **phased component execution**. This is fundamentally different from typical single-threaded web game loops. Understanding this architecture is crucial for a correct port.

---

## Original Architecture Deep Dive

### Object Pooling System (Critical for Performance)

The original game uses extensive object pooling to avoid garbage collection pauses:

#### Base Pool Architecture (`ObjectPool.java`, `TObjectPool.java`)
```java
public abstract class ObjectPool extends BaseObject {
    private FixedSizeArray<Object> mAvailable;
    private static final int DEFAULT_SIZE = 32;
    
    protected Object allocate() {
        return mAvailable.removeLast();  // Assert if exhausted!
    }
    
    public void release(Object entry) {
        mAvailable.add(entry);
    }
}
```

#### Pool Sizes in GameObjectFactory
```java
MAX_GAME_OBJECTS = 384;
COLLISION_RECORD_POOL_SIZE = 256;

// Component pools:
RenderComponent: 384
SpriteComponent: 384
LifetimeComponent: 384
BackgroundCollisionComponent: 192
EnemyAnimationComponent: 256
PatrolComponent: 256
HitReactionComponent: 256
DoorAnimationComponent: 256
GhostComponent: 256
```

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
    PHYSICS,                // 1: Impulse velocities summed
    POST_PHYSICS,           // 2: Inertia, friction, bounce
    MOVEMENT,               // 3: Position updated
    COLLISION_DETECTION,    // 4: Intersections detected
    COLLISION_RESPONSE,     // 5: Intersections resolved
    POST_COLLISION,         // 6: Position final for frame
    ANIMATION,              // 7: Animation selection
    PRE_DRAW,               // 8: Drawing state init
    DRAW,                   // 9: Drawing commands scheduled
    FRAME_END,              // 10: Cleanup
}
```

**This phase ordering is CRITICAL. Components MUST execute in this order!**

---

## Player Constants (from PlayerComponent.java)

```java
// Movement
GROUND_IMPULSE_SPEED = 5000.0f;
AIR_HORIZONTAL_IMPULSE_SPEED = 4000.0f;
AIR_VERTICAL_IMPULSE_SPEED = 1200.0f;
AIR_VERTICAL_IMPULSE_SPEED_FROM_GROUND = 250.0f;
AIR_DRAG_SPEED = 4000.0f;
MAX_GROUND_HORIZONTAL_SPEED = 500.0f;
MAX_AIR_HORIZONTAL_SPEED = 150.0f;
MAX_UPWARD_SPEED = 250.0f;
VERTICAL_IMPULSE_TOLERANCE = 50.0f;

// Fuel/Jetpack
FUEL_AMOUNT = 1.0f;
JUMP_TO_JETS_DELAY = 0.5f;

// Stomp Attack
STOMP_VELOCITY = -1000.0f;
STOMP_DELAY_TIME = 0.15f;
STOMP_AIR_HANG_TIME = 0.0f;
STOMP_SHAKE_MAGNITUDE = 15.0f;
STOMP_VIBRATE_TIME = 0.05f;
HIT_REACT_TIME = 0.5f;

// Ghost/Possession
GHOST_REACTIVATION_DELAY = 0.3f;
GHOST_CHARGE_TIME = 0.75f;
MAX_GEMS_PER_LEVEL = 3;
NO_GEMS_GHOST_TIME = 3.0f;
ONE_GEM_GHOST_TIME = 8.0f;
TWO_GEMS_GHOST_TIME = 0.0f;  // Unlimited with 2 gems
```

---

## Sound System (SoundSystem.java)

```java
MAX_STREAMS = 8;      // Max concurrent sounds
MAX_SOUNDS = 32;      // Max loaded sounds
PRIORITY_LOW = 0;
PRIORITY_NORMAL = 1;
PRIORITY_HIGH = 2;
PRIORITY_MUSIC = 3;
```

The sound system wraps Android's `SoundPool`, maintains a `FixedSizeArray<Sound>` for lookup via binary search.

---

## Channel System (ChannelSystem.java)

Simple pub/sub for game events using named channels:
```java
CHANNEL_COUNT = 8;

// Channel names used:
"RED BUTTON"
"BLUE BUTTON"
"GREEN BUTTON"
"SURPRISED"
```

Components register channels by name, then read/write values (boolean or float).

---

## Collision System Details

### Hit Types (CollisionParameters.java)
```java
public final class HitType {
    public static final int INVALID = 0;
    public static final int HIT = 1;       // Standard hit, reduces life by 1
    public static final int DEATH = 2;     // Instant death
    public static final int COLLECT = 3;   // Collectibles
    public static final int POSSESS = 4;   // Possession (ghost mechanic)
    public static final int DEPRESS = 5;   // Pressing (buttons)
    public static final int LAUNCH = 6;    // Launch victim (cannons)
}
```

### HitReactionComponent Constants
```java
ATTACK_PAUSE_DELAY = (1.0f / 60) * 4;  // Hitstop frames
DEFAULT_BOUNCE_MAGNITUDE = 200.0f;
EVENT_SEND_DELAY = 5.0f;

// Configurable behaviors:
- mPauseOnAttack (hitstop)
- mBounceOnHit (knockback)
- mInvincibleAfterHitTime
- mDieOnCollect
- mDieOnAttack
- mSpawnOnDealHit
```

---

## AI Component Details

### PatrolComponent
```java
// Movement config
mMaxSpeed, mAcceleration

// Attack config
mAttack (enabled)
mAttackAtDistance (range)
mAttackStopsMovement
mAttackDuration
mAttackDelay

// Behavior flags
mTurnToFacePlayer
mFlying (allows vertical movement)
```

### SleeperComponent States
```java
STATE_SLEEPING = 0;
STATE_WAKING = 1;
STATE_ATTACKING = 2;
STATE_SLAM = 3;

DEFAULT_WAKE_UP_DURATION = 3.0f;
mSlamDuration, mSlamMagnitude
mAttackImpulseX, mAttackImpulseY
```

### PopOutComponent States
```java
DEFAULT_APPEAR_DISTANCE = 120;
DEFAULT_HIDE_DISTANCE = 190;
DEFAULT_ATTACK_DISTANCE = 0;

STATE_HIDDEN = 0;
STATE_VISIBLE = 1;
STATE_ATTACKING = 2;
```

### GhostComponent (Possession - NOT YET PORTED)
```java
mMovementSpeed, mJumpImpulse, mAcceleration
mDelayOnRelease (time before player regains control)
mKillOnRelease (kill possessed enemy on release)
mLifeTime (ghost duration limit)
mChangeActionOnButton
mAmbientSound (looping possession sound)
```

### LaunchProjectileComponent
```java
mObjectTypeToSpawn
mOffsetX, mOffsetY (spawn offset)
mVelocityX, mVelocityY
mThetaError (random angle variation)
mRequiredAction (only fire during specific action)
mDelayBetweenShots, mDelayBetweenSets, mDelayBeforeFirstSet
mProjectilesInSet, mSetsPerActivation
mTrackProjectiles, mMaxTrackedProjectiles
```

---

## Difficulty System (DifficultyConstants.java)

### Kids Difficulty
```java
FUEL_AIR_REFILL_SPEED = 0.15f;
FUEL_GROUND_REFILL_SPEED = 2.0f;
MAX_PLAYER_LIFE = 3;
COINS_PER_POWERUP = 20;
GLOW_DURATION = 15.0f;
DDA_STAGE_1_ATTEMPTS = 3;
DDA_STAGE_2_ATTEMPTS = 8;
```

### Adults Difficulty
```java
MAX_PLAYER_LIFE = 2;
COINS_PER_POWERUP = 30;
GLOW_DURATION = 10.0f;
DDA_STAGE_1_ATTEMPTS = 4;
DDA_STAGE_2_ATTEMPTS = 8;
```

### Dynamic Difficulty Adjustment (DDA)
After `DDA_STAGE_1_ATTEMPTS` deaths: +1 life boost, faster fuel refill
After `DDA_STAGE_2_ATTEMPTS` deaths: +2 life boost, even faster fuel

---

## Render Sort Constants (SortConstants.java)

```java
BACKGROUND_START = -100;
THE_SOURCE_START = -5;
FOREGROUND = 0;
EFFECT = 5;
GENERAL_OBJECT = 10;
GENERAL_ENEMY = 15;
NPC = 15;
PLAYER = 20;
FOREGROUND_EFFECT = 30;
PROJECTILE = 40;
FOREGROUND_OBJECT = 50;
OVERLAY = 70;
HUD = 100;
FADE = 200;
```

---

## Game Flow Events (GameFlowEvent.java)

```java
EVENT_INVALID = -1;
EVENT_RESTART_LEVEL = 0;
EVENT_END_GAME = 1;
EVENT_GO_TO_NEXT_LEVEL = 2;
EVENT_SHOW_DIARY = 3;
EVENT_SHOW_DIALOG_CHARACTER1 = 4;
EVENT_SHOW_DIALOG_CHARACTER2 = 5;
EVENT_SHOW_ANIMATION = 6;
```

---

## Object Activation Radii

```java
mTightActivationRadius = screenSizeRadius + 128.0f;
mNormalActivationRadius = screenSizeRadius * 1.25f;
mWideActivationRadius = screenSizeRadius * 2.0f;
mAlwaysActive = -1.0f;  // Player, critical objects
```

---
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
6. **Object Pooling**: Extensive pooling for GameObjects, Components, Drawables, HitPoints to avoid GC
7. **Channel-Based Communication**: Buttons/doors communicate via named channels
8. **Hot Spot System**: Tiles encode AI hints and triggers (50+ types)

---

## Web Port Directory Structure

The actual implemented structure:

```
/
├── CLAUDE.md                # This file - project documentation
├── TODO.md                  # Detailed implementation tracking
├── LICENSE                  # Apache 2.0 license
├── README.md                # Project overview
├── Original/                # Original Android source (reference only)
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
├── eslint.config.js         # ESLint configuration
├── vite.config.ts           # Vite build configuration
├── index.html               # HTML entry point
├── public/                  # Static assets
│   └── assets/
│       ├── manifest.json    # Asset manifest
│       ├── sprites/         # All game sprites (PNG)
│       ├── sounds/          # Sound effects (OGG)
│       └── levels/          # Level data (JSON, converted from .bin)
├── scripts/                 # Build/conversion scripts
│   ├── convert-levels-to-json.ts
│   ├── test-level-load.ts
│   ├── calc-sloc.mjs
│   └── check-hotspots.py
└── src/                     # Main source code
    ├── main.tsx             # React entry point
    ├── App.tsx              # Main app component
    ├── index.css            # Global styles
    ├── components/          # React UI components (17 files)
    │   ├── Game.tsx         # Main game canvas (~1700 lines)
    │   ├── MainMenu.tsx
    │   ├── LevelSelect.tsx
    │   ├── HUD.tsx
    │   ├── DialogOverlay.tsx
    │   ├── OnScreenControls.tsx
    │   └── ... (11 more)
    ├── engine/              # Game engine (15 systems)
    │   ├── SystemRegistry.ts
    │   ├── GameLoop.ts
    │   ├── TimeSystem.ts
    │   ├── InputSystem.ts
    │   ├── CameraSystem.ts
    │   ├── CollisionSystem.ts
    │   ├── GameObjectCollisionSystem.ts
    │   ├── RenderSystem.ts
    │   ├── AnimationSystem.ts
    │   ├── SoundSystem.ts
    │   ├── HotSpotSystem.ts
    │   ├── ChannelSystem.ts
    │   ├── DialogSystem.ts
    │   ├── EffectsSystem.ts
    │   ├── GameFlowEvent.ts
    │   └── collision/       # Collision volumes
    │       ├── CollisionVolume.ts
    │       ├── AABoxCollisionVolume.ts
    │       └── SphereCollisionVolume.ts
    ├── entities/            # Entity/component system
    │   ├── GameObject.ts
    │   ├── GameComponent.ts
    │   ├── GameObjectManager.ts
    │   ├── GameObjectFactory.ts
    │   └── components/      # 23 component implementations
    │       ├── PlayerComponent.ts
    │       ├── PhysicsComponent.ts
    │       ├── MovementComponent.ts
    │       ├── SpriteComponent.ts
    │       ├── BackgroundCollisionComponent.ts
    │       ├── DynamicCollisionComponent.ts
    │       ├── HitReactionComponent.ts
    │       ├── HitPlayerComponent.ts
    │       ├── InventoryComponent.ts
    │       ├── PatrolComponent.ts
    │       ├── EnemyAnimationComponent.ts
    │       ├── NPCComponent.ts
    │       ├── NPCAnimationComponent.ts
    │       ├── GenericAnimationComponent.ts
    │       ├── ButtonAnimationComponent.ts
    │       ├── DoorAnimationComponent.ts
    │       ├── LauncherComponent.ts
    │       ├── LaunchProjectileComponent.ts
    │       ├── SleeperComponent.ts
    │       ├── PopOutComponent.ts
    │       ├── AttackAtDistanceComponent.ts
    │       ├── LifetimeComponent.ts
    │       ├── TheSourceComponent.ts
    │       └── index.ts
    ├── levels/              # Level loading
    │   ├── LevelParser.ts   # Binary .bin parser
    │   ├── LevelSystem.ts
    │   ├── LevelSystemNew.ts
    │   ├── TileMap.ts
    │   └── TileMapRenderer.ts
    ├── stores/              # State management
    │   └── useGameStore.ts  # Zustand persistent store
    ├── context/             # React context
    │   └── GameContext.tsx  # Runtime game state
    ├── data/                # Static data
    │   ├── dialogs.ts       # NPC dialog scripts
    │   ├── levelTree.ts     # Level progression
    │   └── strings.ts       # UI strings
    ├── hooks/               # Custom React hooks
    │   └── useGameLoop.ts
    ├── utils/               # Utilities
    │   ├── Vector2.ts
    │   ├── ObjectPool.ts
    │   ├── AssetLoader.ts
    │   ├── GameSettings.ts
    │   ├── PlaceholderSprites.ts
    │   └── helpers.ts
    └── types/               # TypeScript types
        ├── index.ts
        └── GameObjectTypes.ts
```

---

## ⚠️ Critical Porting Requirements

### 1. Component Phase Ordering (✅ IMPLEMENTED)

The web port executes components in the correct phase order:

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

Each component sets its phase in the constructor and `GameObject` sorts components by phase before updating.

### 2. Fire-and-Forget Drawable Pattern (✅ IMPLEMENTED via RenderSystem)

**Original Pattern:**
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

**Web port uses RenderSystem.scheduleForDraw() with immediate configuration.**

### 3. Render Queue (✅ IMPLEMENTED)

The web port correctly queues draw commands instead of immediate drawing:
1. Components call `scheduleForDraw()` during DRAW phase
2. Queue is sorted by priority (z-ordering)
3. After all updates, queue is rendered to canvas
4. Queue is cleared

### 4. Camera-Relative vs Absolute Positioning (✅ IMPLEMENTED)

Some objects are camera-relative (move with world), others are absolute (HUD).
The CameraSystem handles this transformation during rendering.

### 5. TimeSystem Integration (✅ IMPLEMENTED)

The web port uses TimeSystem's frame delta, respecting freeze and time scale:
```typescript
const gameDelta = timeSystem.getFrameDelta();  // May be 0 if frozen
```

### 6. Object Activation by Distance (✅ IMPLEMENTED)

`GameObjectManager` only updates objects within their `activationRadius` of the camera.
Objects far from the camera are NOT updated, saving CPU.

---

## UI/UX Design (✅ IMPLEMENTED)

### Phone Frame Navigation

The game UI is designed to look like an Android phone with a physical frame:
- **PhoneFrame.tsx**: Renders Android phone bezel aesthetic
- **Back button**: Functions as navigation control (returns to previous screen)
- **Navigation stack**: Implemented via React Context state machine

### User Data Persistence (✅ IMPLEMENTED via Zustand)

Persistent storage using **Zustand** with **localStorage** persistence:

```typescript
// src/stores/useGameStore.ts
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Progress
      completedLevels: [],
      unlockedLevels: [],
      
      // Settings
      soundVolume: 0.7,
      musicVolume: 0.5,
      difficulty: 'kids',
      
      // Actions
      completeLevel: (levelId, score) => { ... },
      // ...
    }),
    { name: 'replica-island-user-data' }
  )
);
```

#### Data Persisted
- **Game Progress**: Completed levels, unlocked content
- **Player Stats**: High scores, play time
- **User Preferences**: Sound/music volume, controls, difficulty

---

## Coding Conventions

### Technology Stack (Current)

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Runtime**: Bun
- **Rendering**: HTML5 Canvas 2D API
- **Audio**: Web Audio API
- **Styling**: CSS (inline and modules)
- **State Management**: 
  - React Context for game runtime state (`GameContext.tsx`)
  - Zustand with persist middleware for user data (`useGameStore.ts`)
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

## How to Run the Project

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
bun run build      # Build for production (typecheck + bundle)
bun run preview    # Preview production build locally
bun run lint       # Run ESLint
bun run typecheck  # Run TypeScript type checking
```

### Building for Production

```bash
bun run build
# Output will be in /dist folder
# Deploy the dist folder to any static hosting (Vercel, Netlify, GitHub Pages)
```

---

## Important Implementation Notes

### Level Loading (✅ IMPLEMENTED)

Levels are loaded from JSON (converted from original `.bin` files):
- **LevelParser.ts**: Parses binary `.bin` format (signature 96)
- **LevelSystemNew.ts**: Manages level loading and spawning
- Levels stored in `public/assets/levels/` as JSON
- Format: layers (background, collision, objects, hot spots)

### Collision System (✅ IMPLEMENTED)

- **CollisionSystem.ts**: Tile-based background collision
- **GameObjectCollisionSystem.ts**: Object-to-object (sweep-and-prune)
- **BackgroundCollisionComponent.ts**: Per-object collision response
- Collision volumes: AABox (rectangle) and Sphere (circle)

### Animation System (✅ IMPLEMENTED)

Key flow:
1. **ANIMATION phase**: AnimationComponent selects animation based on state
2. **PRE_DRAW phase**: SpriteComponent advances frame timer, gets current frame
3. **DRAW phase**: SpriteComponent schedules sprite for rendering

Animation frames can include attack/vulnerability collision volumes.

### Sound System (✅ IMPLEMENTED)

- Web Audio API with AudioContext
- 22 sound effects loaded from OGG files
- Concurrent sound limit (32 streams)
- Volume control per category

### ❌ NOT YET IMPLEMENTED

1. **Music System**: MIDI file needs conversion to MP3/OGG
2. **Ghost/Possession Mechanic**: GhostComponent not ported
3. **Cutscene Player**: AnimationPlayerActivity for endings
4. **Evil Kabocha Boss**: Separate boss component needed
5. **Diary System**: DiaryActivity modal overlay

### ⚠️ Animation System - Implementation Notes

**The animation system is fully implemented in the web port:**

1. **Animation Frame = Texture + Collision Volumes** (✅)
   - Frames include texture, hold time, attack/vulnerability volumes
   - `SpriteComponent` manages frame progression

2. **Animation Selection is State-Based** (✅)
   - `EnemyAnimationComponent`, `NPCAnimationComponent`, etc. select animations
   - `GenericAnimationComponent` maps `ActionType` to animation index

### ⚠️ Rendering System - Implementation Notes

**The web port uses render queue pattern correctly:**

1. **RenderComponent queues, doesn't draw immediately** (✅)
2. **RenderSystem sorts by priority for layering** (✅)
3. **Camera offset applied during render, not during update** (✅)

#### Priority Constants (implemented in RenderSystem):
- `BACKGROUND_START = -100`
- `FOREGROUND = 0`
- `PLAYER = 20`
- `HUD = 100`

### ⚠️ Coordinate System

**Original uses OpenGL coordinates: origin at BOTTOM-LEFT, Y increases UP.**

The web port uses Canvas coordinates (TOP-LEFT, Y increases DOWN) but handles the transformation in the rendering layer so game logic uses the same coordinate system as the original.

### Asset Status

1. **Sprites** (✅ 81% complete): 342 of 420 files copied
   - Missing sprites are for unimplemented features (cutscenes, ghost, Rokudou boss)
   
2. **Audio** (✅ 100% SFX): 22 OGG sound effects loaded
   - Music not implemented (MIDI needs conversion)
   
3. **Levels** (✅ 100%): 40+ levels converted to JSON

### Performance Notes

1. **Game Loop**: Uses `requestAnimationFrame` with fixed timestep (60 FPS target)
2. **Canvas Optimization**: Pixel art mode (`imageSmoothingEnabled = false`)
3. **Object Pooling**: Implemented for performance-critical objects
4. **Activation Radius**: Objects only updated when near camera

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

## Complete Original File Reference

### Core Systems (all ported)
| File | Lines | Web Port |
|------|-------|----------|
| `Game.java` | 571 | `Game.tsx` |
| `GameThread.java` | 148 | `GameLoop.ts` |
| `MainLoop.java` | 42 | Integrated in Game.tsx |
| `GameRenderer.java` | 303 | `RenderSystem.ts` |
| `ObjectRegistry.java` | 83 | `SystemRegistry.ts` |

### Entity System (all ported)
| File | Lines | Web Port |
|------|-------|----------|
| `GameObject.java` | 232 | `GameObject.ts` |
| `GameComponent.java` | 51 | `GameComponent.ts` |
| `GameObjectManager.java` | 201 | `GameObjectManager.ts` |
| `GameObjectFactory.java` | 6773 | `GameObjectFactory.ts` |

### Systems (all ported)
| File | Web Port | Status |
|------|----------|--------|
| `RenderSystem.java` | `RenderSystem.ts` | ✅ |
| `CollisionSystem.java` | `CollisionSystem.ts` | ✅ |
| `CameraSystem.java` | `CameraSystem.ts` | ✅ |
| `SoundSystem.java` | `SoundSystem.ts` | ✅ |
| `TimeSystem.java` | `TimeSystem.ts` | ✅ |
| `HotSpotSystem.java` | `HotSpotSystem.ts` | ✅ |
| `InputSystem.java` | `InputSystem.ts` | ✅ |
| `ChannelSystem.java` | `ChannelSystem.ts` | ✅ |

### Components Porting Status

| Original | Web Port | Status |
|----------|----------|--------|
| `PlayerComponent.java` | `PlayerComponent.ts` | ✅ |
| `PhysicsComponent.java` | `PhysicsComponent.ts` | ✅ |
| `MovementComponent.java` | `MovementComponent.ts` | ✅ |
| `SpriteComponent.java` | `SpriteComponent.ts` | ✅ |
| `BackgroundCollisionComponent.java` | `BackgroundCollisionComponent.ts` | ✅ |
| `DynamicCollisionComponent.java` | `DynamicCollisionComponent.ts` | ✅ |
| `HitReactionComponent.java` | `HitReactionComponent.ts` | ✅ |
| `HitPlayerComponent.java` | `HitPlayerComponent.ts` | ✅ |
| `InventoryComponent.java` | `InventoryComponent.ts` | ✅ |
| `PatrolComponent.java` | `PatrolComponent.ts` | ✅ |
| `EnemyAnimationComponent.java` | `EnemyAnimationComponent.ts` | ✅ |
| `NPCComponent.java` | `NPCComponent.ts` | ✅ |
| `NPCAnimationComponent.java` | `NPCAnimationComponent.ts` | ✅ |
| `GenericAnimationComponent.java` | `GenericAnimationComponent.ts` | ✅ |
| `ButtonAnimationComponent.java` | `ButtonAnimationComponent.ts` | ✅ |
| `DoorAnimationComponent.java` | `DoorAnimationComponent.ts` | ✅ |
| `LauncherComponent.java` | `LauncherComponent.ts` | ✅ |
| `LaunchProjectileComponent.java` | `LaunchProjectileComponent.ts` | ✅ |
| `SleeperComponent.java` | `SleeperComponent.ts` | ✅ |
| `PopOutComponent.java` | `PopOutComponent.ts` | ✅ |
| `AttackAtDistanceComponent.java` | `AttackAtDistanceComponent.ts` | ✅ |
| `LifetimeComponent.java` | `LifetimeComponent.ts` | ✅ |
| `TheSourceComponent.java` | `TheSourceComponent.ts` | ✅ |
| `GhostComponent.java` | - | ❌ Not ported |
| `GravityComponent.java` | - | ❌ Not ported |
| `CameraBiasComponent.java` | - | ❌ Not ported |
| `ChangeComponentsComponent.java` | - | ❌ Not ported |
| `OrbitalMagnetComponent.java` | - | ❌ Not ported |
| `MotionBlurComponent.java` | - | ❌ Not ported |
| `FadeDrawableComponent.java` | - | ❌ Not ported |

---

## Resources

- [Original Replica Island Source](https://code.google.com/archive/p/replicaisland/)
- [Game Programming Patterns](https://gameprogrammingpatterns.com/)
- [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
