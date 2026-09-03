# CLAUDE.md - Project Guide for ReplicaIslandReborn

---

## ⚠️ IMPORTANT: Package Manager

**NEVER use npm in this project!** Always use **Bun** instead.

| ❌ DON'T USE | ✅ USE INSTEAD |
|--------------|----------------|
| `npm install` | `bun install` |
| `npm run dev` | `bun run dev` |
| `npm run build` | `bun run build` |
| `npm test` | `bun test` |
| `npx <command>` | `bunx <command>` |

Bun is the designated runtime and package manager for this project. It provides faster installs and execution.

---

## Project Overview

This project is a web port of **Replica Island**, one of the earliest and most popular open-source Android games. The original game was written in Java for Android by Chris Pruett and Genki Mine, released under the Apache 2.0 license.

### About Replica Island

Replica Island is a side-scrolling platformer starring the Android robot as its protagonist on a dangerous mission to find a mysterious power source. The game includes all art, dialog, level layouts, and other data along with the code.

---

## ✅ Game Status: Complete

**The port is complete.** Every shipped level loads, plays and can be finished;
every mechanic in the original is present and verified in the browser.

Earlier revisions of this file described the intro cutscene, the extras menu and
the NPC system as broken, then later described combat and the boss fights as
missing. All of that is fixed. Verify against the code and the test suite before
trusting any status claim here — that has been the recurring failure mode of
this document.

Verified working (exercised in the browser and by `bun test`):

| Area | Status | Notes |
|------|--------|-------|
| Title / Level Select / Options menus | ✅ | Level Select scrolls the unlocked level into view |
| Level 0-1 intro cutscene | ✅ | Wanda walks the hot-spot script, triggers dialog, ends the level |
| Level progression | ✅ | Level complete → next level loads, non-linear tree honoured |
| Player movement / jump / jetpack | ✅ | Matches the original's PlayerComponent constants |
| Stomp attack + enemy kills | ✅ | STOMP state drives the player down; overlap kills enemies |
| Collectibles & win condition | ✅ | 3 rubies triggers LEVEL_COMPLETE |
| Player lives | ✅ | Sourced from the selected difficulty (Baby 5 / Kids 3 / Adults 2) |
| Dynamic difficulty (DDA) | ✅ | Repeated attempts at a level quietly grant extra hit points and faster air refuelling |
| Dialog & character portraits | ✅ | Both scripted and hot-spot triggered |
| Sound effects | ✅ | 22 OGG effects |
| Background music | ✅ | bwv_115.mid converted to a note score, synthesized via Web Audio |
| Extras menu | ✅ | Unlocks on game completion |
| All 40 shipped levels | ✅ | Every object type in level data has a spawn implementation |

### Known remaining differences from the original

The game is complete: every shipped level loads, plays and can be finished,
and every mechanic in the original is present. What follows are the places
where this port reaches the same behaviour by different means, plus one
optimisation it does not do. None of them is missing gameplay.

| Difference | Impact | Notes |
|------------|--------|-------|
| Wall and ceiling tests are per-tile AABB | Low | Slopes are handled: `getGroundSurfaceY()` puts the feet on the real segment, and `checkTileCollision()` no longer treats a sloped tile as a wall when its surface is within `SLOPE_STEP_UP` of the feet, so ramps are walkable. What is still missing is the original's full swept test (`testBox()` ray-marching the box), which would also fix fast-moving objects clipping tile corners — see the comment at `checkTileCollision()`. |
| No object pooling | Low | The original pools 384+ objects to avoid GC pauses on 2010 Android hardware. The port allocates freely; this is not a correctness problem and has not shown up as one in play. |
| Four components unattached | None | See "Ported But Not Wired Up" — one is dead in the original too, the rest are covered by other code or serve unused object types. |
| `SimplePhysicsComponent` not ported | Low | Its two jobs are covered: `MovementComponent` consumes scripted impulses and clamps velocity on contact. Only the 10% bounce off surfaces is absent, which is cosmetic. |
| `ui_button_fly_disabled` unused | None | Dead in the original too: `HudSystem.mFlyButtonActive` is set true in `reset()` and there is no setter, so the disabled sprite never draws there either. |
| `Game.tsx` size | Low | ~2780 lines of orchestration: level transitions, sprite loading, Canvas UI wiring, and turning pipeline events into lives, score, the win check and the diary. No longer a parallel component system. |

### Rendering

Everything on screen is drawn by its own `SpriteComponent`, the way the
original draws it. `Game.tsx`'s render callback used to hold a ~1100-line
switch that picked frames from each object's state every frame; that work now
belongs to the animation components, and the frames themselves live in three
catalogues:

- `src/data/enemyAnimations.ts` — enemies, selected by `EnemyAnimationComponent`
- `src/data/npcAnimations.ts` — Wanda, Kyle, Kabocha and both bosses, selected
  by `NPCAnimationComponent` (which also watches the SURPRISED channel)
