/**
 * Level System - Manages level loading and state
 * Ported from: Original/src/com/replica/replicaisland/LevelSystem.java
 */

import type { LevelData, LevelLayer, LevelObject } from '../types';
import type { CollisionSystem } from '../engine/CollisionSystem';
import type { GameObjectManager } from '../entities/GameObjectManager';
import { LevelParser, type ParsedLevel } from './LevelParser';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { GameObjectTypeIndex, getObjectTypeName } from '../types/GameObjectTypes';

export interface LevelInfo {
  id: number;
  name: string;
  file: string;      // Base filename without extension
  binary: boolean;   // True if .bin format, false if .json
  next: number | null;
  unlocked: boolean;
  world: number;     // World/chapter number
  stage: number;     // Stage within world
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
  
  // Parser
  private levelParser: LevelParser = new LevelParser();
  
  // Game events
  private attempts: number = 0;

  constructor() {
    this.initializeLevelTree();
  }

  /**
   * Initialize the level progression tree
   * Based on Original/res/xml/level_tree.xml
   */
  private initializeLevelTree(): void {
    const levelTree: LevelInfo[] = [
      // Tutorial (World 0)
      { id: 1, name: 'Tutorial 1', file: 'level_0_1_sewer', binary: true, next: 2, unlocked: true, world: 0, stage: 1 },
      { id: 2, name: 'Tutorial 2', file: 'level_0_2_lab', binary: true, next: 3, unlocked: false, world: 0, stage: 2 },
      { id: 3, name: 'Tutorial 3', file: 'level_0_3_lab', binary: true, next: 4, unlocked: false, world: 0, stage: 3 },
      
      // Island (World 1)
      { id: 4, name: 'Island 1', file: 'level_1_1_island', binary: true, next: 5, unlocked: false, world: 1, stage: 1 },
      { id: 5, name: 'Island 2', file: 'level_1_2_island', binary: true, next: 6, unlocked: false, world: 1, stage: 2 },
      { id: 6, name: 'Island 3', file: 'level_1_3_island', binary: true, next: 7, unlocked: false, world: 1, stage: 3 },
      { id: 7, name: 'Island 4', file: 'level_1_4_island', binary: true, next: 8, unlocked: false, world: 1, stage: 4 },
      { id: 8, name: 'Island 5', file: 'level_1_5_island', binary: true, next: 9, unlocked: false, world: 1, stage: 5 },
      { id: 9, name: 'Island 6', file: 'level_1_6_island', binary: true, next: 10, unlocked: false, world: 1, stage: 6 },
      { id: 10, name: 'Island 8', file: 'level_1_8_island', binary: true, next: 11, unlocked: false, world: 1, stage: 8 },
      { id: 11, name: 'Island 9', file: 'level_1_9_island', binary: true, next: 12, unlocked: false, world: 1, stage: 9 },
      
      // Grass (World 2)
      { id: 12, name: 'Forest 1', file: 'level_2_1_grass', binary: true, next: 13, unlocked: false, world: 2, stage: 1 },
      { id: 13, name: 'Forest 2', file: 'level_2_2_grass', binary: true, next: 14, unlocked: false, world: 2, stage: 2 },
      { id: 14, name: 'Forest 3', file: 'level_2_3_grass', binary: true, next: 15, unlocked: false, world: 2, stage: 3 },
      { id: 15, name: 'Forest 4', file: 'level_2_4_grass', binary: true, next: 16, unlocked: false, world: 2, stage: 4 },
      { id: 16, name: 'Forest 5', file: 'level_2_5_grass', binary: true, next: 17, unlocked: false, world: 2, stage: 5 },
      { id: 17, name: 'Forest 6', file: 'level_2_6_grass', binary: true, next: 18, unlocked: false, world: 2, stage: 6 },
      { id: 18, name: 'Forest 7', file: 'level_2_7_grass', binary: true, next: 19, unlocked: false, world: 2, stage: 7 },
      { id: 19, name: 'Forest 8', file: 'level_2_8_grass', binary: true, next: 20, unlocked: false, world: 2, stage: 8 },
      { id: 20, name: 'Forest 9', file: 'level_2_9_grass', binary: true, next: 21, unlocked: false, world: 2, stage: 9 },
      
      // Sewer (World 3)
      { id: 21, name: 'Sewer 0', file: 'level_3_0_sewer', binary: true, next: 22, unlocked: false, world: 3, stage: 0 },
      { id: 22, name: 'Sewer 1', file: 'level_3_1_grass', binary: true, next: 23, unlocked: false, world: 3, stage: 1 },
      { id: 23, name: 'Sewer 2', file: 'level_3_2_sewer', binary: true, next: 24, unlocked: false, world: 3, stage: 2 },
      { id: 24, name: 'Sewer 3', file: 'level_3_3_sewer', binary: true, next: 25, unlocked: false, world: 3, stage: 3 },
      { id: 25, name: 'Sewer 4', file: 'level_3_4_sewer', binary: true, next: 26, unlocked: false, world: 3, stage: 4 },
      { id: 26, name: 'Sewer 5', file: 'level_3_5_sewer', binary: true, next: 27, unlocked: false, world: 3, stage: 5 },
      { id: 27, name: 'Sewer 6', file: 'level_3_6_sewer', binary: true, next: 28, unlocked: false, world: 3, stage: 6 },
      { id: 28, name: 'Sewer 7', file: 'level_3_7_sewer', binary: true, next: 29, unlocked: false, world: 3, stage: 7 },
      { id: 29, name: 'Sewer 8', file: 'level_3_8_sewer', binary: true, next: 30, unlocked: false, world: 3, stage: 8 },
      { id: 30, name: 'Sewer 9', file: 'level_3_9_sewer', binary: true, next: 31, unlocked: false, world: 3, stage: 9 },
      { id: 31, name: 'Sewer 10', file: 'level_3_10_sewer', binary: true, next: 32, unlocked: false, world: 3, stage: 10 },
      { id: 32, name: 'Sewer 11', file: 'level_3_11_sewer', binary: true, next: 33, unlocked: false, world: 3, stage: 11 },
      
      // Underground (World 4)
      { id: 33, name: 'Underground 1', file: 'level_4_1_underground', binary: true, next: 34, unlocked: false, world: 4, stage: 1 },
      { id: 34, name: 'Underground 2', file: 'level_4_2_underground', binary: true, next: 35, unlocked: false, world: 4, stage: 2 },
      { id: 35, name: 'Underground 3', file: 'level_4_3_underground', binary: true, next: 36, unlocked: false, world: 4, stage: 3 },
      { id: 36, name: 'Underground 4', file: 'level_4_4_underground', binary: true, next: 37, unlocked: false, world: 4, stage: 4 },
      { id: 37, name: 'Underground 5', file: 'level_4_5_underground', binary: true, next: 38, unlocked: false, world: 4, stage: 5 },
      { id: 38, name: 'Underground 7', file: 'level_4_7_underground', binary: true, next: 39, unlocked: false, world: 4, stage: 7 },
      { id: 39, name: 'Underground 8', file: 'level_4_8_underground', binary: true, next: 40, unlocked: false, world: 4, stage: 8 },
      { id: 40, name: 'Underground 9', file: 'level_4_9_underground', binary: true, next: 41, unlocked: false, world: 4, stage: 9 },
      
      // Final Boss
      { id: 41, name: 'Final Boss', file: 'level_final_boss_lab', binary: true, next: null, unlocked: false, world: 5, stage: 1 },
    ];

    for (const level of levelTree) {
      this.levels.set(level.id, level);
    }
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
   * Load a level by ID
   */
  async loadLevel(levelId: number): Promise<boolean> {
    const levelInfo = this.levels.get(levelId);
    if (!levelInfo) {
      console.error(`Level ${levelId} not found`);
      return false;
    }

    try {
      if (levelInfo.binary) {
        return await this.loadBinaryLevel(levelId, levelInfo);
      } else {
        return await this.loadJsonLevel(levelId, levelInfo);
      }
    } catch (error) {
      console.error('Error loading level:', error);
      return false;
    }
  }

  /**
   * Load a binary .bin level file
   */
  private async loadBinaryLevel(levelId: number, levelInfo: LevelInfo): Promise<boolean> {
    const url = `/assets/levels/${levelInfo.file}.bin`;
    const parsed = await this.levelParser.parseLevel(url);
    
    if (!parsed) {
      console.error(`Failed to parse binary level: ${levelInfo.file}`);
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
    const response = await fetch(`/assets/levels/${levelInfo.file}.json`);
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
   * Flatten 2D tile array to 1D
   */
  private flattenTileArray(tiles: number[][]): number[] {
    const result: number[] = [];
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        result.push(tiles[y][x]);
      }
    }
    return result;
  }

  /**
   * Spawn objects from binary object layer
   */
  private spawnObjectsFromLayer(objectLayer: { width: number; height: number; tiles: number[][] }): void {
    if (!this.gameObjectManager) return;

    const spawnList: SpawnInfo[] = [];

    // Scan the object layer for spawn points
    for (let y = 0; y < objectLayer.height; y++) {
      for (let x = 0; x < objectLayer.width; x++) {
        const tileValue = objectLayer.tiles[y][x];
        
        // Skip empty tiles (-1) and skip markers (negative values)
        if (tileValue < 0) continue;

        // Calculate world position (bottom-left origin)
        const worldX = x * this.tileWidth + this.tileWidth / 2;
        const worldY = (objectLayer.height - 1 - y) * this.tileHeight + this.tileHeight / 2;

        spawnList.push({
          type: tileValue,
          x: worldX,
          y: worldY,
          tileX: x,
          tileY: y,
        });
      }
    }

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
   */
  private spawnObjectByType(spawn: SpawnInfo): void {
    if (!this.gameObjectManager) return;

    const typeName = getObjectTypeName(spawn.type);
    
    // Create object and set position
    const obj = this.gameObjectManager.createObject();
    obj.setPosition(spawn.x, spawn.y);
    obj.type = typeName.toLowerCase();

    // Configure based on type
    switch (spawn.type) {
      case GameObjectTypeIndex.PLAYER:
        obj.type = 'player';
        obj.width = 48;
        obj.height = 48;
        this.gameObjectManager.setPlayer(obj);
        break;

      case GameObjectTypeIndex.COIN:
        obj.type = 'coin';
        obj.width = 32;
        obj.height = 32;
        obj.activationRadius = 100;
        break;

      case GameObjectTypeIndex.RUBY:
        obj.type = 'ruby';
        obj.width = 32;
        obj.height = 32;
        obj.activationRadius = 100;
        break;

      case GameObjectTypeIndex.DIARY:
        obj.type = 'diary';
        obj.width = 32;
        obj.height = 32;
        obj.activationRadius = 100;
        break;

      case GameObjectTypeIndex.BAT:
        obj.type = 'enemy';
        obj.subType = 'bat';
        obj.width = 48;
        obj.height = 48;
        obj.activationRadius = 200;
        break;
        
      case GameObjectTypeIndex.STING:
        obj.type = 'enemy';
        obj.subType = 'sting';
        obj.width = 48;
        obj.height = 48;
        obj.activationRadius = 200;
        break;
        
      case GameObjectTypeIndex.ONION:
        obj.type = 'enemy';
        obj.subType = 'onion';
        obj.width = 48;
        obj.height = 48;
        obj.activationRadius = 200;
        break;
        
      case GameObjectTypeIndex.BROBOT:
        obj.type = 'enemy';
        obj.subType = 'brobot';
        obj.width = 48;
        obj.height = 48;
        obj.activationRadius = 200;
        break;
        
      case GameObjectTypeIndex.SKELETON:
        obj.type = 'enemy';
        obj.subType = 'skeleton';
        obj.width = 48;
        obj.height = 48;
        obj.activationRadius = 200;
        break;
        
      case GameObjectTypeIndex.SNAILBOMB:
        obj.type = 'enemy';
        obj.subType = 'snailbomb';
        obj.width = 48;
        obj.height = 48;
        obj.activationRadius = 200;
        break;
        
      case GameObjectTypeIndex.SHADOWSLIME:
        obj.type = 'enemy';
        obj.subType = 'shadowslime';
        obj.width = 48;
        obj.height = 48;
        obj.activationRadius = 200;
        break;
        
      case GameObjectTypeIndex.MUDMAN:
        obj.type = 'enemy';
        obj.subType = 'mudman';
        obj.width = 48;
        obj.height = 48;
        obj.activationRadius = 200;
        break;
        
      case GameObjectTypeIndex.KARAGUIN:
        obj.type = 'enemy';
        obj.subType = 'karaguin';
        obj.width = 48;
        obj.height = 48;
        obj.activationRadius = 200;
        break;
        
      case GameObjectTypeIndex.PINK_NAMAZU:
        obj.type = 'enemy';
        obj.subType = 'namazu';
        obj.width = 64;
        obj.height = 64;
        obj.activationRadius = 250;
        break;
        
      case GameObjectTypeIndex.TURRET:
      case GameObjectTypeIndex.TURRET_LEFT:
        obj.type = 'enemy';
        obj.subType = 'turret';
        obj.width = 32;
        obj.height = 32;
        obj.activationRadius = 300;
        break;

      case GameObjectTypeIndex.DOOR_RED:
      case GameObjectTypeIndex.DOOR_BLUE:
      case GameObjectTypeIndex.DOOR_GREEN:
        obj.type = 'door';
        obj.width = 32;
        obj.height = 64;
        break;

      case GameObjectTypeIndex.BUTTON_RED:
      case GameObjectTypeIndex.BUTTON_BLUE:
      case GameObjectTypeIndex.BUTTON_GREEN:
        obj.type = 'button';
        obj.width = 32;
        obj.height = 16;
        break;

      case GameObjectTypeIndex.WANDA:
        obj.type = 'npc';
        obj.subType = 'wanda';
        obj.width = 48;
        obj.height = 64;
        obj.activationRadius = 150;
        break;
        
      case GameObjectTypeIndex.KYLE:
        obj.type = 'npc';
        obj.subType = 'kyle';
        obj.width = 48;
        obj.height = 64;
        obj.activationRadius = 150;
        break;
        
      case GameObjectTypeIndex.KABOCHA:
        obj.type = 'npc';
        obj.subType = 'kabocha';
        obj.width = 48;
        obj.height = 64;
        obj.activationRadius = 150;
        break;
        
      case GameObjectTypeIndex.ROKUDOU:
        obj.type = 'npc';
        obj.subType = 'rokudou';
        obj.width = 48;
        obj.height = 64;
        obj.activationRadius = 150;
        break;

      default:
        // Generic object
        obj.width = 32;
        obj.height = 32;
        break;
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
      this.saveLevelProgress();
    }
  }

  /**
   * Complete current level and unlock next
   */
  completeCurrentLevel(): number | null {
    const current = this.levels.get(this.currentLevelId);
    if (current && current.next !== null) {
      this.unlockLevel(current.next);
      return current.next;
    }
    return null;
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
   * Save level progress to localStorage
   */
  private saveLevelProgress(): void {
    const unlocked = Array.from(this.levels.values())
      .filter(l => l.unlocked)
      .map(l => l.id);
    
    try {
      window.localStorage.setItem('replicaIsland_unlockedLevels', JSON.stringify(unlocked));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Load level progress from localStorage
   */
  loadLevelProgress(): void {
    try {
      const saved = window.localStorage.getItem('replicaIsland_unlockedLevels');
      if (saved) {
        const unlocked = JSON.parse(saved) as number[];
        for (const id of unlocked) {
          const level = this.levels.get(id);
          if (level) {
            level.unlocked = true;
          }
        }
      }
    } catch {
      // Ignore storage errors
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
