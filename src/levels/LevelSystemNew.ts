/**
 * Level System - Manages level loading and state
 * Ported from: Original/src/com/replica/replicaisland/LevelSystem.java
 */

import type { LevelData, LevelLayer, LevelObject, AnimationDefinition, SpriteFrame } from '../types';
import { HitType, Team, ActionType } from '../types';
import type { CollisionSystem } from '../engine/CollisionSystemNew';
import type { GameObjectManager } from '../entities/GameObjectManager';
import type { GameObject } from '../entities/GameObject';
import { LevelParser, type ParsedLevel } from './LevelParser';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { GameObjectTypeIndex, getObjectTypeName } from '../types/GameObjectTypes';
import { NPCComponent } from '../entities/components/NPCComponent';
import { PatrolComponent } from '../entities/components/PatrolComponent';
import { AttackAtDistanceComponent } from '../entities/components/AttackAtDistanceComponent';
import { SleeperComponent } from '../entities/components/SleeperComponent';
import { PopOutComponent } from '../entities/components/PopOutComponent';
import { TheSourceComponent } from '../entities/components/TheSourceComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { DoorAnimationComponent, DoorAnimation } from '../entities/components/DoorAnimationComponent';
import { ButtonAnimationComponent, ButtonAnimation } from '../entities/components/ButtonAnimationComponent';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { HitReactionComponent } from '../entities/components/HitReactionComponent';
import { SolidSurfaceComponent } from '../entities/components/SolidSurfaceComponent';
import { LauncherComponent } from '../entities/components/LauncherComponent';
import { LaunchProjectileComponent } from '../entities/components/LaunchProjectileComponent';
import { LifetimeComponent } from '../entities/components/LifetimeComponent';
import { CameraBiasComponent } from '../entities/components/CameraBiasComponent';
import { SelectDialogComponent } from '../entities/components/SelectDialogComponent';
import { GravityComponent } from '../entities/components/GravityComponent';
import { MovementComponent } from '../entities/components/MovementComponent';
import { GenericAnimationComponent } from '../entities/components/GenericAnimationComponent';
import { SimpleCollisionComponent } from '../entities/components/SimpleCollisionComponent';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { OrbitalMagnetComponent } from '../entities/components/OrbitalMagnetComponent';
import { PlayerComponent } from '../entities/components/PlayerComponent';
import { GameObjectType } from '../entities/GameObjectFactory';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { assetPath } from '../utils/helpers';
import { useGameStore, isLevelUnlocked } from '../stores/useGameStore';
import { levelTree, linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { resetInventory } from '../entities/components/InventoryComponent';
import { GameFlowEventType } from '../engine/GameFlowEvent';
import { CutsceneType } from '../data/cutscenes';
import { EnemyCollisionComponent } from '../entities/components/EnemyCollisionComponent';
import { EnemyAnimationComponent, EnemyAnimation } from '../entities/components/EnemyAnimationComponent';
import { createEnemyAnimations } from '../data/enemyAnimations';
import { createObjectAnimation } from '../data/objectAnimations';
import { HitPlayerComponent } from '../entities/components/HitPlayerComponent';
import { ChangeComponentsComponent } from '../entities/components/ChangeComponentsComponent';
import { GhostComponent } from '../entities/components/GhostComponent';
import { createEnemyCollisionProfile, selectEnemyAttackVolumes } from '../entities/enemyCollisionProfiles';

/** Original: GameObjectFactory.sSurprisedNPCChannel. */
const SURPRISED_NPC_CHANNEL = 'SURPRISED';

/**
 * Objects the original gives a MovementComponent but no GravityComponent: the
 * flyers hold altitude, and Rokudou only falls once his death swap adds gravity
 * (ChangeComponentsComponent with swapAction DEATH).
 */
const FLYING_SUBTYPES = new Set(['bat', 'sting', 'karaguin', 'rokudou']);

/**
 * The original gives these no BackgroundCollisionComponent at all, so they pass
 * straight through terrain.
 */
const NO_BACKGROUND_COLLISION_SUBTYPES = new Set(['bat', 'sting', 'karaguin']);

/**
 * Objects the original gives neither component, so generic physics must not
 * touch them: The Source is a 512px immobile boss that would fall through its
 * arena, Shadow Slimes are driven entirely by PopOutComponent, and turrets are
 * fixed emplacements.
 */
const NO_PHYSICS_SUBTYPES = new Set(['the_source', 'shadowslime', 'turret']);

/**
 * Background collision boxes, from the original's
 * `bgcollision.setSize(w, h)` / `setOffset(x, y)`.
 *
 * These sprites are much wider than the space the character occupies - Wanda is
 * a 64x128 sprite standing in a 32x82 box - so colliding with the whole sprite
 * wedges characters into walls they should walk past.
 *
 * offsetY is converted from the original's Y-up sprite space:
 *   offsetY_down = spriteHeight - (offsetY_up + boxHeight)
 */
const COLLISION_BOXES: Record<string, { width: number; height: number; offsetX: number; offsetY: number }> = {
  brobot: { width: 32, height: 48, offsetX: 16, offsetY: 16 },
  snailbomb: { width: 32, height: 48, offsetX: 16, offsetY: 11 },
  skeleton: { width: 32, height: 48, offsetX: 16, offsetY: 11 },
  onion: { width: 32, height: 48, offsetX: 16, offsetY: 11 },
  mudman: { width: 80, height: 90, offsetX: 32, offsetY: 33 },
  pink_namazu: { width: 100, height: 75, offsetX: 12, offsetY: 48 },
  wanda: { width: 32, height: 82, offsetX: 20, offsetY: 41 },
  kyle: { width: 32, height: 90, offsetX: 20, offsetY: 33 },
  kabocha: { width: 38, height: 82, offsetX: 16, offsetY: 41 },
  evil_kabocha: { width: 38, height: 82, offsetX: 45, offsetY: 41 },
  rokudou: { width: 45, height: 75, offsetX: 45, offsetY: 30 },
};

// Channel names for buttons and doors (must match original)
const RED_BUTTON_CHANNEL = 'RED BUTTON';
const BLUE_BUTTON_CHANNEL = 'BLUE BUTTON';
const GREEN_BUTTON_CHANNEL = 'GREEN BUTTON';

export interface LevelInfo {
  id: number;
  name: string;
  file: string;      // Base filename without extension
  binary: boolean;   // True if .bin format, false if .json
  next: number | null;      // Next level ID (for linear within a group)
  nextGroup: number | null; // First level ID of the next group (for branching)
  groupIndex: number;       // Index of this level's group in levelTree
  unlocked: boolean;
  world: number;     // World/chapter number
  stage: number;     // Stage within world
  inThePast: boolean; // True if this level is a memory/flashback sequence
  restartable: boolean; // Whether the level can be restarted on death
}

export interface SpawnInfo {
  type: number;
  x: number;
  y: number;
  tileX: number;
  tileY: number;
}

export class LevelSystem {
  // Current level state
  private currentLevel: LevelData | null = null;
  private parsedLevel: ParsedLevel | null = null;
  private currentLevelId: number = 0;
  private levels: Map<number, LevelInfo> = new Map();
  
  // Level dimensions
  public widthInTiles: number = 0;
  public heightInTiles: number = 0;
  public tileWidth: number = 32;
  public tileHeight: number = 32;
  
  // References to other systems
  private collisionSystem: CollisionSystem | null = null;
  private gameObjectManager: GameObjectManager | null = null;
  private hotSpotSystem: HotSpotSystem | null = null;
  
  // Player spawn position (for respawning)
  public playerSpawnPosition: { x: number; y: number } = { x: 100, y: 320 };
  
  // Parser
  private levelParser: LevelParser = new LevelParser();
  
  // Game events
  private attempts: number = 0;
  
  // Callbacks for boss deaths to trigger endings
  private onBossDeathCallback: ((endingType: string) => void) | null = null;
  
  // Linear mode - when true, uses linearLevelTree for sequential progression
  private isLinearMode: boolean = false;
  /** Player hit points for this run; overridden per difficulty via setPlayerMaxLife(). */
  private playerMaxLife: number = 3;

  constructor() {
    this.initializeLevelTree();
  }
  
  /**
   * Set linear mode (Extras menu - all levels unlocked in chronological order)
   */
  setLinearMode(linear: boolean): void {
    this.isLinearMode = linear;
    // console.log(`[LevelSystem] Linear mode set to: ${linear}`);
  }

  /**
   * Hit points the spawned player starts with. The original reads this from
   * DifficultyConstants (Baby 5, Kids 3, Adults 2); the caller supplies it so
   * the level system stays free of settings/store imports.
   */
  setPlayerMaxLife(life: number): void {
    this.playerMaxLife = Math.max(1, Math.floor(life));
  }
  
  /**
   * Check if currently in linear mode
   */
  getLinearMode(): boolean {
    return this.isLinearMode;
  }

  /**
   * Initialize the level progression tree from levelTree.ts
   * This builds the branching level structure that matches the original game
   * 
   * The original game has a non-linear "memory tree" where:
   * - Levels are organized into groups
   * - Within a group, all uncompleted levels are available to play in any order
   * - Completing ALL levels in a group unlocks ALL levels in the next group
   */
  private initializeLevelTree(): void {
    // Build level info from the shared levelTree structure
    for (let groupIndex = 0; groupIndex < levelTree.length; groupIndex++) {
      const group = levelTree[groupIndex];
      const nextGroupIndex = groupIndex + 1;
      const nextGroup = nextGroupIndex < levelTree.length ? levelTree[nextGroupIndex] : null;
      
      // Get the first level ID of the next group (for unlocking)
      const nextGroupFirstLevelId = nextGroup 
        ? resourceToLevelId[nextGroup.levels[0].resource] ?? null
        : null;
      
      for (let levelIndex = 0; levelIndex < group.levels.length; levelIndex++) {
        const level = group.levels[levelIndex];
        const levelId = resourceToLevelId[level.resource];
        
        if (levelId === undefined) {
          // console.warn(`[LevelSystem] No level ID for resource: ${level.resource}`);
          continue;
        }
        
        // Extract world and stage from resource name (e.g., 'level_1_2_island' -> world 1, stage 2)
        const match = level.resource.match(/level_(\d+)_(\d+)/);
        const world = match ? parseInt(match[1], 10) : 0;
        const stage = match ? parseInt(match[2], 10) : 0;
        
        // Determine next level (within same group, or first of next group)
        let nextLevelId: number | null = null;
        if (levelIndex + 1 < group.levels.length) {
          // There are more levels in this group - but in the original,
          // completing any level in a group unlocks the next group
          // So "next" should point to the next group
          nextLevelId = nextGroupFirstLevelId;
        } else {
          // Last level in group - next is first level of next group
          nextLevelId = nextGroupFirstLevelId;
        }
        
        const levelInfo: LevelInfo = {
          id: levelId,
          name: level.name,
          file: level.resource,
          binary: true,
          next: nextLevelId,
          nextGroup: nextGroupFirstLevelId,
          groupIndex: groupIndex,
          unlocked: groupIndex === 0, // Only first group is unlocked by default
          world: world,
          stage: stage,
          inThePast: level.inThePast,
          restartable: level.restartable,
        };
        
        this.levels.set(levelId, levelInfo);
      }
    }
    
    // console.log(`[LevelSystem] Initialized ${this.levels.size} levels from levelTree`);
  }

  /**
   * Set references to other systems
   */
  setSystems(
    collision: CollisionSystem, 
    gameObjects: GameObjectManager,
    hotSpots?: HotSpotSystem
  ): void {
    this.collisionSystem = collision;
    this.gameObjectManager = gameObjects;
    this.hotSpotSystem = hotSpots || null;
  }
  
  /**
   * Set callback for boss death events (to trigger ending cutscenes)
   */
  setOnBossDeathCallback(callback: (endingType: string) => void): void {
    this.onBossDeathCallback = callback;
  }

  /**
   * Load a level by ID
   */
  async loadLevel(levelId: number): Promise<boolean> {
    // console.log(`[LevelSystem] Loading level ${levelId}...`);
    const levelInfo = this.levels.get(levelId);
    if (!levelInfo) {
      // console.error(`[LevelSystem] Level ${levelId} not found in level map`);
      return false;
    }
    // console.log(`[LevelSystem] Level info:`, levelInfo.file, 'binary:', levelInfo.binary);

    try {
      // All levels now use JSON format (converted from binary)
      if (levelInfo.binary) {
        return await this.loadConvertedJsonLevel(levelId, levelInfo);
      } else {
        return await this.loadJsonLevel(levelId, levelInfo);
      }
    } catch {
      // Error loading level - return false
      return false;
    }
  }

  /**
   * Load a converted JSON level file (originally binary, now in JSON format)
   */
  private async loadConvertedJsonLevel(levelId: number, levelInfo: LevelInfo): Promise<boolean> {
    // Use .json extension (levels were converted from .bin to .json)
    const url = assetPath(`/assets/levels/${levelInfo.file}.json`);
    
    const parsed = await this.levelParser.parseJsonLevel(url);
    
    if (!parsed) {
      // console.error(`Failed to parse JSON level: ${levelInfo.file}`);
      return false;
    }

    this.parsedLevel = parsed;
    this.currentLevelId = levelId;
    
    // Set dimensions
    this.widthInTiles = parsed.widthInTiles;
    this.heightInTiles = parsed.heightInTiles;
    this.tileWidth = parsed.tileWidth;
    this.tileHeight = parsed.tileHeight;

    // Initialize collision system
    if (this.collisionSystem && parsed.collisionLayer) {
      this.collisionSystem.setTileCollision(
        this.flattenTileArray(parsed.collisionLayer.tiles),
        parsed.collisionLayer.width,
        parsed.collisionLayer.height,
        parsed.tileWidth,
        parsed.tileHeight
      );
    }

    // Initialize hot spot system
    if (this.hotSpotSystem && parsed.hotSpotLayer) {
      this.hotSpotSystem.setWorld(parsed.hotSpotLayer);
      this.hotSpotSystem.setLevelDimensions(
        this.getLevelWidth(),
        this.getLevelHeight(),
        parsed.tileWidth,
        parsed.tileHeight
      );
    }

    // Spawn objects from object layer
    // console.log('[LevelSystem] Object layer:', parsed.objectLayer ? `${parsed.objectLayer.width}x${parsed.objectLayer.height}` : 'null');
    if (parsed.objectLayer) {
      this.spawnObjectsFromLayer(parsed.objectLayer);
    }

    // Convert to LevelData for compatibility
    this.currentLevel = this.convertToLevelData(parsed, levelInfo);

    // console.log(`[LevelSystem] Level ${levelId} loaded successfully. Player spawn:`, this.playerSpawnPosition);
    return true;
  }

  /**
   * Load a JSON level file (legacy format)
   */
  private async loadJsonLevel(levelId: number, levelInfo: LevelInfo): Promise<boolean> {
    const response = await fetch(assetPath(`/assets/levels/${levelInfo.file}.json`));
    if (!response.ok) {
      throw new Error(`Failed to load level: ${response.status}`);
    }

    const levelData: LevelData = await response.json();
    this.currentLevel = levelData;
    this.currentLevelId = levelId;
    this.parsedLevel = null;

    // Set dimensions
    this.widthInTiles = levelData.width;
    this.heightInTiles = levelData.height;
    this.tileWidth = levelData.tileWidth;
    this.tileHeight = levelData.tileHeight;

    // Setup collision system
    if (this.collisionSystem && levelData.collisionData) {
      this.collisionSystem.setWorldCollision(levelData.collisionData.segments);
    }

    // Setup tile collision from layer
    const collisionLayer = levelData.layers.find(l => l.name === 'collision');
    if (collisionLayer && this.collisionSystem) {
      this.collisionSystem.setTileCollision(
        collisionLayer.data,
        levelData.width,
        levelData.height,
        levelData.tileWidth,
        levelData.tileHeight
      );
    }

    // Spawn objects
    this.spawnLevelObjects(levelData.objects);

    return true;
  }

  /**
   * Flatten 2D tile array to 1D (column-major tiles[x][y] -> row-major 1D array)
   */
  private flattenTileArray(tiles: number[][]): number[] {
    // tiles is column-major [x][y], we need row-major output
    const width = tiles.length;
    const height = tiles[0]?.length || 0;
    const result: number[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result.push(tiles[x][y]);
      }
    }
    return result;
  }

  /**
   * Spawn objects from binary object layer
   * Uses column-major tiles[x][y] matching original Java
   * 
   * COORDINATE SYSTEM:
   * - Tile coordinates: y=0 at TOP of level (standard for tile grids)
   * - World/Canvas coordinates: y=0 at TOP (standard for Canvas)
   * - So we DON'T need to flip Y, just convert tile to pixel coords
   */
  private spawnObjectsFromLayer(objectLayer: { width: number; height: number; tiles: number[][] }): void {
    if (!this.gameObjectManager) return;

    // Inventory is per-level in the original game. Because the web port keeps it
    // in a module singleton, it must be reset explicitly whenever a level loads.
    resetInventory();

    // Clear all existing objects before spawning new level objects
    // This prevents crashes when transitioning between levels
    this.gameObjectManager.clear();

    // Reset channel system to clear stale channel data from previous level
    // This ensures buttons and doors get fresh channels
    if (sSystemRegistry.channelSystem) {
      sSystemRegistry.channelSystem.reset();
    }

    const spawnList: SpawnInfo[] = [];

    // console.log(`[LevelSystem] spawnObjectsFromLayer: ${objectLayer.width}x${objectLayer.height}, tiles array length: ${objectLayer.tiles?.length}`);

    // Scan the object layer for spawn points
    // tiles[x][y] is column-major where y=0 is top of level
    for (let y = 0; y < objectLayer.height; y++) {
      for (let x = 0; x < objectLayer.width; x++) {
        const tileValue = objectLayer.tiles[x]?.[y];
        
        // Skip empty tiles (-1) and skip markers (negative values)
        if (tileValue === undefined || tileValue < 0) continue;

        // Calculate world position (pixel coords)
        // Direct conversion: tile coords to pixel coords
        // y=0 tile is at y=0 pixels (top of level)
        const worldX = x * this.tileWidth;
        const worldY = y * this.tileHeight;

        spawnList.push({
          type: tileValue,
          x: worldX,
          y: worldY,
          tileX: x,
          tileY: y,
        });
      }
    }

    // console.log(`[LevelSystem] Found ${spawnList.length} objects to spawn`);

    // Sort by type so player spawns first
    spawnList.sort((a, b) => {
      if (a.type === GameObjectTypeIndex.PLAYER) return -1;
      if (b.type === GameObjectTypeIndex.PLAYER) return 1;
      return 0;
    });

    // Spawn each object
    for (const spawn of spawnList) {
      this.spawnObjectByType(spawn);
    }
  }

  /**
   * Spawn a single object by type index
   * Matches original Java which centers objects in tiles
   */
  private spawnObjectByType(spawn: SpawnInfo): void {
    if (!this.gameObjectManager) return;

    const typeName = getObjectTypeName(spawn.type);
    // console.log(`[LevelSystem] Spawning object: type=${spawn.type} (${typeName}) at tile(${spawn.tileX},${spawn.tileY}) world(${spawn.x},${spawn.y})`);
    
    // Create object 
    const obj = this.gameObjectManager.createObject();
    obj.type = typeName.toLowerCase();

    // Default size (will be overridden per type)
    let objWidth = 32;
    let objHeight = 32;

    // Configure based on type
    switch (spawn.type) {
      case GameObjectTypeIndex.PLAYER: {
        obj.type = 'player';
        // Original Java: sprite is 64x64, collision box is 32x48 with offset (16, 0)
        // The collision box dimensions determine collision detection
        objWidth = 32;    // Collision box width (not sprite width)
        objHeight = 48;   // Collision box height (not sprite height)
        // Hit points for the run. HitReactionComponent decrements this on every
        // HIT, and stops reacting entirely once it reaches zero, so it has to
        // match the difficulty's life count rather than being pinned at 1.
        obj.life = this.playerMaxLife;
        obj.maxLife = this.playerMaxLife;
        obj.team = Team.PLAYER;
        
        // Add PlayerComponent - CRITICAL: Game.tsx expects this to exist
        const playerComp = new PlayerComponent();
        obj.addComponent(playerComp);
        
        // Add SpriteComponent for player rendering
        const playerSprite = new SpriteComponent();
        playerSprite.setSprite('andou_stand'); // Default sprite
        obj.addComponent(playerSprite);
        
        // Dynamic collision for player attacks and vulnerability. The volume
        // sets themselves are owned by PlayerComponent, which swaps them per
        // state the way the original swaps them per animation frame - the HIT
        // attack volume must only be live while stomping or glowing.
        const playerDynCollision = new DynamicCollisionComponent();
        obj.addComponent(playerDynCollision);
        
        // Add HitReactionComponent for damage response
        const playerHitReact = new HitReactionComponent({
          bounceOnHit: true,
          bounceMagnitude: 200,
          invincibleAfterHitTime: 2.0,
          forceInvincibility: false
        });
        playerDynCollision.setHitReactionComponent(playerHitReact);
        obj.addComponent(playerHitReact);
        
        this.gameObjectManager.setPlayer(obj);
        break;
      }

      case GameObjectTypeIndex.COIN:
        obj.type = 'coin';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 100;
        obj.life = 1;
        // The original picks coins up with HitPlayerComponent - a plain radius
        // test rather than the volume pipeline, because coins are numerous.
        this.attachCollectible(obj, { proximityRadius: 32, sound: 'ding' });
        break;

      case GameObjectTypeIndex.RUBY:
        obj.type = 'ruby';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 100;
        obj.life = 1;
        // Rubies and diaries go through the volume pipeline in the original,
        // against Andou's always-present COLLECT volume.
        this.attachCollectible(obj, { volumeRadius: 16 });
        break;

      case GameObjectTypeIndex.DIARY:
        obj.type = 'diary';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 100;
        obj.life = 1;
        this.attachCollectible(obj, { volumeRadius: 16 });
        break;

      case GameObjectTypeIndex.BAT: {
        obj.type = 'enemy';
        obj.subType = 'bat';
        objWidth = 64;   // Sprite is 64x32
        objHeight = 32;
        obj.activationRadius = 200;
        // Add PatrolComponent - flying, 75 speed (from original)
        const batPatrol = new PatrolComponent({
          maxSpeed: 75.0,
          acceleration: 1000.0,
          flying: true,
          turnToFacePlayer: false
        });
        obj.addComponent(batPatrol);
        // Flying patrols do not self-start from zero. The factory seeded both
        // vectors in Android so they move before reaching a direction hotspot.
        obj.setVelocity(75, 0);
        obj.setTargetVelocity(75, 0);
        break;
      }
        
      case GameObjectTypeIndex.STING: {
        obj.type = 'enemy';
        obj.subType = 'sting';
        objWidth = 64;   // Sprite is 64x64
        objHeight = 64;
        obj.activationRadius = 200;
        // Add PatrolComponent - flying, 75 speed (from original)
        const stingPatrol = new PatrolComponent({
          maxSpeed: 75.0,
          acceleration: 1000.0,
          flying: true,
          turnToFacePlayer: false
        });
        obj.addComponent(stingPatrol);
        // Sting intentionally starts slower than its post-turn patrol speed.
        obj.setVelocity(25, 0);
        obj.setTargetVelocity(25, 0);
        break;
      }
        
      case GameObjectTypeIndex.ONION: {
        obj.type = 'enemy';
        obj.subType = 'onion';
        objWidth = 64;   // Sprite is 64x64
        objHeight = 64;
        obj.activationRadius = 200;
        // Add PatrolComponent - ground, 50 speed (from original)
        const onionPatrol = new PatrolComponent({
          maxSpeed: 50.0,
          acceleration: 1000.0,
          flying: false,
          turnToFacePlayer: false
        });
        obj.addComponent(onionPatrol);
        break;
      }
        
      case GameObjectTypeIndex.BROBOT: {
        obj.type = 'enemy';
        obj.subType = 'brobot';
        objWidth = 64;   // Sprite is 64x64
        objHeight = 64;
        obj.activationRadius = 200;
        // Add PatrolComponent - ground, 50 speed (from original)
        const brobotPatrol = new PatrolComponent({
          maxSpeed: 50.0,
          acceleration: 1000.0,
          flying: false,
          turnToFacePlayer: false
        });
        obj.addComponent(brobotPatrol);
        break;
      }
        
      case GameObjectTypeIndex.SKELETON: {
        obj.type = 'enemy';
        obj.subType = 'skeleton';
        objWidth = 64;   // Sprite is 64x64
        objHeight = 64;
        obj.activationRadius = 200;
        // Add PatrolComponent - ground, 20 speed, turn to face player, with attack (from original)
        const skeletonPatrol = new PatrolComponent({
          maxSpeed: 20.0,
          acceleration: 1000.0,
          flying: false,
          turnToFacePlayer: true,
          attack: {
            enabled: true,
            atDistance: 75,
            // Original attack frames: 5 + 1 + 1 frames at 24 fps.
            duration: 7 / 24,
            delay: 2.0,
            stopsMovement: true
          }
        });
        obj.addComponent(skeletonPatrol);
        break;
      }
        
      case GameObjectTypeIndex.SNAILBOMB: {
        obj.type = 'enemy';
        obj.subType = 'snailbomb';
        objWidth = 64;
        objHeight = 64;
        obj.activationRadius = 200;
        obj.addComponent(new PatrolComponent({
          maxSpeed: 20.0,
          acceleration: 1000.0,
          flying: false,
          turnToFacePlayer: false,
          attack: {
            enabled: true,
            atDistance: 300,
            duration: 1.0,
            delay: 4.0,
            stopsMovement: true,
          },
        }));
        obj.addComponent(new LaunchProjectileComponent({
          objectTypeToSpawn: GameObjectType.CANNON_BALL,
          offsetX: 55,
          offsetY: 21,
          velocityX: 100,
          requiredAction: ActionType.ATTACK,
          delayBetweenShots: 0.25,
          projectilesInSet: 3,
          setsPerActivation: 1,
          // The Android launcher fires after the two attack frames (3 + 2).
          delayBeforeFirstSet: 5 / 24,
        }));
        break;
      }
        
      case GameObjectTypeIndex.SHADOWSLIME: {
        obj.type = 'enemy';
        obj.subType = 'shadowslime';
        objWidth = 64;   // Sprite is 64x64
        objHeight = 64;
        obj.activationRadius = 200;
        // Shadowslime uses PopOutComponent - appears/hides based on player distance
        const shadowslimePopOut = new PopOutComponent({
          appearDistance: 2000,
          hideDistance: 4000,
          attackDistance: 200,
          attackDelay: 2.0,
          attackLength: 23 / 24
        });
        obj.addComponent(shadowslimePopOut);

        // The attack animation launches one slow energy ball halfway through.
        obj.addComponent(new LaunchProjectileComponent({
          objectTypeToSpawn: GameObjectType.ENERGY_BALL,
          offsetX: 44,
          offsetY: 22,
          velocityX: 30,
          requiredAction: ActionType.ATTACK,
          projectilesInSet: 1,
          setsPerActivation: 1,
          delayBeforeFirstSet: (23 / 24) / 2,
        }));
        break;
      }
        
      case GameObjectTypeIndex.MUDMAN: {
        obj.type = 'enemy';
        obj.subType = 'mudman';
        objWidth = 128;  // Sprite is 128x128
        objHeight = 128;
        obj.activationRadius = 300;
        // Add PatrolComponent - slow ground, 20 speed, with attack (from original)
        const mudmanPatrol = new PatrolComponent({
          maxSpeed: 20.0,
          acceleration: 400.0,
          flying: false,
          turnToFacePlayer: false,
          attack: {
            enabled: true,
            atDistance: 70,
            // Original attack frames: 2 + 2 + 2 + 2 + 1 + 1 + 8 + 5 at 24 fps.
            duration: 23 / 24,
            delay: 0.0,
            stopsMovement: true
          }
        });
        obj.addComponent(mudmanPatrol);
        break;
      }
        
      case GameObjectTypeIndex.KARAGUIN: {
        obj.type = 'enemy';
        obj.subType = 'karaguin';
        objWidth = 32;   // Sprite is 32x32
        objHeight = 32;
        obj.activationRadius = 200;
        // Add PatrolComponent - flying (swimming), 50 speed (from original)
        const karaguinPatrol = new PatrolComponent({
          maxSpeed: 50.0,
          acceleration: 1000.0,
          flying: true,  // Swimming = flying in water
          turnToFacePlayer: false
        });
        obj.addComponent(karaguinPatrol);
        obj.setVelocity(50, 0);
        obj.setTargetVelocity(50, 0);
        break;
      }
        
      case GameObjectTypeIndex.PINK_NAMAZU: {
        obj.type = 'enemy';
        obj.subType = 'pink_namazu';
        objWidth = 128;   // Sprites are 128x128
        objHeight = 128;
        obj.activationRadius = 250;
        // Pink Namazu uses SleeperComponent - sleeps until camera shakes, then jumps/slams
        const namazuSleeper = new SleeperComponent({
          wakeUpDuration: 1.5,
          slamDuration: 0.3,
          slamMagnitude: 25,
          attackImpulseX: 100,
          attackImpulseY: -170  // Original uses +170 in its Y-up coordinates
        });
        obj.addComponent(namazuSleeper);
        break;
      }
        
      case GameObjectTypeIndex.TURRET:
      case GameObjectTypeIndex.TURRET_LEFT: {
        obj.type = 'enemy';
        obj.subType = 'turret';
        objWidth = 64;
        objHeight = 64;
        obj.activationRadius = 300;
        obj.team = Team.ENEMY;
        obj.facingDirection.x = spawn.type === GameObjectTypeIndex.TURRET_LEFT ? -1 : 1;
        // Turret uses AttackAtDistanceComponent - stationary, shoots at player
        const turretAttack = new AttackAtDistanceComponent({
          attackDistance: 300,
          attackDelay: 0,
          attackLength: 1.0,
          requireFacing: true
        });
        obj.addComponent(turretAttack);

        const turretGun = new LaunchProjectileComponent({
          objectTypeToSpawn: GameObjectType.TURRET_BULLET,
          offsetX: 54,
          offsetY: 13,
          velocityX: 300,
          // Android Y-up -300 points down; Canvas Y-down uses +300.
          velocityY: 300,
          requiredAction: ActionType.ATTACK,
          projectilesInSet: 1,
          delayBetweenSets: 0.3,
          setsPerActivation: -1,
          shootSound: 'sound_gun',
        });
        obj.addComponent(turretGun);
        break;
      }
      
      case GameObjectTypeIndex.THE_SOURCE: {
        // The Source - Final boss (type 42)
        // Multi-layered 512x512 sprite boss with orbital magnet mechanics
        obj.type = 'enemy';
        obj.subType = 'the_source';
        objWidth = 512;   // Large boss sprites are 512x512
        objHeight = 512;
        obj.activationRadius = -1; // Always active (final boss)
        obj.life = 3; // Original: life = 3
        obj.team = Team.PLAYER; // Team.PLAYER means ENEMY attacks can damage it
        
        // Sprite - using the source body sprite
        const sourceSprite = new SpriteComponent();
        sourceSprite.setSprite('enemy_source_body');
        sourceSprite.addAnimation('idle', { frames: [{ x: 0, y: 0, width: 512, height: 512, duration: 1.0 }], loop: true });
        sourceSprite.playAnimation('idle');
        obj.addComponent(sourceSprite);
        
        // Orbital Magnet - creates orbital attraction effect that pulls player around
        // Original: orbit.setup(320.0f, 220.0f) - areaRadius, orbitRadius
        const orbitalMagnet = new OrbitalMagnetComponent();
        orbitalMagnet.setConfig({
          areaRadius: 320,
          magnetRadius: 220,  // Orbital ring radius
          strength: 15.0     // Default strength from original
        });
        // Target will be auto-set to player when available
        obj.addComponent(orbitalMagnet);
        
        // Sphere collision volume for hit detection (256 radius from center)
        // Original uses SphereCollisionVolume(256, 256, 256, HitType.HIT)
        const sourceCollision = new DynamicCollisionComponent();
        const sourceAttackVolume = new SphereCollisionVolume(256, 256, 256, HitType.HIT);
        const sourceVulnVolume = new SphereCollisionVolume(256, 256, 256, HitType.HIT);
        sourceCollision.setCollisionVolumes([sourceAttackVolume], [sourceVulnVolume]);
        obj.addComponent(sourceCollision);
        
        // Hit reaction - manages invincibility after taking damage
        // Original: hitReact.setInvincibleTime(TheSourceComponent.SHAKE_TIME = 0.6f)
        const sourceHitReact = new HitReactionComponent({
          invincibleAfterHitTime: 0.6,
          forceInvincibility: false
        });
        sourceCollision.setHitReactionComponent(sourceHitReact);
        obj.addComponent(sourceHitReact);
        
        // The Source boss component - handles shake, death sequence, explosions
        const sourceComp = new TheSourceComponent();
        sourceComp.setOnDeathChannel(() => {
          // The original broadcasts the shared "SURPRISED" channel when The
          // Source begins collapsing; the rival bosses' NPCAnimationComponents
          // watch that channel and switch to their surprised pose.
          const channel = sSystemRegistry.channelSystem?.registerChannel(SURPRISED_NPC_CHANNEL);
          if (channel) {
            channel.value = { value: true };
          }
        });
        // Configure to trigger Wanda ending on death (event 6 = SHOW_ANIMATION, index 1 = WANDA_ENDING)
        sourceComp.setGameEvent(6, 1);
        // Wire up game event callback to trigger ending cutscene
        if (this.onBossDeathCallback) {
          const callback = this.onBossDeathCallback;
          sourceComp.setOnGameEvent((_event: number, index: number) => {
            // Map event index to ending type: 1 = WANDA_ENDING
            callback(index === 1 ? 'WANDA_ENDING' : 'WANDA_ENDING');
          });
        }
        obj.addComponent(sourceComp);
        break;
      }

      case GameObjectTypeIndex.DOOR_RED:
      case GameObjectTypeIndex.DOOR_BLUE:
      case GameObjectTypeIndex.DOOR_GREEN: {
        obj.type = 'door';
        objWidth = 32;
        objHeight = 64;
        obj.activationRadius = 200;
        
        // Determine color for sprite and channel
        let doorColor = 'red';
        let channelName = RED_BUTTON_CHANNEL;
        if (spawn.type === GameObjectTypeIndex.DOOR_BLUE) {
          doorColor = 'blue';
          channelName = BLUE_BUTTON_CHANNEL;
        } else if (spawn.type === GameObjectTypeIndex.DOOR_GREEN) {
          doorColor = 'green';
          channelName = GREEN_BUTTON_CHANNEL;
        }
        obj.subType = doorColor;
        
        // Create sprite component with door animations
        // Each door frame is a separate 32x64 sprite
        const doorSprite = new SpriteComponent();
        doorSprite.setSprite(`object_door_${doorColor}01`);  // Default to closed state
        
        // Door animations - using frame index for sprite selection
        // Sprites are: 01=closed, 02=middle1, 03=middle2, 04=open
        // Sprites: 01 closed, 02/03 mid-swing, 04 open. Naming the image on
        // each frame is what lets SpriteComponent draw the door itself.
        const doorArt = (n: string): string => `object_door_${doorColor}${n}`;
        const doorFrame = (n: string, duration: number): SpriteFrame =>
          ({ x: 0, y: 0, width: 32, height: 64, duration, sprite: doorArt(n) });
        const closedAnim: AnimationDefinition = {
          name: 'closed',
          frames: [doorFrame('01', 1.0)],
          loop: false
        };
        const openAnim: AnimationDefinition = {
          name: 'open',
          frames: [doorFrame('04', 1.0)],
          loop: false
        };
        const openingAnim: AnimationDefinition = {
          name: 'opening',
          frames: [doorFrame('02', 0.083), doorFrame('03', 0.083)],
          loop: false
        };
        const closingAnim: AnimationDefinition = {
          name: 'closing',
          frames: [doorFrame('03', 0.083), doorFrame('02', 0.083)],
          loop: false
        };
        
        doorSprite.addAnimationAtIndex(DoorAnimation.CLOSED, closedAnim);
        doorSprite.addAnimationAtIndex(DoorAnimation.OPEN, openAnim);
        doorSprite.addAnimationAtIndex(DoorAnimation.OPENING, openingAnim);
        doorSprite.addAnimationAtIndex(DoorAnimation.CLOSING, closingAnim);
        doorSprite.playAnimation(DoorAnimation.CLOSED);
        obj.addComponent(doorSprite);
        
        // Create door animation component
        const doorAnim = new DoorAnimationComponent({
          stayOpenTime: 5.0,
          openSound: 'sound_open',
          closeSound: 'sound_close'
        });
        doorAnim.setSprite(doorSprite);
        
        // Link to channel
        if (sSystemRegistry.channelSystem) {
          const channel = sSystemRegistry.channelSystem.registerChannel(channelName);
          if (channel) {
            doorAnim.setChannel(channel);
          }
        }
        
        // Create solid surface for door collision (rectangular box)
        const solidSurface = new SolidSurfaceComponent();
        solidSurface.createRectangle(objWidth, objHeight);
        obj.addComponent(solidSurface);
        
        // Link the solid surface to the door animation component
        // so it can be removed/added when door opens/closes
        doorAnim.setSolidSurface(solidSurface);
        obj.addComponent(doorAnim);
        
        // Create dynamic collision for deadly closing door
        const doorDynCollision = new DynamicCollisionComponent();
        obj.addComponent(doorDynCollision);
        
        // Hit reaction for the door
        const doorHitReact = new HitReactionComponent({
          forceInvincibility: true // Doors can't be destroyed
        });
        doorDynCollision.setHitReactionComponent(doorHitReact);
        obj.addComponent(doorHitReact);
        break;
      }

      case GameObjectTypeIndex.BUTTON_RED:
      case GameObjectTypeIndex.BUTTON_BLUE:
      case GameObjectTypeIndex.BUTTON_GREEN: {
        obj.type = 'button';
        objWidth = 32;
        objHeight = 32; // Use 32 for collision detection
        obj.activationRadius = 200;
        // Original: Team.NONE. GameObjectCollisionSystem rejects same-team
        // hits, so an ENEMY button could not be depressed by a brobot.
        obj.team = Team.NONE;
        
        // Determine color for sprite and channel
        let buttonColor = 'red';
        let buttonChannelName = RED_BUTTON_CHANNEL;
        if (spawn.type === GameObjectTypeIndex.BUTTON_BLUE) {
          buttonColor = 'blue';
          buttonChannelName = BLUE_BUTTON_CHANNEL;
        } else if (spawn.type === GameObjectTypeIndex.BUTTON_GREEN) {
          buttonColor = 'green';
          buttonChannelName = GREEN_BUTTON_CHANNEL;
        }
        obj.subType = buttonColor;
        
        // Create sprite component with button animations
        const buttonSprite = new SpriteComponent();
        buttonSprite.setSprite(`object_button_${buttonColor}`);
        
        // Button animations: up and down states
        const upAnim: AnimationDefinition = {
          name: 'up',
          frames: [{
            x: 0, y: 0, width: 32, height: 32, duration: 1.0,
            sprite: `object_button_${buttonColor}`,
          }],
          loop: false
        };
        const downAnim: AnimationDefinition = {
          name: 'down',
          frames: [{
            x: 0, y: 0, width: 32, height: 32, duration: 1.0,
            sprite: `object_button_pressed_${buttonColor}`,
          }],
          loop: false
        };
        
        buttonSprite.addAnimationAtIndex(ButtonAnimation.UP, upAnim);
        buttonSprite.addAnimationAtIndex(ButtonAnimation.DOWN, downAnim);
        buttonSprite.playAnimation(ButtonAnimation.UP);
        obj.addComponent(buttonSprite);
        
        // Create button animation component
        const buttonAnim = new ButtonAnimationComponent({
          depressSound: 'sound_button'
        });
        buttonAnim.setSprite(buttonSprite);
        
        // Link to channel
        if (sSystemRegistry.channelSystem) {
          const channel = sSystemRegistry.channelSystem.registerChannel(buttonChannelName);
          if (channel) {
            buttonAnim.setChannel(channel);
          }
        }
        obj.addComponent(buttonAnim);
        
        // Create dynamic collision component
        const buttonDynCollision = new DynamicCollisionComponent();
        
        // Create vulnerability volume for button (can be depressed by stomp)
        // The button is in the top 16px of the 32px collision height
        const buttonVulnerability = new AABoxCollisionVolume(0, 0, 32, 16, HitType.DEPRESS);
        buttonDynCollision.setCollisionVolumes(null, [buttonVulnerability]);
        obj.addComponent(buttonDynCollision);
        
        // Hit reaction for the button
        const buttonHitReact = new HitReactionComponent({
          forceInvincibility: false
        });
        buttonDynCollision.setHitReactionComponent(buttonHitReact);
        obj.addComponent(buttonHitReact);
        break;
      }

      case GameObjectTypeIndex.WANDA: {
        obj.type = 'npc';
        obj.subType = 'wanda';
        objWidth = 64;   // Sprite is 64x128
        objHeight = 128;
        obj.activationRadius = 2000; // Large radius to keep NPC active during cutscenes
        obj.team = Team.ENEMY;
        obj.facingDirection.x = -1;
        // Add NPC movement component
        const npcComponent = new NPCComponent();
        obj.addComponent(npcComponent);
        
        // Add LaunchProjectileComponent for Wanda's neutral story projectile.
        const wandaGun = new LaunchProjectileComponent({
          objectTypeToSpawn: GameObjectType.WANDA_SHOT,
          projectilesInSet: 1,
          setsPerActivation: 1,
          delayBeforeFirstSet: 11 / 24, // Utils.framesToTime(24, 11) = 11 frames at 24fps
          offsetX: 45,
          offsetY: 42,
          requiredAction: ActionType.ATTACK,
          velocityX: 300.0,
          shootSound: 'sound_poing'
        });
        obj.addComponent(wandaGun);
        break;
      }
        
      case GameObjectTypeIndex.KYLE: {
        obj.type = 'npc';
        obj.subType = 'kyle';
        objWidth = 64;   // Sprite is 64x128
        objHeight = 128;
        obj.activationRadius = 2000; // Large radius to keep NPC active during cutscenes
        obj.team = Team.NONE;
        obj.facingDirection.x = -1;
        // Kyle's final sewer sequence relies on a GAME_EVENT hotspot. Match the
        // original's faster movement tuning and launch the Kyle death cutscene
        // when he reaches that hotspot.
        const npcComponent2 = new NPCComponent({
          horizontalImpulse: 350,
          slowHorizontalImpulse: 50,
          upImpulse: -400,
          downImpulse: 10,
          acceleration: 400,
          gameEvent: GameFlowEventType.SHOW_ANIMATION,
          gameEventIndex: CutsceneType.KYLE_DEATH,
          spawnGameEventOnDeath: false,
        });
        obj.addComponent(npcComponent2);
        break;
      }
        
      case GameObjectTypeIndex.KABOCHA: {
        obj.type = 'npc';
        obj.subType = 'kabocha';
        objWidth = 64;   // Sprite is 64x128
        objHeight = 128;
        obj.activationRadius = 2000; // Large radius to keep NPC active during cutscenes
        obj.team = Team.ENEMY;
        obj.facingDirection.x = -1;
        const npcComponent3 = new NPCComponent();
        obj.addComponent(npcComponent3);
        break;
      }
      
      case GameObjectTypeIndex.EVIL_KABOCHA: {
        // Evil Kabocha boss (type 29) - Mini boss
        obj.type = 'enemy';
        obj.subType = 'evil_kabocha';
        objWidth = 128;   // Sprites are 128x128
        objHeight = 128;
        obj.activationRadius = 400; // Boss has larger activation radius
        obj.life = 3;
        obj.team = Team.ENEMY;
        obj.facingDirection.x = -1;
        
        // Add SpriteComponent for rendering
        const evilKabochaSprite = new SpriteComponent();
        evilKabochaSprite.setSprite('enemy_kabocha_evil_stand');
        obj.addComponent(evilKabochaSprite);
        
        // Kabocha is an NPC that walks the arena's hot-spot track, reacts to
        // hits, and posts the ending animation when it dies. Original:
        // spawnEnemyEvilKabocha() - patrol.setSpeeds(50, 50, 0, -10, 200),
        // setReactToHits(true), setGameEvent(SHOW_ANIMATION, ROKUDOU_ENDING).
        const kabochaPatrol = new NPCComponent({
          horizontalImpulse: 50,
          slowHorizontalImpulse: 50,
          upImpulse: 0,
          downImpulse: 10,
          acceleration: 200,
          reactToHits: true,
          gameEvent: GameFlowEventType.SHOW_ANIMATION,
          // Defeating Kabocha leaves Rokudou in control in the original.
          gameEventIndex: CutsceneType.ROKUDOU_ENDING,
          spawnGameEventOnDeath: true,
        });
        obj.addComponent(kabochaPatrol);

        // Damage is resolved by GameObjectCollisionSystem against this volume.
        // Original: AABoxCollisionVolume(52, 5, 26, 80) in Y-up sprite space;
        // this port measures offsetY from the top of the 128px sprite.
        const kabochaCollision = new DynamicCollisionComponent();
        kabochaCollision.setCollisionVolumes(
          null,
          [new AABoxCollisionVolume(52, 43, 26, 80, HitType.HIT)]
        );
        const kabochaHitReact = new HitReactionComponent({
          invincibleAfterHitTime: 1.0,
          onHitSound: 'sound_kabocha_hit',
        });
        kabochaHitReact.setSoundPlayer((sound) => {
          sSystemRegistry.soundSystem?.playSfx(sound);
        });
        kabochaCollision.setHitReactionComponent(kabochaHitReact);
        kabochaPatrol.setHitReactionComponent(kabochaHitReact);
        obj.addComponent(kabochaCollision);
        obj.addComponent(kabochaHitReact);
        break;
      }
        
      case GameObjectTypeIndex.ROKUDOU: {
        // Rokudou boss enemy (type 30 - distinct from ROKUDOU_TERMINAL which is NPC)
        obj.type = 'enemy';
        obj.subType = 'rokudou';
        objWidth = 128;  // Large boss sprite is 128x128
        objHeight = 128;
        obj.activationRadius = 400; // Boss has larger activation radius
        obj.life = 3; // Boss has 3 hit points
        obj.team = Team.ENEMY;
        obj.facingDirection.x = -1;
        
        // Add SpriteComponent for rendering
        const rokudouSprite = new SpriteComponent();
        rokudouSprite.setSprite('enemy_rokudou_fight_stand');
        obj.addComponent(rokudouSprite);
        
        // Rokudou flies the arena's hot-spot track and fires while an ATTACK
        // hot spot holds him in ActionType.ATTACK. Original:
        // spawnEnemyRokudou() - patrol.setSpeeds(500, 100, 100, -100, 400),
        // setFlying(true), setReactToHits(true), setPauseOnAttack(false),
        // setGameEvent(SHOW_ANIMATION, KABOCHA_ENDING).
        const rokudouPatrol = new NPCComponent({
          horizontalImpulse: 500,
          slowHorizontalImpulse: 100,
          upImpulse: -100,
          downImpulse: 100,
          acceleration: 400,
          flying: true,
          reactToHits: true,
          pauseOnAttack: false,
          gameEvent: GameFlowEventType.SHOW_ANIMATION,
          // Defeating Rokudou leaves Kabocha in control in the original.
          gameEventIndex: CutsceneType.KABOCHA_ENDING,
          spawnGameEventOnDeath: true,
        });
        obj.addComponent(rokudouPatrol);

        // Original: AABoxCollisionVolume(45, 23, 42, 75) in Y-up sprite space.
        const rokudouCollision = new DynamicCollisionComponent();
        rokudouCollision.setCollisionVolumes(
          null,
          [new AABoxCollisionVolume(45, 30, 42, 75, HitType.HIT)]
        );
        const rokudouHitReact = new HitReactionComponent({
          invincibleAfterHitTime: 1.0,
          onHitSound: 'sound_rokudou_hit',
        });
        rokudouHitReact.setSoundPlayer((sound) => {
          sSystemRegistry.soundSystem?.playSfx(sound);
        });
        rokudouCollision.setHitReactionComponent(rokudouHitReact);
        rokudouPatrol.setHitReactionComponent(rokudouHitReact);
        obj.addComponent(rokudouCollision);
        obj.addComponent(rokudouHitReact);

        // Two guns, both gated on ActionType.ATTACK so they only fire while the
        // hot-spot script has him attacking: a slow energy ball and a faster
        // five-round burst.
        obj.addComponent(new LaunchProjectileComponent({
          objectTypeToSpawn: GameObjectType.ENERGY_BALL,
          projectilesInSet: 1,
          setsPerActivation: -1,
          delayBetweenSets: 1.5,
          offsetX: 75,
          offsetY: 42,
          requiredAction: ActionType.ATTACK,
          velocityX: 300,
          velocityY: -300,
          shootSound: 'sound_poing',
        }));
        obj.addComponent(new LaunchProjectileComponent({
          objectTypeToSpawn: GameObjectType.TURRET_BULLET,
          projectilesInSet: 5,
          delayBetweenShots: 0.1,
          setsPerActivation: -1,
          delayBetweenSets: 2.5,
          offsetX: 75,
          offsetY: 42,
          requiredAction: ActionType.ATTACK,
          velocityX: 300,
          velocityY: -300,
          shootSound: 'sound_gun',
        }));
        break;
      }
      
      case GameObjectTypeIndex.BREAKABLE_BLOCK: {
        // Breakable/destructible block (type 41)
        // Can be destroyed by player attacks
        obj.type = 'breakable_block';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 500; // Large radius to ensure blocks are active when NPC approaches
        obj.life = 1;
        obj.team = Team.ENEMY; // Can be damaged by player
        
        // console.log(`[LevelSystem] Spawning breakable_block at tile (${spawn.tileX}, ${spawn.tileY}) world (${spawn.x}, ${spawn.y})`);
        
        // Add dynamic collision component for hit detection
        const blockCollision = new DynamicCollisionComponent();
        // Vulnerability volume - can be hit from any direction
        const blockVulnerability = new AABoxCollisionVolume(7, 0, 32 - 7, 42, HitType.HIT);
        blockCollision.setCollisionVolumes(null, [blockVulnerability]);
        obj.addComponent(blockCollision);
        
        // Hit reaction - takes damage and dies
        const blockHitReact = new HitReactionComponent({
          forceInvincibility: false
        });
        blockCollision.setHitReactionComponent(blockHitReact);
        obj.addComponent(blockHitReact);
        
        // Add solid surface component so player can stand on the block
        const solidSurface = new SolidSurfaceComponent();
        // Create a 32x32 rectangular solid
        solidSurface.createRectangle(32, 32);
        obj.addComponent(solidSurface);
        break;
      }

      // ============================================
      // NEW OBJECT TYPES - CANNONS, SPAWNERS, ETC.
      // ============================================

      case GameObjectTypeIndex.CANNON: {
        // Cannon - launches player upward on contact
        obj.type = 'cannon';
        objWidth = 64;
        objHeight = 128;
        obj.activationRadius = 200;
        obj.team = Team.NONE;
        
        // Launcher component - launches player with cannon effect
        const launcherComp = new LauncherComponent({
          angle: Math.PI, // Canvas Y points down, so PI launches upward
          magnitude: 2000,
          launchDelay: 2.0,
          postLaunchDelay: 1.0,
          launchEffect: GameObjectType.SMOKE_POOF,
          launchEffectOffsetX: 32,
          launchEffectOffsetY: 85,
          launchSound: 'sound_cannon'
        });
        obj.addComponent(launcherComp);
        
        // Dynamic collision to detect player contact
        const cannonCollision = new DynamicCollisionComponent();
        const cannonAttackVolume = new AABoxCollisionVolume(16, 16, 32, 80, HitType.LAUNCH);
        cannonCollision.setCollisionVolumes([cannonAttackVolume], null);
        obj.addComponent(cannonCollision);
        
        // Hit reaction
        const cannonHitReact = new HitReactionComponent({
          forceInvincibility: true
        });
        cannonCollision.setHitReactionComponent(cannonHitReact);
        // The original fires Andou from HitReactionComponent.hitVictim() when
        // the cannon's LAUNCH volume overlaps him.
        cannonHitReact.setLauncherComponent(launcherComp, HitType.LAUNCH);
        obj.addComponent(cannonHitReact);
        
        // Generic animation component
        const cannonAnim = new GenericAnimationComponent();
        obj.addComponent(cannonAnim);
        break;
      }

      case GameObjectTypeIndex.BROBOT_SPAWNER:
      case GameObjectTypeIndex.BROBOT_SPAWNER_LEFT: {
        // Brobot spawner machine - periodically spawns brobot enemies
        obj.type = 'spawner';
        obj.subType = 'brobot_spawner';
        objWidth = 64;
        objHeight = 64;
        obj.activationRadius = 200;
        obj.team = Team.ENEMY;
        // BROBOT_SPAWNER_LEFT is the horizontally flipped variant; the launcher
        // mirrors its spawn offset and velocity from facingDirection.
        obj.facingDirection.x = spawn.type === GameObjectTypeIndex.BROBOT_SPAWNER_LEFT ? -1 : 1;
        
        // Add SpriteComponent for rendering the machine
        const spawnerSprite = new SpriteComponent();
        spawnerSprite.setSprite('object_brobot_machine');
        obj.addComponent(spawnerSprite);
        
        const spawnerLauncher = new LaunchProjectileComponent({
          objectTypeToSpawn: GameObjectType.ENEMY_BROBOT,
          delayBeforeFirstSet: 3.0,
          velocityX: 100,
          // Android +300 launches upward; Canvas uses negative Y for up.
          velocityY: -300,
          trackProjectiles: true,
          maxTrackedProjectiles: 1,
          offsetX: 36,
          offsetY: 50,
        });
        obj.addComponent(spawnerLauncher);
        
        // Solid surface so player can stand on it
        const spawnerSolid = new SolidSurfaceComponent();
        // Trapezoid shape matching original
        spawnerSolid.addSurfaceFromCoords(0, 0, 8, 59, -0.9953, 0.0965);
        spawnerSolid.addSurfaceFromCoords(8, 59, 61, 33, 0.4455, 0.8953);
        spawnerSolid.addSurfaceFromCoords(61, 33, 61, 0, 1, 0);
        obj.addComponent(spawnerSolid);
        
        // Dynamic collision - can be possessed
        const spawnerCollision = new DynamicCollisionComponent();
        const spawnerVulnerability = new SphereCollisionVolume(32, 32, 32, HitType.POSSESS);
        spawnerCollision.setCollisionVolumes(null, [spawnerVulnerability]);
        obj.addComponent(spawnerCollision);
        break;
      }

      case GameObjectTypeIndex.INFINITE_SPAWNER: {
        // Invisible infinite spawner - spawns enemies indefinitely
        obj.type = 'spawner';
        obj.subType = 'infinite';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 300;
        obj.team = Team.NONE;
        
        // Launch projectile component configured for infinite spawning
        const infiniteSpawner = new LaunchProjectileComponent({
          objectTypeToSpawn: GameObjectType.ENEMY_BROBOT,
          delayBeforeFirstSet: 3.0,
          delayBetweenSets: 4.0,
          setsPerActivation: -1, // Infinite
          projectilesInSet: 1,
          velocityX: 0,
          velocityY: 0,
          trackProjectiles: false
        });
        obj.addComponent(infiniteSpawner);
        break;
      }

      case GameObjectTypeIndex.HINT_SIGN: {
        // Hint sign - shows tutorial text when touched
        obj.type = 'hint_sign';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 100;
        obj.team = Team.NONE;
        
        // Dynamic collision for collection
        const signCollision = new DynamicCollisionComponent();
        const signVulnerability = new AABoxCollisionVolume(8, 0, 24, 32, HitType.COLLECT);
        signCollision.setCollisionVolumes(null, [signVulnerability]);
        obj.addComponent(signCollision);
        
        // Hit reaction to trigger dialog
        const signHitReact = new HitReactionComponent({
          forceInvincibility: true
        });
        signCollision.setHitReactionComponent(signHitReact);
        obj.addComponent(signHitReact);
        
        // Select dialog component for showing hints
        const dialogSelect = new SelectDialogComponent();
        obj.addComponent(dialogSelect);
        break;
      }

      case GameObjectTypeIndex.KABOCHA_TERMINAL:
      case GameObjectTypeIndex.ROKUDOU_TERMINAL: {
        // Story terminals - static displays showing Kabocha or Rokudou
        obj.type = 'terminal';
        obj.subType = spawn.type === GameObjectTypeIndex.KABOCHA_TERMINAL ? 'kabocha' : 'rokudou';
        objWidth = 64;
        objHeight = 64;
        obj.activationRadius = 2000;
        obj.team = Team.NONE;
        
        // NPC component for scripted behavior
        const terminalNpc = new NPCComponent();
        obj.addComponent(terminalNpc);
        break;
      }

      case GameObjectTypeIndex.GHOST_NPC: {
        // Ghost NPC - invisible NPC used in cutscenes
        obj.type = 'npc';
        obj.subType = 'ghost';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 10000; // Always active
        obj.team = Team.NONE;
        obj.life = 1;
        
        // Gravity component (ghost may fall)
        const ghostGravity = new GravityComponent();
        obj.addComponent(ghostGravity);
        
        // Movement component for scripted movement
        const ghostMovement = new MovementComponent();
        obj.addComponent(ghostMovement);
        
        // NPC component for hot spot controlled behavior
        const ghostNpc = new NPCComponent();
        obj.addComponent(ghostNpc);
        
        // Lifetime component (ghost may have limited life)
        const ghostLifetime = new LifetimeComponent();
        obj.addComponent(ghostLifetime);
        break;
      }

      case GameObjectTypeIndex.CAMERA_BIAS: {
        // Camera bias point - shifts camera when player is nearby
        obj.type = 'camera_bias';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 200;
        obj.team = Team.NONE;
        
        // Camera bias component
        const bias = new CameraBiasComponent();
        obj.addComponent(bias);
        break;
      }

      case GameObjectTypeIndex.CRUSHER_ANDOU: {
        // Crusher Android - special enemy that crushes player
        obj.type = 'enemy';
        obj.subType = 'crusher_andou';
        objWidth = 64;
        objHeight = 64;
        obj.activationRadius = 200;
        obj.life = 1;
        obj.team = Team.ENEMY;
        
        // Movement component
        const crusherMovement = new MovementComponent();
        obj.addComponent(crusherMovement);
        
        // Gravity component
        const crusherGravity = new GravityComponent();
        obj.addComponent(crusherGravity);
        
        // Patrol component for movement
        const crusherPatrol = new PatrolComponent({
          maxSpeed: 75.0,
          acceleration: 1000.0,
          flying: false,
          turnToFacePlayer: false
        });
        obj.addComponent(crusherPatrol);
        
        // Dynamic collision
        const crusherCollision = new DynamicCollisionComponent();
        const crusherAttack = new AABoxCollisionVolume(16, 0, 32, 64, HitType.HIT);
        crusherCollision.setCollisionVolumes([crusherAttack], null);
        obj.addComponent(crusherCollision);
        
        // Hit reaction
        const crusherHitReact = new HitReactionComponent({
          forceInvincibility: false
        });
        crusherCollision.setHitReactionComponent(crusherHitReact);
        obj.addComponent(crusherHitReact);
        break;
      }

      case GameObjectTypeIndex.ANDOU_DEAD:
      case GameObjectTypeIndex.KYLE_DEAD: {
        // Dead character decorations - static sprites
        obj.type = 'decoration';
        obj.subType = spawn.type === GameObjectTypeIndex.ANDOU_DEAD ? 'andou_dead' : 'kyle_dead';
        objWidth = spawn.type === GameObjectTypeIndex.KYLE_DEAD ? 128 : 64;
        objHeight = spawn.type === GameObjectTypeIndex.KYLE_DEAD ? 32 : 64;
        obj.activationRadius = 100;
        obj.team = Team.NONE;
        // Just a static sprite, no components needed
        break;
      }

      case GameObjectTypeIndex.DOOR_RED_NONBLOCKING:
      case GameObjectTypeIndex.DOOR_BLUE_NONBLOCKING:
      case GameObjectTypeIndex.DOOR_GREEN_NONBLOCKING: {
        // Non-blocking doors - same as regular doors but don't block movement
        obj.type = 'door';
        objWidth = 32;
        objHeight = 64;
        obj.activationRadius = 200;
        
        // Determine color for sprite and channel
        let nbDoorColor = 'red';
        let nbChannelName = RED_BUTTON_CHANNEL;
        if (spawn.type === GameObjectTypeIndex.DOOR_BLUE_NONBLOCKING) {
          nbDoorColor = 'blue';
          nbChannelName = BLUE_BUTTON_CHANNEL;
        } else if (spawn.type === GameObjectTypeIndex.DOOR_GREEN_NONBLOCKING) {
          nbDoorColor = 'green';
          nbChannelName = GREEN_BUTTON_CHANNEL;
        }
        obj.subType = nbDoorColor + '_nonblocking';
        
        // Create sprite component with door animations
        const nbDoorSprite = new SpriteComponent();
        nbDoorSprite.setSprite(`object_door_${nbDoorColor}01`);
        
        const nbClosedAnim: AnimationDefinition = {
          name: 'closed',
          frames: [{ x: 0, y: 0, width: 32, height: 64, duration: 1.0 }],
          loop: false
        };
        const nbOpenAnim: AnimationDefinition = {
          name: 'open',
          frames: [{ x: 0, y: 0, width: 32, height: 64, duration: 1.0 }],
          loop: false
        };
        const nbOpeningAnim: AnimationDefinition = {
          name: 'opening',
          frames: [
            { x: 0, y: 0, width: 32, height: 64, duration: 0.083 },
            { x: 0, y: 0, width: 32, height: 64, duration: 0.083 }
          ],
          loop: false
        };
        const nbClosingAnim: AnimationDefinition = {
          name: 'closing',
          frames: [
            { x: 0, y: 0, width: 32, height: 64, duration: 0.083 },
            { x: 0, y: 0, width: 32, height: 64, duration: 0.083 }
          ],
          loop: false
        };
        
        nbDoorSprite.addAnimationAtIndex(DoorAnimation.CLOSED, nbClosedAnim);
        nbDoorSprite.addAnimationAtIndex(DoorAnimation.OPEN, nbOpenAnim);
        nbDoorSprite.addAnimationAtIndex(DoorAnimation.OPENING, nbOpeningAnim);
        nbDoorSprite.addAnimationAtIndex(DoorAnimation.CLOSING, nbClosingAnim);
        nbDoorSprite.playAnimation(DoorAnimation.CLOSED);
        obj.addComponent(nbDoorSprite);
        
        // Create door animation component
        const nbDoorAnim = new DoorAnimationComponent({
          stayOpenTime: 5.0,
          openSound: 'sound_open',
          closeSound: 'sound_close'
        });
        nbDoorAnim.setSprite(nbDoorSprite);
        
        // Link to channel
        if (sSystemRegistry.channelSystem) {
          const nbChannel = sSystemRegistry.channelSystem.registerChannel(nbChannelName);
          if (nbChannel) {
            nbDoorAnim.setChannel(nbChannel);
          }
        }
        obj.addComponent(nbDoorAnim);
        // Note: No solid surface component - door doesn't block
        break;
      }

      // ============================================
      // PROJECTILE TYPES
      // ============================================

      case GameObjectTypeIndex.CANNON_BALL: {
        // Cannon ball projectile
        obj.type = 'projectile';
        obj.subType = 'cannon_ball';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 200;
        obj.team = Team.ENEMY;
        
        // Lifetime - dies after 3 seconds or on hitting background
        const cannonBallLife = new LifetimeComponent();
        cannonBallLife.setTimeUntilDeath(3.0);
        cannonBallLife.setDieOnHitBackground(true);
        obj.addComponent(cannonBallLife);
        
        // Movement component
        const cannonBallMove = new MovementComponent();
        obj.addComponent(cannonBallMove);
        
        // Dynamic collision with attack volume
        const cannonBallCollision = new DynamicCollisionComponent();
        const cannonBallAttack = new SphereCollisionVolume(8, 16, 16, HitType.HIT);
        cannonBallCollision.setCollisionVolumes([cannonBallAttack], null);
        obj.addComponent(cannonBallCollision);
        
        // Simple collision for background hits
        const cannonBallSimple = new SimpleCollisionComponent();
        obj.addComponent(cannonBallSimple);
        
        // Hit reaction - dies on attacking
        const cannonBallHitReact = new HitReactionComponent({
          dieOnAttack: true
        });
        cannonBallCollision.setHitReactionComponent(cannonBallHitReact);
        obj.addComponent(cannonBallHitReact);
        break;
      }

      case GameObjectTypeIndex.TURRET_BULLET: {
        // Turret bullet projectile
        obj.type = 'projectile';
        obj.subType = 'turret_bullet';
        objWidth = 16;
        objHeight = 16;
        obj.activationRadius = 200;
        obj.team = Team.ENEMY;
        
        // Lifetime
        const turretBulletLife = new LifetimeComponent();
        turretBulletLife.setTimeUntilDeath(3.0);
        turretBulletLife.setDieOnHitBackground(true);
        obj.addComponent(turretBulletLife);
        
        // Movement
        const turretBulletMove = new MovementComponent();
        obj.addComponent(turretBulletMove);
        
        // Dynamic collision
        const turretBulletCollision = new DynamicCollisionComponent();
        const turretBulletAttack = new SphereCollisionVolume(8, 8, 8, HitType.HIT);
        turretBulletCollision.setCollisionVolumes([turretBulletAttack], null);
        obj.addComponent(turretBulletCollision);
        
        // Hit reaction
        const turretBulletHitReact = new HitReactionComponent({
          dieOnAttack: true
        });
        turretBulletCollision.setHitReactionComponent(turretBulletHitReact);
        obj.addComponent(turretBulletHitReact);
        break;
      }

      case GameObjectTypeIndex.BROBOT_BULLET: {
        // Brobot bullet projectile
        obj.type = 'projectile';
        obj.subType = 'brobot_bullet';
        objWidth = 16;
        objHeight = 16;
        obj.activationRadius = 200;
        obj.team = Team.ENEMY;
        
        // Lifetime
        const brobotBulletLife = new LifetimeComponent();
        brobotBulletLife.setTimeUntilDeath(3.0);
        brobotBulletLife.setDieOnHitBackground(true);
        obj.addComponent(brobotBulletLife);
        
        // Movement
        const brobotBulletMove = new MovementComponent();
        obj.addComponent(brobotBulletMove);
        
        // Dynamic collision
        const brobotBulletCollision = new DynamicCollisionComponent();
        const brobotBulletAttack = new SphereCollisionVolume(8, 8, 8, HitType.HIT);
        brobotBulletCollision.setCollisionVolumes([brobotBulletAttack], null);
        obj.addComponent(brobotBulletCollision);
        
        // Hit reaction
        const brobotBulletHitReact = new HitReactionComponent({
          dieOnAttack: true
        });
        brobotBulletCollision.setHitReactionComponent(brobotBulletHitReact);
        obj.addComponent(brobotBulletHitReact);
        break;
      }

      case GameObjectTypeIndex.ENERGY_BALL: {
        // Energy ball projectile (boss attacks)
        obj.type = 'projectile';
        obj.subType = 'energy_ball';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 300;
        obj.team = Team.ENEMY;
        
        // Lifetime
        const energyBallLife = new LifetimeComponent();
        energyBallLife.setTimeUntilDeath(5.0);
        energyBallLife.setDieOnHitBackground(true);
        obj.addComponent(energyBallLife);
        
        // Gravity (energy balls arc downward)
        const energyBallGravity = new GravityComponent();
        obj.addComponent(energyBallGravity);
        
        // Movement
        const energyBallMove = new MovementComponent();
        obj.addComponent(energyBallMove);
        
        // Dynamic collision
        const energyBallCollision = new DynamicCollisionComponent();
        const energyBallAttack = new SphereCollisionVolume(16, 16, 16, HitType.HIT);
        energyBallCollision.setCollisionVolumes([energyBallAttack], null);
        obj.addComponent(energyBallCollision);
        
        // Simple collision for background
        const energyBallSimple = new SimpleCollisionComponent();
        obj.addComponent(energyBallSimple);
        
        // Hit reaction
        const energyBallHitReact = new HitReactionComponent({
          dieOnAttack: true
        });
        energyBallCollision.setHitReactionComponent(energyBallHitReact);
        obj.addComponent(energyBallHitReact);
        break;
      }

      case GameObjectTypeIndex.WANDA_SHOT: {
        // Wanda's neutral story projectile (not an enemy attack).
        obj.type = 'projectile';
        obj.subType = 'wanda_shot';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 200;
        obj.team = Team.NONE;
        
        // Lifetime
        const wandaShotLife = new LifetimeComponent();
        wandaShotLife.setTimeUntilDeath(5.0);
        obj.addComponent(wandaShotLife);
        
        // Movement
        const wandaShotMove = new MovementComponent();
        obj.addComponent(wandaShotMove);
        
        // Dynamic collision
        const wandaShotCollision = new DynamicCollisionComponent();
        const wandaShotAttack = new SphereCollisionVolume(16, 16, 16, HitType.HIT);
        wandaShotCollision.setCollisionVolumes([wandaShotAttack], null);
        obj.addComponent(wandaShotCollision);
        
        // Hit reaction
        const wandaShotHitReact = new HitReactionComponent({
          dieOnAttack: true
        });
        wandaShotCollision.setHitReactionComponent(wandaShotHitReact);
        obj.addComponent(wandaShotHitReact);
        break;
      }

      // ============================================
      // EFFECTS (spawnable as level objects)
      // ============================================

      case GameObjectTypeIndex.DUST:
      case GameObjectTypeIndex.EXPLOSION_SMALL:
      case GameObjectTypeIndex.EXPLOSION_LARGE:
      case GameObjectTypeIndex.EXPLOSION_GIANT: {
        // Effects - short-lived animated sprites
        obj.type = 'effect';
        if (spawn.type === GameObjectTypeIndex.DUST) {
          obj.subType = 'dust';
          objWidth = 16;
          objHeight = 16;
        } else if (spawn.type === GameObjectTypeIndex.EXPLOSION_SMALL) {
          obj.subType = 'explosion_small';
          objWidth = 32;
          objHeight = 32;
        } else if (spawn.type === GameObjectTypeIndex.EXPLOSION_LARGE) {
          obj.subType = 'explosion_large';
          objWidth = 64;
          objHeight = 64;
        } else {
          obj.subType = 'explosion_giant';
          objWidth = 128;
          objHeight = 128;
        }
        obj.activationRadius = 100;
        obj.team = Team.NONE;
        
        // Short lifetime for effects
        const effectLife = new LifetimeComponent();
        effectLife.setTimeUntilDeath(0.5);
        obj.addComponent(effectLife);
        break;
      }

      case GameObjectTypeIndex.FRAMERATE_WATCHER: {
        // Framerate watcher - monitors performance (mostly for debugging)
        obj.type = 'system';
        obj.subType = 'framerate_watcher';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 100;
        obj.team = Team.NONE;
        // No special components - handled by performance monitor
        break;
      }

      default:
        // Generic object - keep default size
        break;
    }

    // Set object dimensions
    obj.width = objWidth;
    obj.height = objHeight;
    if (obj.type === 'enemy' && obj.team === Team.NONE) {
      obj.team = Team.ENEMY;
    }

    this.attachEnemyCollision(obj);
    this.attachPhysics(obj);
    this.attachPossession(obj);
    this.attachObjectSprite(obj);
    
    // Calculate position to match original Java behavior
    // Original used Y-up coords with position at bottom-left of sprite
    // Web port uses Y-down coords with position at top-left of sprite
    // 
    // Original formula: worldY = worldHeight - ((tileY + 1) * tileHeight)
    // This places the BOTTOM of the sprite at the bottom edge of the spawn tile
    //
    // For Y-down with position at top-left, to place BOTTOM at bottom of tile:
    // position.y + height = (tileY + 1) * tileHeight
    // position.y = (tileY + 1) * tileHeight - height
    let posX = spawn.x;
    let posY = (spawn.tileY + 1) * this.tileHeight - objHeight;
    
    // Center small objects in their tile (matches original)
    // Original: if (object.height < tileHeight) object.y += (tileHeight - object.height) / 2
    // In Y-up, += moves sprite UP. In Y-down, we need -= to move UP.
    if (objHeight < this.tileHeight) {
      posY -= (this.tileHeight - objHeight) / 2;
    }
    // Original: if (object.width < tileWidth) object.x += (tileWidth - object.width) / 2
    // Original: if (object.width > tileWidth) object.x -= (object.width - tileWidth) / 2
    if (objWidth < this.tileWidth) {
      posX += (this.tileWidth - objWidth) / 2;
    } else if (objWidth > this.tileWidth) {
      posX -= (objWidth - this.tileWidth) / 2;
    }
    if (obj.subType === 'shadowslime' || obj.subType === 'kyle_dead') {
      // Both original objects subtract five in Y-up space to sit below their
      // tile baseline; the equivalent Y-down conversion moves them down.
      posY += 5;
    } else if (obj.subType === 'rokudou') {
      // The flying boss has no gravity and is manually aligned to the floor.
      posY += 23;
    }
    
    obj.setPosition(posX, posY);
    
    // Store player spawn position for respawning
    if (spawn.type === GameObjectTypeIndex.PLAYER) {
      this.playerSpawnPosition = { x: posX, y: posY };
    }

    this.gameObjectManager.add(obj);
  }

  /**
   * Convert parsed level to LevelData format for compatibility
   */
  /**
   * Give an ordinary enemy the collision volumes and hit reaction the original
   * gives it, so damage flows through GameObjectCollisionSystem rather than the
   * inline AABB checks Game.tsx used to run.
   *
   * Bosses and scripted characters configure their own volumes in the switch
   * above and are skipped here (createEnemyCollisionProfile returns null).
   */
  private attachEnemyCollision(obj: GameObject): void {
    const profile = createEnemyCollisionProfile(obj.subType);
    if (!profile) return;
    // Never clobber a hand-built configuration.
    if (obj.getComponent(DynamicCollisionComponent)) return;

    const collision = new DynamicCollisionComponent();
    const hitReact = new HitReactionComponent({
      // Ordinary enemies die in one hit; the invincibility window keeps a
      // single stomp from being counted on consecutive frames.
      invincibleAfterHitTime: 0.5,
      pauseOnAttack: true,
    });
    hitReact.setSoundPlayer((sound) => {
      sSystemRegistry.soundSystem?.playSfx(sound);
    });
    collision.setHitReactionComponent(hitReact);

    // Prime the volumes now rather than on the first update, so the object is
    // fully configured from frame zero - attachPossession() reads them.
    collision.setCollisionVolumes(
      selectEnemyAttackVolumes(profile, obj.getCurrentAction()),
      profile.vulnerability
    );

    obj.addComponent(collision);
    obj.addComponent(hitReact);

    // Animations carry the per-frame volumes from here on, so SpriteComponent
    // hands them to the collision component as the animation plays - the way
    // the original's AnimationFrame does. Enemies with no art here (bosses)
    // keep the action-driven EnemyCollisionComponent instead.
    const animations = createEnemyAnimations(obj.subType);
    if (!animations) {
      const selector = new EnemyCollisionComponent(profile);
      selector.setCollisionComponent(collision);
      obj.addComponent(selector);
      return;
    }

    const sprite = obj.getComponent(SpriteComponent) ?? new SpriteComponent();
    if (!obj.getComponent(SpriteComponent)) obj.addComponent(sprite);
    const renderSystem = sSystemRegistry.renderSystem;
    if (renderSystem) sprite.setRenderSystem(renderSystem);
    sprite.setCollisionComponent(collision);
    for (const [index, animation] of animations) {
      sprite.addAnimationAtIndex(index, animation);
    }
    sprite.playAnimation(EnemyAnimation.IDLE);

    const animator = new EnemyAnimationComponent();
    animator.setSprite(sprite);
    obj.addComponent(animator);
  }

  /**
   * Give enemies and NPCs the movement components the original gives them.
   *
   * Game.tsx used to run its own gravity, velocity interpolation and tile
   * snapping for every enemy and NPC, duplicating GravityComponent and
   * MovementComponent. That copy also had special cases keyed off subType which
   * silently overrode component behaviour - it zeroed Evil Kabocha's velocity
   * every frame, so the boss could never walk its hot-spot script.
   */
  private attachPhysics(obj: GameObject): void {
    if (obj.type !== 'enemy' && obj.type !== 'npc') return;
    // Something already gave this object its own movement setup.
    if (obj.getComponent(MovementComponent)) return;
    // Set pieces that must not be moved by generic physics.
    if (NO_PHYSICS_SUBTYPES.has(obj.subType)) return;

    if (!FLYING_SUBTYPES.has(obj.subType)) {
      obj.addComponent(new GravityComponent());
    }

    const movement = new MovementComponent();
    const box = COLLISION_BOXES[obj.subType];
    if (this.collisionSystem && !NO_BACKGROUND_COLLISION_SUBTYPES.has(obj.subType)) {
      movement.setCollisionSystem(this.collisionSystem);
      if (box) {
        movement.setCollisionBox(box.width, box.height, box.offsetX, box.offsetY);
      }
    }
    obj.addComponent(movement);
  }

  /**
   * Make a collectible pick-up-able through the component pipeline.
   *
   * Game.tsx used to detect every pick-up with its own AABB overlap test. The
   * original instead gives each collectible a HitReactionComponent with
   * dieOnCollect, reached either by HitPlayerComponent (coins - a radius test)
   * or by a COLLECT vulnerability volume (rubies, diaries). Game.tsx now only
   * reacts to the resulting death.
   */
  private attachCollectible(
    obj: GameObject,
    options: { proximityRadius?: number; volumeRadius?: number; sound?: string }
  ): void {
    const hitReact = new HitReactionComponent({
      dieOnCollect: true,
      // Collectibles cannot be damaged, only collected.
      forceInvincibility: true,
      onHitSound: options.sound,
    });
    if (options.sound) {
      hitReact.setSoundPlayer((sound) => {
        sSystemRegistry.soundSystem?.playSfx(sound);
      });
    }
    obj.addComponent(hitReact);

    if (options.proximityRadius !== undefined) {
      const hitPlayer = new HitPlayerComponent();
      hitPlayer.setup({
        distance: options.proximityRadius,
        hitReaction: hitReact,
        hitType: HitType.COLLECT,
        // false: this object receives the hit from the player, it does not hit.
        hitPlayer: false,
      });
      obj.addComponent(hitPlayer);
      return;
    }

    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(
      null,
      [new SphereCollisionVolume(options.volumeRadius ?? 16, 16, 16, HitType.COLLECT)]
    );
    collision.setHitReactionComponent(hitReact);
    obj.addComponent(collision);
  }

  /**
   * Let the ghost take this object over.
   *
   * The original wires possession as a component swap: the object's
   * HitReactionComponent holds a ChangeComponentsComponent which, on a POSSESS
   * hit, swaps the AI out and a GhostComponent in
   * (`hitReact.setPossessionComponent(ghostSwap)`).
   *
   * Whether an object can be possessed is decided by its vulnerability volume,
   * not by name: brobots leave theirs untyped so it accepts any hit, while
   * turrets and brobot spawners type theirs POSSESS.
   */
  private attachPossession(obj: GameObject): void {
    const collision = obj.getComponent(DynamicCollisionComponent);
    const hitReact = obj.getComponent(
      HitReactionComponent as unknown as new (...args: unknown[]) => HitReactionComponent
    );
    if (!collision || !hitReact) return;

    const volumes = collision.getVulnerabilityVolumes();
    const possessable = volumes?.some((volume) => {
      const type = volume.getHitType();
      return type === HitType.POSSESS || type === HitType.INVALID;
    });
    if (!possessable) return;

    // Emplacements cannot walk, so a possessed one only aims and fires.
    const isEmplacement = obj.subType === 'turret' || obj.type === 'spawner';
    const swap = new ChangeComponentsComponent();
    // Ping-pong so releasing the object reverses the swap: the GhostComponent
    // goes back out and the AI returns.
    swap.setPingPongBehavior(true);
    swap.addSwapInComponent(new GhostComponent({
      movementSpeed: isEmplacement ? 0 : 500,
      jumpImpulse: isEmplacement ? 0 : 300,
      acceleration: isEmplacement ? 0 : 1000,
      useOrientationSensor: false,
      delayOnRelease: 1.5,
      killOnRelease: !isEmplacement,
      targetAction: isEmplacement ? ActionType.IDLE : ActionType.MOVE,
      lifeTime: 0,
      changeActionOnButton: isEmplacement,
      buttonPressedAction: isEmplacement ? ActionType.ATTACK : ActionType.INVALID,
      ambientSound: 'sound_possession',
    }));

    // The AI that has to stop while the player is driving.
    const patrol = obj.getComponent(
      PatrolComponent as unknown as new (...args: unknown[]) => PatrolComponent
    );
    if (patrol) swap.addSwapOutComponent(patrol);
    const automaticAttack = obj.getComponent(
      AttackAtDistanceComponent as unknown as new (...args: unknown[]) => AttackAtDistanceComponent
    );
    if (automaticAttack) swap.addSwapOutComponent(automaticAttack);

    hitReact.setPossessionComponent(swap);
    obj.addComponent(swap);
  }

  /**
   * Give the single-loop objects (collectibles, blocks, signs, cannons,
   * spawners, the ghost) their animation so SpriteComponent draws them.
   *
   * These have no state to select on, so they need no animation component -
   * just the frames and something to play them.
   */
  private attachObjectSprite(obj: GameObject): void {
    const existing = obj.getComponent(SpriteComponent);
    const renderSystem = sSystemRegistry.renderSystem;

    // Objects that built their own animations (doors, buttons) still need the
    // render system, or SpriteComponent tracks their state without drawing.
    if (existing?.getCurrentAnimation()) {
      if (renderSystem) existing.setRenderSystem(renderSystem);
      return;
    }

    const animation = createObjectAnimation(obj.type, obj.width, obj.height, obj.subType);
    if (!animation) return;

    const sprite = existing ?? new SpriteComponent();
    if (!existing) obj.addComponent(sprite);
    if (renderSystem) sprite.setRenderSystem(renderSystem);
    sprite.addAnimation(animation.name ?? obj.type, animation);
    sprite.playAnimation(animation.name ?? obj.type);
  }

  private convertToLevelData(parsed: ParsedLevel, info: LevelInfo): LevelData {
    const layers: LevelLayer[] = [];

    // Add background layers
    for (let i = 0; i < parsed.backgroundLayers.length; i++) {
      const bgLayer = parsed.backgroundLayers[i];
      // tileset name available via: ThemeTilesets[bgLayer.themeIndex] || 'island'
      
      layers.push({
        name: `background_${i}`,
        data: this.flattenTileArray(bgLayer.world.tiles),
        visible: true,
        parallaxX: bgLayer.scrollSpeed,
        parallaxY: bgLayer.scrollSpeed,
      });
    }

    // Add collision layer
    if (parsed.collisionLayer) {
      layers.push({
        name: 'collision',
        data: this.flattenTileArray(parsed.collisionLayer.tiles),
        visible: false,
        parallaxX: 1,
        parallaxY: 1,
      });
    }

    return {
      name: info.name,
      width: parsed.widthInTiles,
      height: parsed.heightInTiles,
      tileWidth: parsed.tileWidth,
      tileHeight: parsed.tileHeight,
      layers,
      objects: [], // Objects are spawned directly
      collisionData: { segments: [] },
    };
  }

  /**
   * Spawn level objects from JSON format
   */
  private spawnLevelObjects(objects: LevelObject[]): void {
    if (!this.gameObjectManager) return;

    resetInventory();

    // Clear all existing objects before spawning new level objects
    // This prevents crashes when transitioning between levels
    this.gameObjectManager.clear();

    for (const objData of objects) {
      this.createObjectFromData(objData);
    }
  }

  /**
   * Create a game object from level data
   */
  private createObjectFromData(data: LevelObject): void {
    if (!this.gameObjectManager) return;

    const obj = this.gameObjectManager.createObject();
    obj.type = data.type;
    obj.setPosition(data.x, data.y);
    obj.width = data.width;
    obj.height = data.height;

    switch (data.type) {
      case 'player':
        this.gameObjectManager.setPlayer(obj);
        break;
      case 'enemy':
        obj.activationRadius = 200;
        break;
      case 'collectible':
        obj.activationRadius = 100;
        break;
    }

    this.gameObjectManager.add(obj);
  }

  /**
   * Get current level data
   */
  getCurrentLevel(): LevelData | null {
    return this.currentLevel;
  }

  /**
   * Get parsed level (for binary levels)
   */
  getParsedLevel(): ParsedLevel | null {
    return this.parsedLevel;
  }

  /**
   * Get current level ID
   */
  getCurrentLevelId(): number {
    return this.currentLevelId;
  }

  /**
   * Get level width in pixels
   */
  getLevelWidth(): number {
    return this.widthInTiles * this.tileWidth;
  }

  /**
   * Get level height in pixels
   */
  getLevelHeight(): number {
    return this.heightInTiles * this.tileHeight;
  }

  /**
   * Get level info
   */
  getLevelInfo(levelId: number): LevelInfo | undefined {
    return this.levels.get(levelId);
  }

  /**
   * Find a level by its file name (resource string)
   */
  getLevelByFile(fileName: string): LevelInfo | undefined {
    for (const level of this.levels.values()) {
      if (level.file === fileName) {
        return level;
      }
    }
    return undefined;
  }

  /**
   * Get all level info
   */
  getAllLevels(): LevelInfo[] {
    return Array.from(this.levels.values());
  }

  /**
   * Get levels by world
   */
  getLevelsByWorld(world: number): LevelInfo[] {
    return Array.from(this.levels.values()).filter(l => l.world === world);
  }

  /**
   * Unlock a level
   */
  unlockLevel(levelId: number): void {
    const level = this.levels.get(levelId);
    if (level) {
      level.unlocked = true;
      // Also update Zustand store
      useGameStore.getState().unlockLevel(levelId);
    }
  }

  /**
   * Get the ID of the next level (without unlocking)
   * In linear mode, returns the next level in linearLevelTree sequence
   * In normal mode, returns the first level of the next group
   */
  getNextLevelId(): number | null {
    if (this.isLinearMode) {
      // In linear mode, find current level in linearLevelTree and return next
      return this.getNextLinearLevelId();
    }
    
    const current = this.levels.get(this.currentLevelId);
    return current?.next ?? null;
  }
  
  /**
   * Get the next level ID in linear mode (sequential progression)
   */
  private getNextLinearLevelId(): number | null {
    // Find current level's position in linear tree
    for (let i = 0; i < linearLevelTree.length; i++) {
      const group = linearLevelTree[i];
      const levelResource = group.levels[0].resource;
      const levelId = resourceToLevelId[levelResource];
      
      if (levelId === this.currentLevelId) {
        // Found current level, return next level's ID
        if (i + 1 < linearLevelTree.length) {
          const nextGroup = linearLevelTree[i + 1];
          const nextResource = nextGroup.levels[0].resource;
          return resourceToLevelId[nextResource] ?? null;
        }
        // No more levels
        return null;
      }
    }
    
    // Current level not found in linear tree, fall back to first level
    // console.warn(`[LevelSystem] Current level ${this.currentLevelId} not found in linear tree`);
    return null;
  }

  /**
   * Complete current level and check if the entire group is done.
   * This implements the original game's behavior:
   * - Complete ALL levels in a group to unlock the next group
   * - Returns the next uncompleted level in the current group, or
   *   the first level of the next group if the current group is fully complete
   * 
   * In linear mode, simply returns the next level in sequence.
   */
  completeCurrentLevel(): number | null {
    // In linear mode, just return the next sequential level
    if (this.isLinearMode) {
      return this.getNextLinearLevelId();
    }
    
    const current = this.levels.get(this.currentLevelId);
    if (!current) return null;
    
    // Mark current level as completed in the store (with default score/time for now)
    // The actual score/time tracking happens in Game.tsx
    const storeState = useGameStore.getState();
    
    const currentGroup = levelTree[current.groupIndex];
    const levelProgressMap = storeState.progress.levels;
    
    // Check if ALL levels in the current group are now completed
    let groupFullyCompleted = true;
    let firstUncompletedInGroup: number | null = null;
    
    for (const level of currentGroup.levels) {
      const levelId = resourceToLevelId[level.resource];
      if (levelId !== undefined) {
        // Check if this level is completed (just marked or previously)
        const levelProgress = levelProgressMap[levelId];
        const isCompleted = levelProgress?.completed || levelId === this.currentLevelId;
        if (!isCompleted) {
          groupFullyCompleted = false;
          if (firstUncompletedInGroup === null) {
            firstUncompletedInGroup = levelId;
          }
        }
      }
    }
    
    if (!groupFullyCompleted) {
      // Group not complete - stay in current group, return first uncompleted level
      // console.log(`[LevelSystem] Group ${current.groupIndex} not fully complete yet`);
      return firstUncompletedInGroup;
    }
    
    // Group is fully complete - unlock next group
    const nextGroupIndex = current.groupIndex + 1;
    if (nextGroupIndex >= levelTree.length) {
      // No more groups - game complete!
      // console.log('[LevelSystem] Game complete! No more levels.');
      return null;
    }
    
    // Unlock ALL levels in the next group
    const nextGroup = levelTree[nextGroupIndex];
    let firstNextLevelId: number | null = null;
    
    for (const level of nextGroup.levels) {
      const levelId = resourceToLevelId[level.resource];
      if (levelId !== undefined) {
        this.unlockLevel(levelId);
        if (firstNextLevelId === null) {
          firstNextLevelId = levelId;
        }
        // console.log(`[LevelSystem] Unlocked level ${level.name} (ID: ${levelId})`);
      }
    }
    
    return firstNextLevelId;
  }

  /**
   * Get all unlocked levels in the current level's group (for branching)
   */
  getUnlockedLevelsInCurrentGroup(): number[] {
    const current = this.levels.get(this.currentLevelId);
    if (!current) return [];
    
    const group = levelTree[current.groupIndex];
    const unlockedLevels: number[] = [];
    
    for (const level of group.levels) {
      const levelId = resourceToLevelId[level.resource];
      if (levelId !== undefined) {
        const levelInfo = this.levels.get(levelId);
        if (levelInfo?.unlocked) {
          unlockedLevels.push(levelId);
        }
      }
    }
    
    return unlockedLevels;
  }

  /**
   * Send restart event
   */
  sendRestartEvent(): void {
    this.attempts++;
    // This would trigger a game restart - to be implemented with event system
  }

  /**
   * Send next level event
   */
  sendNextLevelEvent(): void {
    const nextId = this.completeCurrentLevel();
    if (nextId !== null) {
      // This would trigger level transition - to be implemented with event system
    }
  }

  /**
   * Get attempts count
   */
  getAttemptsCount(): number {
    return this.attempts;
  }

  /**
   * Increment attempts
   */
  incrementAttemptsCount(): void {
    this.attempts++;
  }

  /**
   * Get background layers
   */
  getBackgroundLayers(): LevelLayer[] {
    if (!this.currentLevel) return [];
    return this.currentLevel.layers.filter(l => 
      l.name.startsWith('background') || l.name === 'tiles'
    );
  }

  /**
   * Get foreground layers
   */
  getForegroundLayers(): LevelLayer[] {
    if (!this.currentLevel) return [];
    return this.currentLevel.layers.filter(l => l.name.startsWith('foreground'));
  }

  /**
   * Get level dimensions in pixels
   */
  getLevelSize(): { width: number; height: number } {
    return {
      width: this.getLevelWidth(),
      height: this.getLevelHeight(),
    };
  }

  /**
   * Load level progress from Zustand store
   */
  loadLevelProgress(): void {
    // Sync internal levels map with Zustand store
    for (const [id, levelInfo] of this.levels) {
      levelInfo.unlocked = isLevelUnlocked(id);
    }
  }

  /**
   * Reset the level system
   */
  reset(): void {
    this.currentLevel = null;
    this.parsedLevel = null;
    this.currentLevelId = 0;
    this.widthInTiles = 0;
    this.heightInTiles = 0;
    this.attempts = 0;
  }
}