- `src/data/objectAnimations.ts` — everything with a single looping animation:
  collectibles, blocks, signs, cannons, spawners, projectiles, the ghost
- `src/data/playerAnimations.ts` — Andou, selected by `PlayerComponent`

`SpriteFrame` carries what the original's `AnimationFrame` carries: its own
sprite name (this port's art is individual files rather than sheets), draw size
and offset, **its hold time**, and **its collision volumes**.

Hold times are per-frame and transcribed from the original's
`Utils.framesToTime(24, n)` calls, because almost nothing in the game holds its
frames evenly: a coin rests for 30 frames and then glints over four, Andou
stands still for a full second, a mudman's slam holds for 8 frames while its
wind-up runs at 2. Every catalogue carries them (`idleFrameTimes`,
`walkFrameTimes`, `attackFrameTimes`, `durations`, `frameTimes` depending on the
file); a list left out falls back to a flat 3 frames, which is what the whole
port used to do and what made every animation feel wrong in the same way.

The frame *lists* are transcribed too, and several are not the obvious cycle:
the brobot's idle returns to `idle02` rather than looping from the start, the
snailbomb's walk leans out and back, the terminals flicker through nine frames
that revisit earlier ones, the ruby's cycle begins at `ruby02`, and the mudman's
attack opens on its standing frame — leave that one out and `attackContactFrames`
points a frame late, so the blow lands on the recovery instead of the slam. `SpriteComponent` hands those volumes
to the object's `DynamicCollisionComponent` as the animation plays, which is
`sprite.setCollisionComponent(collision)` in the original. A frame that declares
no volumes leaves the current ones alone, so an animation only has to say where
they change.

Three components modify what a sprite draws rather than choosing it, and each
is attached where the original attaches it:

- `FadeDrawableComponent` animates a sprite's opacity. The Source is five
  512x512 layers stacked at priorities -5..-1, each with its own ping-pong fade
  at its own rate (1.2s to 6.0s) — that cross-fading, not any frame animation,
  is what makes it look alive. The player's glow powerup is a second sprite
  layered at priority 21 whose fade holds steady, then flashes for the last four
  seconds so the powerup announces its own end.
- `MotionBlurComponent` samples its target sprite every 0.1s and redraws the
  last four samples behind it, fading out. Kyle carries one while he dashes.
- `PlayerComponent` owns Andou's post-hit flicker: three seconds of 0.15s
  blinking triggered when he *leaves* HIT_REACT, per the original's
  `AnimationComponent`. It is deliberately not tied to the invincible flag —
  doing that makes the glow powerup strobe him for its whole duration.

One thing still draws directly from `Game.tsx`, deliberately: the effects around
Andou (jet fire, hit sparks), which the original spawns as separate objects.

**Draw order** is `src/engine/SortConstants.ts`, transcribed from the original's
`SortConstants.java`. `RenderSystem` sorts its queue by these low-to-high, so a
larger number draws on top:

```
BACKGROUND_START -100  THE_SOURCE_START -5  FOREGROUND 0  EFFECT 5
GENERAL_OBJECT 10  GENERAL_ENEMY/NPC 15  PLAYER 20  FOREGROUND_EFFECT 30
PROJECTILE 40  FOREGROUND_OBJECT 50  OVERLAY 70  HUD 100  FADE 200
```

`LevelSystemNew`'s `drawPriorityFor()` assigns these at spawn from two tables
(`SUBTYPE_PRIORITIES`, `TYPE_PRIORITIES`), each entry transcribed from the
`setPriority()` call in the matching `spawn*` function. Note the ones that do
not follow from the object's type: the turret is `GENERAL_OBJECT` despite being
an enemy, the dead-Kyle and dead-Andou props are `GENERAL_OBJECT` rather than
NPC, and the ghost draws with the projectiles.

The gaps between constants are what let a sprite sit next to its owner: the
jet fire at `PLAYER - 1`, the glow halo and hit sparks at `PLAYER + 1`, The
Source's five layers at `THE_SOURCE_START + 0..4`. Everything used to share a
priority of 0 and draw in whatever order the object manager held it, which
looked right often enough to hide that there was no way to express this at all.

`EffectsSystem.drawQueued()` puts explosions, smoke and dust into the queue at
`EFFECT`, unless the effect's config names its own `priority` — the crush
flash uses that to draw `effect_crush_back01-03` behind the object it crushed
while its seven front frames play over the top at `FOREGROUND_EFFECT`, which
is how the original spawns it. They used to paint straight onto the canvas *before* the queue
rendered, which put them under everything drawn afterwards — the background
layers included. If you add a system that draws with raw canvas operations,
give it a queue entry rather than a direct `ctx` call, or it lands underneath
the world.

A fade whose target sprite persists its opacity has to keep asserting that
opacity even while waiting out an initial delay. The original can skip that,
because its `SpriteComponent` hands the fade a fresh drawable at full opacity
every frame; here opacity is state that sticks to the sprite.

If you remove a type from a render path, check the placeholder-rectangle
fallback at the end of the object loop — it paints a coloured box over anything
it thinks is undrawn, and will happily cover a sprite a component just drew.

### Movement

Enemies and NPCs move on `GravityComponent` + `MovementComponent`, attached at
spawn by `LevelSystem.attachPhysics()`. Their AI components (`PatrolComponent`,
`NPCComponent`, `SleeperComponent`, `PopOutComponent`,
`AttackAtDistanceComponent`) only set `targetVelocity`; `MovementComponent`
interpolates towards it and resolves tile collision, and `PatrolComponent` turns
around off the wall-touch stamps that leaves behind.

Three tables in `LevelSystemNew.ts` carry the original's per-object setup, all
transcribed from `GameObjectFactory.java`:

- `FLYING_SUBTYPES` — given a `MovementComponent` but no gravity. Rokudou is
  here because his gravity is swapped in on death by `ChangeComponentsComponent`.
- `NO_PHYSICS_SUBTYPES` — given neither component (The Source, Shadow Slime,
  turret).
- `COLLISION_BOXES` — the `bgcollision.setSize()/setOffset()` box. These matter:
  a character's sprite is far wider than the space it occupies (Wanda is a
  64x128 sprite standing in a 32x82 box), and colliding with the whole sprite
  wedges her into walls she should walk past.

