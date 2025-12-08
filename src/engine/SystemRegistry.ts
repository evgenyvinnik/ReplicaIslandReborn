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
import type { GameObjectCollisionSystem } from './GameObjectCollisionSystem';
import type { ChannelSystem } from './ChannelSystem';
import type { RenderSystem } from './RenderSystem';
import type { TimeSystem } from './TimeSystem';
import type { HotSpotSystem } from './HotSpotSystem';
import type { AnimationSystem } from './AnimationSystem';
import type { LevelSystem } from '../levels/LevelSystem';
import type { GameObjectManager } from '../entities/GameObjectManager';
import type { GameObjectFactory } from '../entities/GameObjectFactory';
import type { GameFlowEvent } from './GameFlowEvent';
import type { EffectsSystem } from './EffectsSystem';

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
  public gameObjectCollisionSystem: GameObjectCollisionSystem | null = null;
  public channelSystem: ChannelSystem | null = null;
  public renderSystem: RenderSystem | null = null;
  public timeSystem: TimeSystem | null = null;
  public levelSystem: LevelSystem | null = null;
  public gameObjectManager: GameObjectManager | null = null;
  public gameObjectFactory: GameObjectFactory | null = null;
  public hotSpotSystem: HotSpotSystem | null = null;
  public animationSystem: AnimationSystem | null = null;
  public gameFlowEvent: GameFlowEvent | null = null;
  public effectsSystem: EffectsSystem | null = null;

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
    this.gameObjectCollisionSystem = null;
    this.channelSystem = null;
    this.renderSystem = null;
    this.timeSystem = null;
    this.levelSystem = null;
    this.gameObjectManager = null;
    this.gameObjectFactory = null;
    this.hotSpotSystem = null;
    this.animationSystem = null;
    this.gameFlowEvent = null;
    this.effectsSystem = null;
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
      case 'factory':
        this.gameObjectFactory = system as unknown as GameObjectFactory;
        break;
      case 'hotSpot':
        this.hotSpotSystem = system as unknown as HotSpotSystem;
        break;
      case 'animation':
        this.animationSystem = system as unknown as AnimationSystem;
        break;
      case 'gameObjectCollision':
        this.gameObjectCollisionSystem = system as unknown as GameObjectCollisionSystem;
        break;
      case 'gameFlowEvent':
        this.gameFlowEvent = system as unknown as GameFlowEvent;
        break;
      case 'effects':
        this.effectsSystem = system as unknown as EffectsSystem;
        break;
    }
  }
}

// Global system registry instance (similar to original's static reference)
export const sSystemRegistry = new SystemRegistry();
