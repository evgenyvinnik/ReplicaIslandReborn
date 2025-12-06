/**
 * System Registry - Central hub for all game systems
 * Ported from: Original/src/com/replica/replicaisland/ObjectRegistry.java
 *
 * Provides global access to game systems similar to the original's static registry
 */

import type { InputSystem } from './InputSystem';
import type { SoundSystem } from './SoundSystem';
import type { CameraSystem } from './CameraSystem';
import type { CollisionSystem } from './CollisionSystem';
import type { RenderSystem } from './RenderSystem';
import type { TimeSystem } from './TimeSystem';
import type { LevelSystem } from '../levels/LevelSystem';
import type { GameObjectManager } from '../entities/GameObjectManager';

/**
 * Central registry for all game systems
 * This pattern matches the original Java implementation
 */
export class SystemRegistry {
  // Core systems
  public inputSystem: InputSystem | null = null;
  public soundSystem: SoundSystem | null = null;
  public cameraSystem: CameraSystem | null = null;
  public collisionSystem: CollisionSystem | null = null;
  public renderSystem: RenderSystem | null = null;
  public timeSystem: TimeSystem | null = null;
  public levelSystem: LevelSystem | null = null;
  public gameObjectManager: GameObjectManager | null = null;

  // Game configuration
  public gameWidth: number = 480;
  public gameHeight: number = 320;
  public debugMode: boolean = false;

  /**
   * Reset all systems
   */
  reset(): void {
    this.inputSystem = null;
    this.soundSystem = null;
    this.cameraSystem = null;
    this.collisionSystem = null;
    this.renderSystem = null;
    this.timeSystem = null;
    this.levelSystem = null;
    this.gameObjectManager = null;
  }

  /**
   * Register a system
   */
  register<T>(system: T, type: string): void {
    switch (type) {
      case 'input':
        this.inputSystem = system as unknown as InputSystem;
        break;
      case 'sound':
        this.soundSystem = system as unknown as SoundSystem;
        break;
      case 'camera':
        this.cameraSystem = system as unknown as CameraSystem;
        break;
      case 'collision':
        this.collisionSystem = system as unknown as CollisionSystem;
        break;
      case 'render':
        this.renderSystem = system as unknown as RenderSystem;
        break;
      case 'time':
        this.timeSystem = system as unknown as TimeSystem;
        break;
      case 'level':
        this.levelSystem = system as unknown as LevelSystem;
        break;
      case 'gameObject':
        this.gameObjectManager = system as unknown as GameObjectManager;
        break;
    }
  }
}

// Global system registry instance (similar to original's static reference)
export const sSystemRegistry = new SystemRegistry();