`Game.tsx` used to run its own copy of all this, with `subType` special cases
that silently overrode component behaviour — it zeroed Evil Kabocha's velocity
every frame, so the boss could never walk its hot-spot script. Do not
reintroduce per-object physics there.

### Combat

All damage flows through `GameObjectCollisionSystem`, the original's
sweep-and-prune object-to-object collision. Objects submit attack and
vulnerability volumes through `DynamicCollisionComponent` during the
`FRAME_END` phase; the system resolves overlaps and dispatches to
`HitReactionComponent`, which decrements life and grants invincibility.
`Game.tsx`'s `resolveCollisionOutcomes()` then turns that into lives, score,
effects and death sequences.

The original keeps volumes on animation frames, so an enemy's hitboxes change
with what it is doing, and so does this port: `SpriteFrame` carries
`attackVolumes`/`vulnerabilityVolumes`, and `SpriteComponent` hands them to
`DynamicCollisionComponent` as the animation plays. The geometry is defined in
two catalogues, which the animation data draws from:

- **The player** (`src/entities/playerCollisionVolumes.ts`) only has a HIT
  attack volume while stomping or glowing, and *no* vulnerability volume in
  those states. That is what makes a stomp beat an enemy's contact damage and
  what makes the glow powerup invincible. DEPRESS and COLLECT are always live.
- **Enemies** (`src/entities/enemyCollisionProfiles.ts`) carry the original's
  volumes per subType. Consequences worth knowing:
  - Mudman and Pink Namazu have **no vulnerability volume** — they cannot be
    stomped at all, only avoided or possessed.
  - The turret's vulnerability volume is typed `POSSESS`, so it cannot be
    stomped either; it has to be taken over.
  - Skeleton, Mudman and Pink Namazu only present an attack volume while their
    action is `ATTACK`, so they are harmless mid-patrol. Brobots and the flying
    enemies hurt on contact.
  These sets are attached to the frames of the matching animation in
  `src/data/enemyAnimations.ts`, so an enemy's attack volume is live only on the
  frames where the blow actually lands (`attackContactFrames`), not for the whole
  attack animation.

Hit types matter as much as geometry. A vulnerability volume left **untyped**
accepts every hit type; a typed one accepts only its own. The original leaves
most enemy vulnerability volumes untyped (so a brobot can be both stomped and
possessed) and types only the turret (`POSSESS`) and snailbomb (`HIT`). Andou's
vulnerability volume is untyped too, which is what lets a cannon's `LAUNCH`
volume reach him — typing it `HIT` silently makes cannons stop working.

Collectibles use the original's two mechanisms rather than one AABB test.
Coins carry a `HitPlayerComponent` — a plain 32px radius check, which is why
`spawnCoin` leaves its dynamic-collision line commented out — while rubies and
diaries carry a `COLLECT` vulnerability volume reached by Andou's always-present
`COLLECT` attack volume. Both end at `HitReactionComponent`'s `dieOnCollect`,
and `Game.tsx` turns the resulting death into inventory, score and the win
check. The port does not implement the original's
`HitReactionComponent.setInventoryUpdate` record; the consequences live in
`Game.tsx` instead.

Possession runs through the same pipeline. The ghost carries a `POSSESS` attack
volume; any object whose vulnerability volume accepts `POSSESS` can be taken
over, which is why brobots (untyped volume), turrets and brobot spawners (typed
`POSSESS`) all work while a snailbomb (typed `HIT`) does not. The takeover
itself is `HitReactionComponent.setPossessionComponent()` activating a
ping-pong `ChangeComponentsComponent`: the AI swaps out and a `GhostComponent`
swaps in, and activating it again on release reverses that. `Game.tsx` only
notices which object the player is now driving and hands it the camera.

