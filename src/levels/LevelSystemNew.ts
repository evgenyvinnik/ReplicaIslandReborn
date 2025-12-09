/**
 * Level System - Manages level loading and state
 * Ported from: Original/src/com/replica/replicaisland/LevelSystem.java
 */

import type { LevelData, LevelLayer, LevelObject, AnimationDefinition } from '../types';
import { HitType, Team, ActionType } from '../types';
import type { CollisionSystem } from '../engine/CollisionSystemNew';
import type { GameObjectManager } from '../entities/GameObjectManager';
import { LevelParser, type ParsedLevel } from './LevelParser';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { GameObjectTypeIndex, getObjectTypeName } from '../types/GameObjectTypes';
import { NPCComponent } from '../entities/components/NPCComponent';
import { PatrolComponent } from '../entities/components/PatrolComponent';
import { AttackAtDistanceComponent } from '../entities/components/AttackAtDistanceComponent';
import { SnailbombComponent } from '../entities/components/SnailbombComponent';
import { SleeperComponent } from '../entities/components/SleeperComponent';
import { PopOutComponent } from '../entities/components/PopOutComponent';
import { EvilKabochaComponent } from '../entities/components/EvilKabochaComponent';
import { TheSourceComponent } from '../entities/components/TheSourceComponent';
import { RokudouBossComponent } from '../entities/components/RokudouBossComponent';
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
import { PhysicsComponent } from '../entities/components/PhysicsComponent';
import { GameObjectType } from '../entities/GameObjectFactory';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { assetPath } from '../utils/helpers';
import { useGameStore, isLevelUnlocked } from '../stores/useGameStore';
import { levelTree, linearLevelTree, resourceToLevelId } from '../data/levelTree';

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

  constructor() {
    this.initializeLevelTree();
  }
  
  /**
   * Set linear mode (Extras menu - all levels unlocked in chronological order)
   */
  setLinearMode(linear: boolean): void {
    this.isLinearMode = linear;
    console.log(`[LevelSystem] Linear mode set to: ${linear}`);
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
          console.warn(`[LevelSystem] No level ID for resource: ${level.resource}`);
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
    
    console.log(`[LevelSystem] Initialized ${this.levels.size} levels from levelTree`);
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
    const levelInfo = this.levels.get(levelId);
    if (!levelInfo) {
      console.error(`Level ${levelId} not found`);
      return false;
    }

    try {
      // All levels now use JSON format (converted from binary)
      if (levelInfo.binary) {
        return await this.loadConvertedJsonLevel(levelId, levelInfo);
      } else {
        return await this.loadJsonLevel(levelId, levelInfo);
      }
    } catch (error) {
      console.error('Error loading level:', error);
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
      console.error(`Failed to parse JSON level: ${levelInfo.file}`);
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
    console.log('[LevelSystem] Object layer:', parsed.objectLayer ? `${parsed.objectLayer.width}x${parsed.objectLayer.height}` : 'null');
    if (parsed.objectLayer) {
      this.spawnObjectsFromLayer(parsed.objectLayer);
    }

    // Convert to LevelData for compatibility
    this.currentLevel = this.convertToLevelData(parsed, levelInfo);

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

    // Clear all existing objects before spawning new level objects
    // This prevents crashes when transitioning between levels
    this.gameObjectManager.clear();

    // Reset channel system to clear stale channel data from previous level
    // This ensures buttons and doors get fresh channels
    if (sSystemRegistry.channelSystem) {
      sSystemRegistry.channelSystem.reset();
    }

    const spawnList: SpawnInfo[] = [];

    console.log(`[LevelSystem] spawnObjectsFromLayer: ${objectLayer.width}x${objectLayer.height}, tiles array length: ${objectLayer.tiles?.length}`);

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

    console.log(`[LevelSystem] Found ${spawnList.length} objects to spawn`);

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
    console.log(`[LevelSystem] Spawning object: type=${spawn.type} (${typeName}) at tile(${spawn.tileX},${spawn.tileY}) world(${spawn.x},${spawn.y})`);
    
    // Create object 
    const obj = this.gameObjectManager.createObject();
    obj.type = typeName.toLowerCase();

    // Default size (will be overridden per type)
    let objWidth = 32;
    let objHeight = 32;

    // Configure based on type
    switch (spawn.type) {
      case GameObjectTypeIndex.PLAYER:
        obj.type = 'player';
        // Original Java: sprite is 64x64, collision box is 32x48 with offset (16, 0)
        // The collision box dimensions determine collision detection
        objWidth = 32;    // Collision box width (not sprite width)
        objHeight = 48;   // Collision box height (not sprite height)
        this.gameObjectManager.setPlayer(obj);
        console.log(`[LevelSystem] PLAYER spawning at tile (${spawn.tileX}, ${spawn.tileY}), pixel (${spawn.x}, ${spawn.y})`);
        break;

      case GameObjectTypeIndex.COIN:
        obj.type = 'coin';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 100;
        console.log(`[LevelSystem] COIN created: type=${obj.type}, pos=(${spawn.x}, ${spawn.y}), visible=${obj.isVisible()}, active=${obj.isActive()}`);
        break;

      case GameObjectTypeIndex.RUBY:
        obj.type = 'ruby';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 100;
        break;

      case GameObjectTypeIndex.DIARY:
        obj.type = 'diary';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 100;
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
            duration: 0.5, // Attack animation length
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
        objWidth = 64;   // Assumed 64x64
        objHeight = 64;
        obj.activationRadius = 200;
        // Snailbomb has special behavior - uses SnailbombComponent for patrol + shooting
        const snailbomb = new SnailbombComponent({
          patrolSpeed: 20.0,
          attackRange: 300,
          shotCount: 3
        });
        obj.addComponent(snailbomb);
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
          appearDistance: 120,
          hideDistance: 190,
          attackDistance: 60,
          attackDelay: 1.0,
          attackLength: 0.5
        });
        obj.addComponent(shadowslimePopOut);
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
            duration: 0.5, // Attack animation length
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
          wakeUpDuration: 2.0,
          slamDuration: 0.5,
          slamMagnitude: 15,
          attackImpulseX: 200,
          attackImpulseY: -400  // Jump up (negative Y in canvas coords)
        });
        obj.addComponent(namazuSleeper);
        break;
      }
        
      case GameObjectTypeIndex.TURRET:
      case GameObjectTypeIndex.TURRET_LEFT: {
        obj.type = 'enemy';
        obj.subType = 'turret';
        objWidth = 32;
        objHeight = 32;
        obj.activationRadius = 300;
        // Turret uses AttackAtDistanceComponent - stationary, shoots at player
        const turretAttack = new AttackAtDistanceComponent({
          attackDistance: 200,
          attackDelay: 1.0,
          attackLength: 0.5,
          requireFacing: false // Turret shoots in any direction
        });
        obj.addComponent(turretAttack);
        break;
      }

      case GameObjectTypeIndex.ROKUDOU: {
        obj.type = 'rokudou';
        objWidth = 128;
        objHeight = 128;
        obj.activationRadius = 500; // Always active when on screen
        // Rokudou is spawned via factory method which adds components
        // We just need to call the right spawn method, but here we are configuring an already created object
        // So we should probably delegate to factory or manually configure
        // Actually, GameObjectFactory.spawn handles configuration based on type.
        // But here we are inside LevelSystem which calls GameObjectManager.createObject directly
        // and then configures it.
        // Wait, LevelSystem calls `this.gameObjectManager.createObject()`.
        // GameObjectFactory is separate.
        // The original `LevelSystem` used `GameObjectFactory` to spawn specific types.
        // In this port, `LevelSystemNew` seems to be doing manual configuration for many types,
        // effectively duplicating factory logic or bypassing it?
        // Let's look at `spawnObjectByType` again.
        // It creates an object and then adds components.
        // BUT `GameObjectFactory` has `configureEnemyRokudou`.
        // We should use `GameObjectFactory` if possible, but `LevelSystemNew` doesn't seem to use it directly for spawning?
        // Ah, `LevelSystemNew` DOES NOT have a reference to `GameObjectFactory`.
        // It uses `GameObjectManager`.
        // However, `GameObjectFactory` is usually used to spawn objects *during gameplay* (projectiles).
        // For level loading, `LevelSystem` seems to be the factory.
        // This is a bit of a mess. Ideally `LevelSystem` should use `GameObjectFactory`.
        // But since I can't easily refactor the whole spawning system right now, I will duplicate the configuration logic
        // OR see if I can use the factory logic.
        // `GameObjectFactory` has `configureEnemyRokudou(obj)`.
        // I can't access `GameObjectFactory` instance here easily.
        // Wait, `GameObjectFactory` is not a singleton.
        // But `LevelSystemNew` imports `RokudouBossComponent`.
        // I will replicate the configuration logic here, similar to other enemies.
        
        // Actually, looking at `GameObjectFactory.ts`, it has `configureEnemyRokudou`.
        // And `LevelSystemNew.ts` has `spawnObjectByType` which manually adds components.
        // I should just add the components here.
        
        // Sprite
        const sprite = new SpriteComponent();
        sprite.setSprite('rokudou');
        // ... animations ... (omitted for brevity, will use what's in Factory as reference)
        // Actually, to avoid massive code duplication, I should check if I can use the Factory.
        // `LevelSystemNew` doesn't seem to use Factory.
        // BUT, `GameObjectFactory` is used by `Game.tsx` to spawn the player.
        // And `GameObjectFactory` is passed to `LevelSystem`? No.
        
        // Let's look at `LevelSystemNew.ts` imports.
        // It imports `RokudouBossComponent`.
        
        // I will implement the configuration here.
        
        // Add sprite
        const rokudouSprite = new SpriteComponent();
        rokudouSprite.setSprite('rokudou');
        // Add animations (simplified for now, or full if needed)
        // ...
        // Actually, I'll just use the `RokudouBossComponent` and basic sprite for now to ensure it spawns.
        // The `GameObjectFactory` has the full animation setup.
        // It would be better to refactor `LevelSystemNew` to use `GameObjectFactory` for complex objects.
        // But for now, I'll copy the setup.
        
        // Sprite
        rokudouSprite.setSprite('rokudou');
        // Idle
        rokudouSprite.addAnimation('idle', { frames: [{ x: 0, y: 0, width: 128, height: 128, duration: 0.2 }], loop: true });
        // Fly
        rokudouSprite.addAnimation('fly', { frames: [
          { x: 0, y: 0, width: 128, height: 128, duration: 0.1 },
          { x: 128, y: 0, width: 128, height: 128, duration: 0.1 },
          { x: 256, y: 0, width: 128, height: 128, duration: 0.1 },
          { x: 384, y: 0, width: 128, height: 128, duration: 0.1 },
          { x: 512, y: 0, width: 128, height: 128, duration: 0.1 },
          { x: 640, y: 0, width: 128, height: 128, duration: 0.1 },
        ], loop: true });
        // Shoot
        rokudouSprite.addAnimation('shoot', { frames: [
          { x: 0, y: 128, width: 128, height: 128, duration: 0.15 },
          { x: 128, y: 128, width: 128, height: 128, duration: 0.15 },
        ], loop: true });
        // Surprised
        rokudouSprite.addAnimation('surprised', { frames: [{ x: 256, y: 128, width: 128, height: 128, duration: 0.2 }], loop: true });
        // Hit
        rokudouSprite.addAnimation('hit', { frames: [
          { x: 0, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 128, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 256, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 384, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 512, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 640, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 768, y: 256, width: 128, height: 128, duration: 0.08 },
        ], loop: false });
        // Death
        rokudouSprite.addAnimation('death', { frames: [
          { x: 0, y: 384, width: 128, height: 128, duration: 0.12 },
          { x: 128, y: 384, width: 128, height: 128, duration: 0.12 },
          { x: 256, y: 384, width: 128, height: 128, duration: 0.12 },
          { x: 384, y: 384, width: 128, height: 128, duration: 0.12 },
          { x: 512, y: 384, width: 128, height: 128, duration: 0.12 },
        ], loop: false });
        
        rokudouSprite.playAnimation('idle');
        obj.addComponent(rokudouSprite);
        
        // Physics (no gravity)
        const rokudouPhysics = new PhysicsComponent();
        rokudouPhysics.setUseGravity(false);
        obj.addComponent(rokudouPhysics);
        // Wait, LevelSystemNew doesn't import PhysicsComponent.
        // It seems other enemies use PatrolComponent which handles movement?
        // No, `configureEnemyBrobot` in Factory adds PhysicsComponent.
        // `LevelSystemNew` seems to rely on components being added here.
        // But `PhysicsComponent` is NOT imported in `LevelSystemNew`.
        // Let's check imports.
        // It imports `MovementComponent` but not `PhysicsComponent`.
        // This confirms `LevelSystemNew` is incomplete for complex objects.
        
        // I MUST import PhysicsComponent.
        
        // ... (I will add import in a separate block if needed, or assume I can add it)
        
        // Boss Component
        const rokudou = new RokudouBossComponent({
          life: 3,
          attackRange: 300,
          movementSpeed: 100,
        });
        
        // Projectile Spawner
        rokudou.setProjectileSpawner((type, x, y, vx, vy) => {
           // We need to spawn projectiles.
           // LevelSystem doesn't have a spawn method for projectiles easily accessible?
           // It has `spawnObjectByType`.
           // We can use `gameObjectManager.add()` if we create it manually.
           // Or we can use `sSystemRegistry.gameObjectFactory` if it was set?
           // `SystemRegistry` has `gameObjectFactory`?
           // Let's check `SystemRegistry`.
           if (sSystemRegistry.gameObjectFactory) {
             const pType = type === 'energy_ball' ? GameObjectType.ENERGY_BALL : GameObjectType.TURRET_BULLET;
             const proj = sSystemRegistry.gameObjectFactory.spawn(pType, x, y);
             if (proj) {
               proj.setVelocity(vx, vy);
             }
           }
        });
        
        obj.addComponent(rokudou);
        break;
      }
      
      case GameObjectTypeIndex.THE_SOURCE: {
        obj.type = 'the_source';
        objWidth = 256;
        objHeight = 256;
        obj.activationRadius = 1000; // Always active
        
        // Sprite
        const sourceSprite = new SpriteComponent();
        sourceSprite.setSprite('the_source');
        sourceSprite.addAnimation('idle', { frames: [{ x: 0, y: 0, width: 256, height: 256, duration: 1.0 }], loop: true });
        sourceSprite.playAnimation('idle');
        obj.addComponent(sourceSprite);
        
        // The Source Component
        const source = new TheSourceComponent();
        // Configure event triggers
        // source.setGameEvent(GameFlowEvent.EVENT_END_GAME, 0);
        obj.addComponent(source);
        
        // Collision
        const sourceCollision = new SimpleCollisionComponent();
        obj.addComponent(sourceCollision);
        
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
        const closedAnim: AnimationDefinition = {
          name: 'closed',
          frames: [{ x: 0, y: 0, width: 32, height: 64, duration: 1.0 }],
          loop: false
        };
        const openAnim: AnimationDefinition = {
          name: 'open',
          frames: [{ x: 0, y: 0, width: 32, height: 64, duration: 1.0 }],
          loop: false
        };
        const openingAnim: AnimationDefinition = {
          name: 'opening',
          frames: [
            { x: 0, y: 0, width: 32, height: 64, duration: 0.083 },
            { x: 0, y: 0, width: 32, height: 64, duration: 0.083 }
          ],
          loop: false
        };
        const closingAnim: AnimationDefinition = {
          name: 'closing',
          frames: [
            { x: 0, y: 0, width: 32, height: 64, duration: 0.083 },
            { x: 0, y: 0, width: 32, height: 64, duration: 0.083 }
          ],
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
          frames: [{ x: 0, y: 0, width: 32, height: 32, duration: 1.0 }],
          loop: false
        };
        const downAnim: AnimationDefinition = {
          name: 'down',
          frames: [{ x: 0, y: 0, width: 32, height: 32, duration: 1.0 }],
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
        // Add NPC movement component
        const npcComponent = new NPCComponent();
        obj.addComponent(npcComponent);
        
        // Add LaunchProjectileComponent for energy blast attack (from original)
        // Wanda fires energy ball when in ATTACK action
        const wandaGun = new LaunchProjectileComponent({
          objectTypeToSpawn: GameObjectType.ENERGY_BALL,
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
        const npcComponent2 = new NPCComponent();
        obj.addComponent(npcComponent2);
        break;
      }
        
      case GameObjectTypeIndex.KABOCHA: {
        obj.type = 'npc';
        obj.subType = 'kabocha';
        objWidth = 64;   // Sprite is 64x128
        objHeight = 128;
        obj.activationRadius = 2000; // Large radius to keep NPC active during cutscenes
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
        obj.life = 5; // Mini boss has 5 hit points
        // Add Evil Kabocha boss component
        const kabochaComp = new EvilKabochaComponent({
          life: 5,
          hitPauseDuration: 1.0,
          knockbackImpulse: 300,
          deathDelay: 4.0,
          triggerEnding: true,
          endingType: 'KABOCHA_ENDING'
        });
        // Wire up boss death callback to trigger ending cutscene
        if (this.onBossDeathCallback) {
          kabochaComp.setOnDeathCallback(this.onBossDeathCallback);
        }
        obj.addComponent(kabochaComp);
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
        // Add Rokudou boss AI component
        const rokudouComp = new RokudouBossComponent({
          life: 3,
          attackRange: 300,
          movementSpeed: 100,
        });
        // Wire up boss death callback to trigger ending cutscene (ROKUDOU_ENDING)
        if (this.onBossDeathCallback) {
          const callback = this.onBossDeathCallback;
          rokudouComp.setGameEventTrigger((_event: string, _index: number) => {
            callback('ROKUDOU_ENDING');
          });
        }
        obj.addComponent(rokudouComp);
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
        
        console.log(`[LevelSystem] Spawning breakable_block at tile (${spawn.tileX}, ${spawn.tileY}) world (${spawn.x}, ${spawn.y})`);
        
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
          angle: Math.PI / 2, // Launch upward (90 degrees)
          magnitude: 1500,
          launchDelay: 0.1,
          postLaunchDelay: 1.0,
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
        obj.team = Team.NONE;
        const spawnerLauncher = new LaunchProjectileComponent({
          objectTypeToSpawn: GameObjectType.ENEMY_BROBOT,
          delayBeforeFirstSet: 2.0,
          delayBetweenSets: 5.0,
          setsPerActivation: 0, // Infinite
          projectilesInSet: 1,
          velocityX: spawn.type === GameObjectTypeIndex.BROBOT_SPAWNER_LEFT ? -100 : 100,
          velocityY: -50,
          trackProjectiles: false,
          offsetX: spawn.type === GameObjectTypeIndex.BROBOT_SPAWNER_LEFT ? -32 : 32,
          offsetY: 32
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
          setsPerActivation: 0, // Infinite
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
        objWidth = 64;
        objHeight = 64;
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
        
        nbDoorSprite.addAnimationAtIndex(DoorAnimation.CLOSED, nbClosedAnim);
        nbDoorSprite.addAnimationAtIndex(DoorAnimation.OPEN, nbOpenAnim);
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
        // Wanda's projectile attack
        obj.type = 'projectile';
        obj.subType = 'wanda_shot';
        objWidth = 16;
        objHeight = 16;
        obj.activationRadius = 200;
        obj.team = Team.ENEMY;
        
        // Lifetime
        const wandaShotLife = new LifetimeComponent();
        wandaShotLife.setTimeUntilDeath(3.0);
        wandaShotLife.setDieOnHitBackground(true);
        obj.addComponent(wandaShotLife);
        
        // Movement
        const wandaShotMove = new MovementComponent();
        obj.addComponent(wandaShotMove);
        
        // Dynamic collision
        const wandaShotCollision = new DynamicCollisionComponent();
        const wandaShotAttack = new SphereCollisionVolume(8, 8, 8, HitType.HIT);
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
    console.warn(`[LevelSystem] Current level ${this.currentLevelId} not found in linear tree`);
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
      console.log(`[LevelSystem] Group ${current.groupIndex} not fully complete yet`);
      return firstUncompletedInGroup;
    }
    
    // Group is fully complete - unlock next group
    const nextGroupIndex = current.groupIndex + 1;
    if (nextGroupIndex >= levelTree.length) {
      // No more groups - game complete!
      console.log('[LevelSystem] Game complete! No more levels.');
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
        console.log(`[LevelSystem] Unlocked level ${level.name} (ID: ${levelId})`);
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
