/**
 * Level System - Manages level loading and state
 * Ported from: Original/src/com/replica/replicaisland/LevelSystem.java
 */

import type { LevelData, LevelLayer, LevelObject } from '../types';
import type { CollisionSystem } from '../engine/CollisionSystemNew';
import type { GameObjectManager } from '../entities/GameObjectManager';
import { assetPath } from '../utils/helpers';

export interface LevelInfo {
  id: number;
  name: string;
  file: string;
  next: number | null;
  unlocked: boolean;
}

export class LevelSystem {
  private currentLevel: LevelData | null = null;
  private currentLevelId: number = 0;
  private levels: Map<number, LevelInfo> = new Map();
  
  // References to other systems
  private collisionSystem: CollisionSystem | null = null;
  private gameObjectManager: GameObjectManager | null = null;

  constructor() {
    this.initializeLevelTree();
  }

  /**
   * Initialize the level progression tree
   * Based on Original/res/xml/level_tree.xml
   */
  private initializeLevelTree(): void {
    // This will be populated from level data
    // For now, create a basic structure
    const basicLevels: LevelInfo[] = [
      { id: 1, name: 'Tutorial 1', file: 'level_0_1', next: 2, unlocked: true },
      { id: 2, name: 'Tutorial 2', file: 'level_0_2', next: 3, unlocked: false },
      { id: 3, name: 'Tutorial 3', file: 'level_0_3', next: 4, unlocked: false },
      { id: 4, name: 'Forest 1', file: 'level_1_1', next: 5, unlocked: false },
      { id: 5, name: 'Forest 2', file: 'level_1_2', next: 6, unlocked: false },
    ];

    for (const level of basicLevels) {
      this.levels.set(level.id, level);
    }
  }

  /**
   * Set references to other systems
   */
  setSystems(collision: CollisionSystem, gameObjects: GameObjectManager): void {
    this.collisionSystem = collision;
    this.gameObjectManager = gameObjects;
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
      const response = await fetch(assetPath(`/assets/levels/${levelInfo.file}.json`));
      if (!response.ok) {
        throw new Error(`Failed to load level: ${response.status}`);
      }

      const levelData: LevelData = await response.json();
      this.currentLevel = levelData;
      this.currentLevelId = levelId;

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
    } catch (error) {
      console.error('Error loading level:', error);
      return false;
    }
  }

  /**
   * Spawn level objects
   */
  private spawnLevelObjects(objects: LevelObject[]): void {
    if (!this.gameObjectManager) return;

    for (const objData of objects) {
      // Object spawning will be implemented based on type
      // For now, just log what we would spawn
      // In full implementation, this would use a factory pattern
      this.createObjectFromData(objData);
    }
  }

  /**
   * Create a game object from level data
   */
  private createObjectFromData(data: LevelObject): void {
    if (!this.gameObjectManager) return;

    // This will be expanded to create specific object types
    // For now, create a basic object
    const obj = this.gameObjectManager.createObject();
    obj.type = data.type;
    obj.setPosition(data.x, data.y);
    obj.width = data.width;
    obj.height = data.height;

    // Handle specific types
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
   * Get current level ID
   */
  getCurrentLevelId(): number {
    return this.currentLevelId;
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
   * Unlock a level
   */
  unlockLevel(levelId: number): void {
    const level = this.levels.get(levelId);
    if (level) {
      level.unlocked = true;
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
    if (!this.currentLevel) {
      return { width: 0, height: 0 };
    }
    return {
      width: this.currentLevel.width * this.currentLevel.tileWidth,
      height: this.currentLevel.height * this.currentLevel.tileHeight,
    };
  }

  /**
   * Reset the level system
   */
  reset(): void {
    this.currentLevel = null;
    this.currentLevelId = 0;
  }
}