Enemy collision volumes are primed at spawn rather than on the first update,
because `attachPossession()` reads them to decide whether to fit the swap.

Do not add inline AABB combat checks back into `Game.tsx`. If something needs to
deal or take damage, give it volumes and a `HitReactionComponent`.

### Boss fights

The original has no "boss AI". Evil Kabocha and Rokudou are ordinary NPCs:

- `NPCComponent` walks/flies them along the arena's hot-spot script, and posts
  `SHOW_ANIMATION` with the ending's index when they die (`GameFlowEvent` →
  `CutsceneType`, which share the original's numbering).
- A vulnerability volume on `DynamicCollisionComponent` plus a
  `HitReactionComponent` is what makes them damageable; the three-hit fight is
  just `life = 3` plus the post-hit invincibility window.
- Rokudou additionally carries two `LaunchProjectileComponent`s (a 1.5s energy
  ball and a five-round burst), both gated on `ActionType.ATTACK` so they only
  fire while an ATTACK hot spot holds him in that action.

Killing Kabocha plays the Rokudou ending; killing Rokudou plays the Kabocha
ending. `src/levels/bossFights.test.ts` pins this against the shipped
`level_final_boss_lab` data.

Earlier revisions instead gave both bosses bespoke state-machine components and
resolved their damage with `subType` string checks in `applyPlayerAttack`. Those
components have been removed; do not reintroduce that pattern.

### Camera

`CameraSystem` is transcribed from `CameraSystem.java` and does **not** smooth.
It keeps its target inside a dead zone and otherwise locks on:

```
X_FOLLOW_DISTANCE      = 0     // horizontally welded to the target
Y_UP_FOLLOW_DISTANCE   = 90    // the target may rise 90px before the view does
Y_DOWN_FOLLOW_DISTANCE = 0     // falling is followed immediately
```

The asymmetry is deliberate: an ordinary jump moves the player less than 90px
relative to the camera, so the screen holds still instead of pumping, while a
fall is tracked at once so you can see where you will land. An earlier version
lerped toward the target with an invented smoothing factor, which lagged
horizontally and bobbed on every hop.

Also from the original: shake is a sine of the remaining shake time on the **Y
axis only**; the focal point is floored so pixel art lands on whole pixels;
camera bias applies only while the target is moving ("no camera motion without
player input"); and handing the camera to a new target eases over
`INTERPOLATE_TO_TARGET_TIME`, but only within
`MAX_INTERPOLATE_TO_TARGET_DISTANCE` — further away it cuts.

`cameraSystem.reset()` must be called on every level load. `setTarget()` is a
no-op while NPC focus is held, and a cutscene level has no player to release
that focus to, so without the reset the flag survives into the next level and
silently swallows every `setTarget(player)`. `cameraFocus.test.ts` scans
`Game.tsx` for a reset before each `setBounds`.

### Time scaling

`TimeSystem` can scale the game clock with an eased ramp
(`EASE_DURATION = 0.5`). The original uses it in exactly one place:
`PlayerComponent.gotoWin()` calls `appyScale(0.1f, 8.0f, true)`, dropping the
game to a tenth speed as the last gem is taken. The ramp is cleared on level
load — it runs for eight seconds but the level ends after one and a half.

### Dynamic difficulty

The original quietly makes a level easier once the player keeps failing it: at
`ddaStage1Attempts` they get `ddaStage1LifeBoost` extra hit points and a faster
jetpack refill in the air, and more of both at `ddaStage2Attempts`. Nothing is
shown in the UI. The thresholds and boosts live in `DifficultySettings`
(`src/stores/useGameStore.ts`), the rule is
`src/entities/dynamicDifficulty.ts`, and `PlayerComponent.applyDifficulty()`
applies it at spawn using the store's recorded `timesPlayed` for that level.

Jetpack refill rates come from the same constants — they are not the hardcoded
values the port used to carry.

### Fidelity audit status

Systems checked line-by-line against the Java original, with the numbers pinned
by tests so they cannot drift back:

| Area | State |
|------|-------|
| Player constants | All 21 match. `STOMP_VELOCITY` differs only in sign (Y-up → Y-down). `playerConstants.test.ts` |
| Difficulty constants | All 33 across Baby/Kids/Adults match. The extra `enemyDamage`/`coinValue`/`playerHitPoints` fields are dead config, referenced nowhere |
| Activation radii | Derived from the screen size as `GameObjectFactory` does; every spawn site mapped. `activationRadius.test.ts` |
| Camera | Follow distances, sinusoidal Y-only shake, pixel snap, bias gating, target hand-off. `cameraFollow.test.ts` |
| Hot spot types | All 41 match |
| Object type indices | All 41 used by level data match. The original's own `ENERGY_BALL(68)`/`BREAKABLE_BLOCK_PIECE(68)` collision is renumbered here; no level reaches that far. `objectTypeIndices.test.ts` |
| Component constants | PopOut, MotionBlur, Sleeper, TheSource, Channel, HitReaction all match |
| Launcher parameters | Every projectile's offsets, velocities, set sizes and delays. `launcherParameters.test.ts` |
| Animation frame times | Transcribed per frame from `framesToTime(24, n)`. `animationTiming.test.ts` |
| Sound | 8-voice cap with SoundPool's priority stealing. `soundPriority.test.ts` |
| Dialogs | Every script in `res/xml` ported, page counts checked against the XML. `dialogCoverage.test.ts` |
| Level binary format | Little-endian; all 36 `.bin` files parse and agree with the shipped JSON. `binaryFormat.test.ts` |
| RenderSystem | Queue sorted by priority, camera transform pixel-snapped. The original's double buffering is a threading artifact this port does not need |

Two traps this audit kept hitting, worth knowing before adding to it:

- **A value assigned twice.** The original sets `delayBeforeFirstSet` twice on
  both the snailbomb and the shadow slime, and the second call wins. Reading the
  first and stopping gives a plausible wrong number.
- **Y-up to Y-down.** Anything vertical flips sign, and anything measured from an
  object's origin changes end: the original's origin is the object's bottom, so
  `position.y + 10` is *above the feet* and becomes `y + height - 10` here.

### How to verify gameplay changes

- `bun test` runs a headless gameplay simulation (`src/levels/campaignGameplay.test.ts`)
  that loads every playable level, runs the real frame loop with the collision
  pipeline wired exactly as `Game.tsx` wires it, and asserts the player moves,
  flies, stomps, keeps its difficulty hit points, doesn't fall out of the world,
  and that every enemy the campaign spawns is wired for combat.
- `src/levels/levelCompletable.test.ts` reads the shipped level data and
  asserts every level reachable through either progression tree has a way to
  finish it: three rubies, a boss, or an END_LEVEL/GAME_EVENT hot spot.
- Combat rules are pinned by `src/entities/enemyCollisionProfiles.test.ts`,
  `src/entities/playerCollisionVolumes.test.ts`,
  `src/engine/GameObjectCollisionSystem.test.ts` and
  `src/levels/bossFights.test.ts`.
- In `bun run dev`, `window.__ri` exposes the live object manager, camera, level
  system and a `step(n)` function that advances the simulation deterministically.
  This is dev-only (`import.meta.env.DEV`) and is the fastest way to reproduce a
  gameplay bug without fighting `requestAnimationFrame` throttling.

Two traps when checking behaviour in a browser, both of which produce
convincing false negatives:

- **Anything timed inside a single evaluation reads zero.** Sampling a counter,
  awaiting a timeout, and sampling again measures a window in which the page
  never paints, so `requestAnimationFrame` never fires. The loop, the collision
  system and the frame counter all look dead. Measure across a real interaction
  instead - set the counter, take a screenshot or click, then read it back.
- **`getActiveObjects()` is not "the objects in the level".** Objects outside
  their activation radius move to an inactive list, so a collectible that
  disappears from that list has usually just been culled by distance rather
  than picked up. Check `life` or `getInactiveObjectCount()` before concluding
  anything was collected or destroyed.

Also note that a dialog freezes the simulation (`__ri.gates.dialog`), so
stepping frames while one is open changes nothing. Dialogs close on a real
click/tap or Enter, and closing needs a React render - a synchronous loop of
`step()` calls will never let one through.

---

## 🎮 Web Port Status (Current Implementation)

### Technology Stack
- **Framework**: React 19 + TypeScript with Vite
- **Rendering**: HTML5 Canvas 2D API (gameplay) + React (menus)
- **Audio**: Web Audio API
- **State Management**: Zustand (persistent) + React Context (runtime)
- **Build Tool**: Vite with Bun runtime
- **UI Architecture**: React for menus, Canvas for all gameplay UI

### Implementation Progress Summary

| Category | Status | Details |
|----------|--------|---------|
| **Playable end-to-end** | ✅ | Title → level → completion → next level |
| **Core Engine** | ✅ | All 15 systems implemented and wired |
| **Player State Machine** | ✅ | All 7 states implemented in `PlayerComponent` |
| **Ghost Mechanic** | ✅ | Charge, spawn, camera handoff, release |
| **NPC Cutscene System** | ✅ | `NPCComponent` drives hot-spot scripts; level 0-1 completes |
| **Components** | ✅ | ~32 ported and attached; 4 attach to nothing (see "Ported But Not Wired Up") |
| **UI/Screens** | ✅ | 11 React menu components + Canvas gameplay UI |
| **Canvas Gameplay UI** | ✅ | HUD, Controls, Dialog, Cutscene, Pause, GameOver, LevelComplete |
| **Levels** | ✅ | 40 levels load; every object type has a spawn implementation |
| **Sound** | ✅ | 22 SFX loaded and playing |
| **Music** | ✅ | `bwv_115.mid` → JSON score (`bun run convert:music`), synthesized at runtime |
| **Cutscenes** | ✅ | Both `CanvasCutscene` and the NPC-driven intro |
| **Extras Menu** | ✅ | Unlocks on game completion |
| **Object collision pipeline** | ✅ | `GameObjectCollisionSystem` owns all combat: player attacks, enemy contact damage, bosses, projectiles and breakable blocks |
| **Boss fights** | ✅ | Evil Kabocha and Rokudou are composed the way the original composes them (see below) |

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
| GhostComponent | THINK | GhostComponent.java | ✅ |
| CameraBiasComponent | POST_COLLISION | CameraBiasComponent.java | ✅ |
| GravityComponent | PHYSICS | GravityComponent.java | ✅ |
| SimpleCollisionComponent | COLLISION_DETECTION | SimpleCollisionComponent.java | ✅ |
| SolidSurfaceComponent | COLLISION_RESPONSE | SolidSurfaceComponent.java | ✅ |

### Ported But Not Wired Up

Four components exist under `src/entities/components/` and typecheck, but
nothing constructs or attaches them. Check with:

```bash
grep -rl "ComponentName" src --include="*.ts" --include="*.tsx"
```

| Component | Original use | Why it is not attached |
|-----------|--------------|------------------------|
| FixedAnimationComponent | none | The original only *pools* it (`GameObjectFactory` line 225); nothing there allocates it either. Dead in both. |
| PlaySingleSoundComponent | `spawnEffectExplosionLarge` / `Giant` | `EffectsSystem` plays those two sounds directly. |
| CrusherAndouComponent | `spawnObjectCrusherAndou` | Its object type (59) appears in no shipped level, so it can never run. |
| SnailbombComponent | Snail enemy behavior | The snailbomb is assembled from Patrol + LaunchProjectile instead, as the original's data does. |

`SimplePhysicsComponent` (bounce/inertia, 16 spawn sites in the original) was
never ported. Objects that would use it — debris, gems, bouncing projectiles —
get their motion from `PhysicsComponent`/`MovementComponent` or from
`EffectsSystem` particles.

Recently wired, and worth knowing where they went:

| Component | Attached to | Notes |
|-----------|-------------|-------|
| FadeDrawableComponent | The Source's five layers; the player's glow halo | Drives `SpriteComponent.setOpacity()`, where the original drives a RenderComponent's drawable |
| MotionBlurComponent | Kyle | Samples his sprite every 0.1s and redraws four fading copies behind him |
| HitPlayerComponent | Collectibles | The radius test the original uses for coins, rubies and diaries |

### React UI Components (Menu Screens Only)

React is used **only for menu screens**. Gameplay is 100% Canvas-based.

| Component | Purpose |
|-----------|---------|
| `Game.tsx` | Main game canvas, system orchestration (~1900 lines) |
| `MainMenu.tsx` | Title screen with original assets |
| `LevelSelect.tsx` | Level grid with unlock states |
| `DifficultyMenu.tsx` | Baby/Kids/Adults selection |
| `OptionsMenu.tsx` | Settings and key bindings |
| `LoadingScreen.tsx` | Level loading progress |
| `FadeTransition.tsx` | Screen transitions |
| `PhoneFrame.tsx` | Android phone bezel aesthetic |
| `AndroidHomeScreen.tsx` | Fake home screen for immersion |
| `AndroidRecentsScreen.tsx` | Fake recents view |
| `SoundControls.tsx` | Volume controls |

### Canvas-Based Gameplay UI (NEW ARCHITECTURE)

All gameplay UI is rendered directly to Canvas for performance and consistency:

| System | File | Purpose |
|--------|------|---------|
| CanvasHUD | `CanvasHUD.ts` | Fuel bar, coin/ruby counters, FPS display |
| CanvasControls | `CanvasControls.ts` | Movement slider, fly/stomp buttons, touch/mouse |
| CanvasDialog | `CanvasDialog.ts` | Typewriter text, character portraits, conversations |
| CanvasCutscene | `CanvasCutscene.ts` | Frame animation, parallax layers, Kyle death |
| CanvasPauseMenu | `CanvasPauseMenu.ts` | Pause overlay with ui_paused.png |
| CanvasGameOverScreen | `CanvasGameOverScreen.ts` | Score/stats, Try Again/Main Menu options |
| CanvasLevelCompleteScreen | `CanvasLevelCompleteScreen.ts` | Level stats, life bonus, Continue/Main Menu |

**Why Canvas-based UI?**
- **Consistent rendering**: All gameplay visuals in one rendering context
- **Performance**: No React reconciliation during gameplay
- **Pixel-perfect**: Matches original game's retro aesthetic
- **Architecture**: Clear separation - React for menus, Canvas for gameplay

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

### CollisionSystemNew vs Original (line-segment port status)
- **Original (Java)** `Original/src/com/replica/replicaisland/CollisionSystem.java`: Bresenham ray stepping over tiled line-segment data, `testBox()` collects multiple `HitPoint`s per tile, `update()` swaps/clears temporary surfaces each frame, `loadCollisionTiles()` reads signature-52 binary.
- **Web port attempt** `src/engine/CollisionSystemNew.ts` + `public/assets/collision.json`: segment data loads in `Game.tsx` before levels, but `checkTileCollision()` is hard-wired to `checkTileCollisionSimple()` so collision.json normals are ignored; `_checkTileCollisionWithSegments()` is marked TODO and never invoked, so slopes still behave as full AABB tiles.
- **Integration gaps**: temporary surfaces submitted via `SolidSurfaceComponent.addTemporarySurface()` never activate because `updateTemporarySurfaces()` is not called by the game loop (Java’s `update()` handled this automatically), and `raycast()` depends on `collisionDataLoaded`, forcing `BackgroundCollisionComponent` to fall back to coarse tile sampling.
- **Data/origin differences**: level collision tiles are flattened row-major with y=0 at the top in `src/levels/LevelSystemNew.ts`, unlike Java’s column-major with flipped Y; `reset()` in `CollisionSystemNew` leaves `collisionTileDefinitions`/`collisionDataLoaded` intact, so stale segment defs can leak across levels.
- **Resulting symptom**: the new line-segment path is effectively disabled—slopes are treated as solid blocks, `checkSlopeClimb()` rarely succeeds, and moving-platform/door surfaces never register—matching the “new implementation not working” report.

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

Ported verbatim to `src/engine/SortConstants.ts`; see "Rendering" for how
objects get assigned one.

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

Ported verbatim. `LevelSystemNew.ts` derives all four from the screen size the
same way (288.4 at 480x320, giving tight 416.4 / normal 360.6 / wide 576.9) and
every spawn site picks one, mapped against the table in `GameObjectFactory.java`:
story NPCs, the player and The Source are always-active; ordinary enemies are
normal; collectibles, projectiles, doors, buttons, blocks and the shadow slime
are tight.

`GameObjectManager.updateActivation()` tests the same shape the original does —
squared distance from the camera's centre to the object's position against the
radius squared. It used to test a box (half the viewport plus the radius plus a
128px margin, per axis), which covered roughly twice the area.

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

#### Level Binary to JSON Conversion
All `.bin` level files have been converted to JSON format using `scripts/convert-levels-to-json.ts`. The conversion preserves:
- All 4 layer types (background, collision, objects, hotspots)
- Theme and scroll speed data
- Tile data as 2D arrays

**Conversion script:** `bun run scripts/convert-levels-to-json.ts`

#### Non-Linear Level Tree (Important!)
The original game uses a **non-linear "memory tree"** structure for level progression (see README.TXT). This is defined in `Original/res/xml/level_tree.xml` and implemented in `src/data/levelTree.ts`.

**Key characteristics:**
- Levels are organized into **groups** (31 total groups)
- Each group can contain **1-3 levels** that the player can choose between
- Completing **any level** in a group unlocks the **next group**
- Groups alternate between "present" (current story) and "past" (flashback memories)
- This creates a **non-linear narrative** where the player experiences memories out of chronological order

**Example group structure:**
```
Group 0:  [level_0_1_sewer]           → Tutorial (present)
Group 1:  [level_0_2_lab]             → Flashback (past)
Group 2:  [level_3_5_sewer]           → Story continues (present)
...
Group 10: [level_1_5_island,          → Player choice between 3 flashbacks
           level_2_2_grass,
           level_2_3_grass]
```

**Timestamps** represent the chronological position in the story (Memory #000 at `+ 07:12:03` is actually later in time than Memory #001 at `+ 00:00:00`).

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
| `kyle_fall.xml` (cutscene) | `CutscenePlayer.tsx` | ✅ Implemented (KYLE_DEATH) |
| `*_game_over.xml` (cutscene) | `CutscenePlayer.tsx` | ✅ Implemented (WANDA/KABOCHA/ROKUDOU_ENDING) |
| `horizontal_layer*_slide.xml` | `CutscenePlayer.tsx` parallax | ✅ Implemented |
| `rokudou_slide_*.xml` | `CutscenePlayer.tsx` multi-layer parallax | ✅ Implemented |

#### Key Differences: Android vs Web

1. **Android**: Animations are declarative XML, applied to View objects via the Android animation framework
2. **Web Port**: Uses React state/CSS transitions for UI, Canvas API for game rendering
3. **Game Sprite Animations**: Are NOT in `anim/` folder - they're defined programmatically in `GameObjectFactory.java` and `SpriteAnimation.java` using texture coordinates

#### Implementation Notes for Web Port

**Implemented (via `FadeTransition.tsx`):**
- Screen fade in/out for level transitions
- Black screen for loading states
- Customizable duration and color

**Implemented (via `CutscenePlayer.tsx`):**
- Death cutscene (KYLE_DEATH): 16-frame animation at 83ms/frame
- Wanda ending (WANDA_ENDING): Horizontal parallax, good ending
- Kabocha ending (KABOCHA_ENDING): Horizontal parallax with game over text
- Rokudou ending (ROKUDOU_ENDING): Vertical multi-layer parallax (bg, sphere, cliffs, rokudou)
- Accelerate-decelerate interpolation (matching Android)
- Touch/click to skip after animation completes

**Cutscene Data Definitions (`src/data/cutscenes.ts`):**
- `CutsceneType` enum: KYLE_DEATH, WANDA_ENDING, KABOCHA_ENDING, ROKUDOU_ENDING
- `AnimationLayer` interface for parallax layers (sprite, fromX/Y, toX/Y, duration, startOffset, zOrder)
- `FrameAnimation` interface for frame-by-frame animations
- All timing values ported from original XML files

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
bun run dev            # Start Vite dev server with hot reload
bun run build          # Build for production (typecheck + bundle)
bun run preview        # Preview production build locally
bun run lint           # Run ESLint
bun run typecheck      # Run TypeScript type checking
bun test               # Run the test suite (includes headless gameplay simulation)
bun run convert:music  # Re-convert Original/res/raw/bwv_115.mid to a JSON score
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

### Music System (✅ IMPLEMENTED)

The original ships `Original/res/raw/bwv_115.mid` and relies on Android's
built-in General MIDI synthesizer. Browsers have no MIDI synth, so the port:

1. Parses the MIDI once at build time into a note list:
   `bun run convert:music` → `public/assets/sounds/bwv_115.json`
2. Renders that score to an `AudioBuffer` at runtime with `OfflineAudioContext`
   (`SoundSystem.loadBackgroundMusicScore`), using a plucked triangle+sawtooth
   voice, then loops it through the normal music path.

Dropping a real `public/assets/sounds/music.ogg` in place takes precedence over
the synthesized score, so a properly rendered recording can replace it later
without code changes.

### Previously-missing systems, now implemented

- **Ghost/Possession Mechanic**: `GhostComponent.ts`
- **Cutscene Player**: `CanvasCutscene.ts` + `src/data/cutscenes.ts`
- **Evil Kabocha / Rokudou bosses**: composed from `NPCComponent` +
  `DynamicCollisionComponent` + `HitReactionComponent` (+ two
  `LaunchProjectileComponent`s for Rokudou), as in the original
- **Diary System**: `CanvasDiaryOverlay.ts`

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

#### Priority Constants
The full table lives in `src/engine/SortConstants.ts`. Objects are assigned one
at spawn by `LevelSystemNew`'s `drawPriorityFor()`.

### ⚠️ Coordinate System

**Original uses OpenGL coordinates: origin at BOTTOM-LEFT, Y increases UP.**

The web port uses Canvas coordinates (TOP-LEFT, Y increases DOWN) but handles the transformation in the rendering layer so game logic uses the same coordinate system as the original.

### Asset Status

1. **Sprites** (✅ 81% complete): 342 of 420 files copied
   - Missing sprites are for unimplemented features (cutscenes, ghost, Rokudou boss)
   
2. **Audio** (✅ 100% SFX): 22 OGG sound effects loaded
   - Music synthesized from the converted `bwv_115.mid` score
   
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
| `GhostComponent.java` | `GhostComponent.ts` | ✅ |
| `GravityComponent.java` | `GravityComponent.ts` | ✅ |
| `CameraBiasComponent.java` | `CameraBiasComponent.ts` | ✅ |
| `ChangeComponentsComponent.java` | `ChangeComponentsComponent.ts` | ✅ |
| `OrbitalMagnetComponent.java` | `OrbitalMagnetComponent.ts` | ✅ |
| `MotionBlurComponent.java` | `MotionBlurComponent.ts` | ✅ attached to Kyle |
| `FadeDrawableComponent.java` | `FadeDrawableComponent.ts` | ✅ The Source's layers, the glow halo |
| `HitPlayerComponent.java` | `HitPlayerComponent.ts` | ✅ attached to collectibles |
| `SimplePhysicsComponent.java` | — | ❌ not ported |
| `PlaySingleSoundComponent.java` | `PlaySingleSoundComponent.ts` | ⚠️ ported, not attached (EffectsSystem plays those sounds) |
| `FixedAnimationComponent.java` | `FixedAnimationComponent.ts` | ⚠️ ported, not attached (nothing attaches it in the original either) |
| `CrusherAndouComponent.java` | `CrusherAndouComponent.ts` | ⚠️ ported, not attached (object type 59 is in no shipped level) |

---

## Resources

- [Original Replica Island Source](https://code.google.com/archive/p/replicaisland/)
- [Game Programming Patterns](https://gameprogrammingpatterns.com/)
- [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
