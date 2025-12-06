/**
 * Game Object Factory - Creates configured game entities
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 */

import { GameObject } from './GameObject';
import { GameObjectManager } from './GameObjectManager';
import { ObjectPool } from '../utils/ObjectPool';
import { Team } from '../types';
import { SpriteComponent } from './components/SpriteComponent';
import { PhysicsComponent } from './components/PhysicsComponent';
import { MovementComponent } from './components/MovementComponent';
import { PlayerComponent } from './components/PlayerComponent';
import type { RenderSystem } from '../engine/RenderSystem';
import type { CollisionSystem } from '../engine/CollisionSystem';
import type { InputSystem } from '../engine/InputSystem';

// Object type definitions
export enum GameObjectType {
  INVALID = '',
  PLAYER = 'player',
  ANDROID = 'android',
  ENEMY_BROBOT = 'enemy_brobot',
  ENEMY_SKELETON = 'enemy_skeleton',
  ENEMY_WANDA = 'enemy_wanda',
  ENEMY_KYLE = 'enemy_kyle',
  ENEMY_KABOCHA = 'enemy_kabocha',
  COIN = 'coin',
  PEARL = 'pearl',
  DIARY = 'diary',
  SPRING = 'spring',
  DOOR = 'door',
  CANNON = 'cannon',
  CRUSHER = 'crusher',
  SMOKE_POOF = 'smoke_poof',
  GEM = 'gem',
  BREAKABLE_BLOCK = 'breakable_block',
  TURRET = 'turret',
  GHOST = 'ghost',
  MOVING_PLATFORM = 'moving_platform',
  BUTTON = 'button',
}

// Component pools
interface ComponentPools {
  sprite: ObjectPool<SpriteComponent>;
  physics: ObjectPool<PhysicsComponent>;
  movement: ObjectPool<MovementComponent>;
  player: ObjectPool<PlayerComponent>;
}

/**
 * Factory for creating game objects
 */
export class GameObjectFactory {
  private objectManager: GameObjectManager;
  private renderSystem: RenderSystem | null = null;
  private collisionSystem: CollisionSystem | null = null;
  private inputSystem: InputSystem | null = null;

  // Component object pools for recycling
  private componentPools: ComponentPools;

  // Game object pool
  private objectPool: ObjectPool<GameObject>;

  constructor(objectManager: GameObjectManager) {
    this.objectManager = objectManager;
    this.objectPool = new ObjectPool<GameObject>(
      () => new GameObject(),
      64
    );

    // Initialize component pools
    this.componentPools = {
      sprite: new ObjectPool(() => new SpriteComponent(), 64),
      physics: new ObjectPool(() => new PhysicsComponent(), 64),
      movement: new ObjectPool(() => new MovementComponent(), 64),
      player: new ObjectPool(() => new PlayerComponent(), 4),
    };
  }

  /**
   * Set render system for sprites
   */
  setRenderSystem(renderSystem: RenderSystem): void {
    this.renderSystem = renderSystem;
  }

  /**
   * Set collision system
   */
  setCollisionSystem(collisionSystem: CollisionSystem): void {
    this.collisionSystem = collisionSystem;
  }

  /**
   * Set input system
   */
  setInputSystem(inputSystem: InputSystem): void {
    this.inputSystem = inputSystem;
  }

  /**
   * Create a game object based on type
   */
  spawn(
    type: GameObjectType,
    x: number,
    y: number,
    facingLeft: boolean = false
  ): GameObject | null {
    const obj = this.objectPool.allocate();
    if (!obj) return null;

    obj.reset();
    obj.getPosition().set(x, y);
    obj.facingDirection.x = facingLeft ? -1 : 1;

    switch (type) {
      case GameObjectType.PLAYER:
        this.configurePlayer(obj);
        break;
      case GameObjectType.ENEMY_BROBOT:
        this.configureEnemyBrobot(obj);
        break;
      case GameObjectType.COIN:
        this.configureCoin(obj);
        break;
      case GameObjectType.PEARL:
        this.configurePearl(obj);
        break;
      case GameObjectType.SPRING:
        this.configureSpring(obj);
        break;
      case GameObjectType.SMOKE_POOF:
        this.configureSmokePoof(obj);
        break;
      default:
        // Default configuration
        this.configureBasicObject(obj);
        break;
    }

    // Add to object manager
    this.objectManager.add(obj);

    return obj;
  }

  /**
   * Configure the player character
   */
  private configurePlayer(obj: GameObject): void {
    obj.team = Team.PLAYER;
    obj.width = 32;
    obj.height = 48;
    obj.life = 3;
    obj.maxLife = 3;

    // Add sprite component
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('player');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('idle', {
        frames: [{ x: 0, y: 0, width: 32, height: 48, duration: 0.2 }],
        loop: true,
      });
      sprite.addAnimation('walk', {
        frames: [
          { x: 0, y: 0, width: 32, height: 48, duration: 0.1 },
          { x: 32, y: 0, width: 32, height: 48, duration: 0.1 },
          { x: 64, y: 0, width: 32, height: 48, duration: 0.1 },
          { x: 96, y: 0, width: 32, height: 48, duration: 0.1 },
        ],
        loop: true,
      });
      sprite.addAnimation('jump', {
        frames: [{ x: 128, y: 0, width: 32, height: 48, duration: 0.2 }],
        loop: false,
      });
      sprite.playAnimation('idle');
      obj.addComponent(sprite);
    }

    // Add physics component
    const physics = this.componentPools.physics.allocate();
    if (physics) {
      physics.setGravity(1200);
      physics.setMaxVelocity(250, 600);
      physics.setFriction(0.85);
      obj.addComponent(physics);
    }

    // Add movement component
    const movement = this.componentPools.movement.allocate();
    if (movement && this.collisionSystem) {
      movement.setCollisionSystem(this.collisionSystem);
      obj.addComponent(movement);
    }

    // Add player component
    const player = this.componentPools.player.allocate();
    if (player && this.inputSystem) {
      player.setInputSystem(this.inputSystem);
      player.setConfig({
        moveSpeed: 200,
        jumpForce: 450,
        jumpTime: 0.25,
        maxJumps: 2,
      });
      obj.addComponent(player);
    }
  }

  /**
   * Configure a brobot enemy
   */
  private configureEnemyBrobot(obj: GameObject): void {
    obj.team = Team.ENEMY;
    obj.width = 32;
    obj.height = 32;
    obj.life = 1;
    obj.maxLife = 1;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('brobot');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('idle', {
        frames: [
          { x: 0, y: 0, width: 32, height: 32, duration: 0.15 },
          { x: 32, y: 0, width: 32, height: 32, duration: 0.15 },
        ],
        loop: true,
      });
      sprite.playAnimation('idle');
      obj.addComponent(sprite);
    }

    // Add physics
    const physics = this.componentPools.physics.allocate();
    if (physics) {
      physics.setGravity(1200);
      physics.setMaxVelocity(100, 600);
      obj.addComponent(physics);
    }

    // Add movement
    const movement = this.componentPools.movement.allocate();
    if (movement && this.collisionSystem) {
      movement.setCollisionSystem(this.collisionSystem);
      obj.addComponent(movement);
    }

    // Set initial patrol velocity
    obj.getTargetVelocity().x = -50;
  }

  /**
   * Configure a coin collectible
   */
  private configureCoin(obj: GameObject): void {
    obj.team = Team.NONE;
    obj.width = 16;
    obj.height = 16;
    obj.life = 1;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('coin');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('spin', {
        frames: [
          { x: 0, y: 0, width: 16, height: 16, duration: 0.1 },
          { x: 16, y: 0, width: 16, height: 16, duration: 0.1 },
          { x: 32, y: 0, width: 16, height: 16, duration: 0.1 },
          { x: 48, y: 0, width: 16, height: 16, duration: 0.1 },
        ],
        loop: true,
      });
      sprite.playAnimation('spin');
      obj.addComponent(sprite);
    }
  }

  /**
   * Configure a pearl collectible
   */
  private configurePearl(obj: GameObject): void {
    obj.team = Team.NONE;
    obj.width = 24;
    obj.height = 24;
    obj.life = 1;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('pearl');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('shine', {
        frames: [
          { x: 0, y: 0, width: 24, height: 24, duration: 0.15 },
          { x: 24, y: 0, width: 24, height: 24, duration: 0.15 },
        ],
        loop: true,
      });
      sprite.playAnimation('shine');
      obj.addComponent(sprite);
    }
  }

  /**
   * Configure a spring bounce pad
   */
  private configureSpring(obj: GameObject): void {
    obj.team = Team.NONE;
    obj.width = 32;
    obj.height = 16;
    obj.life = 1;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('spring');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('idle', {
        frames: [{ x: 0, y: 0, width: 32, height: 16, duration: 1 }],
        loop: false,
      });
      sprite.addAnimation('bounce', {
        frames: [
          { x: 32, y: 0, width: 32, height: 16, duration: 0.05 },
          { x: 64, y: 0, width: 32, height: 16, duration: 0.05 },
          { x: 96, y: 0, width: 32, height: 16, duration: 0.1 },
        ],
        loop: false,
      });
      sprite.playAnimation('idle');
      obj.addComponent(sprite);
    }
  }

  /**
   * Configure smoke poof effect
   */
  private configureSmokePoof(obj: GameObject): void {
    obj.team = Team.NONE;
    obj.width = 32;
    obj.height = 32;
    obj.life = 1;

    // Add sprite with one-shot animation
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('smoke');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('poof', {
        frames: [
          { x: 0, y: 0, width: 32, height: 32, duration: 0.08 },
          { x: 32, y: 0, width: 32, height: 32, duration: 0.08 },
          { x: 64, y: 0, width: 32, height: 32, duration: 0.08 },
          { x: 96, y: 0, width: 32, height: 32, duration: 0.08 },
        ],
        loop: false,
      });
      sprite.playAnimation('poof');
      obj.addComponent(sprite);
    }
  }

  /**
   * Configure a basic object
   */
  private configureBasicObject(obj: GameObject): void {
    obj.team = Team.NONE;
    obj.width = 32;
    obj.height = 32;
    obj.life = 1;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('default');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('idle', {
        frames: [{ x: 0, y: 0, width: 32, height: 32, duration: 1 }],
        loop: true,
      });
      sprite.playAnimation('idle');
      obj.addComponent(sprite);
    }
  }

  /**
   * Despawn a game object and return it to the pool
   */
  despawn(obj: GameObject): void {
    // Return components to pools
    const components = obj.getComponents();
    for (const component of components) {
      if (component instanceof SpriteComponent) {
        component.reset();
        this.componentPools.sprite.release(component);
      } else if (component instanceof PhysicsComponent) {
        component.reset();
        this.componentPools.physics.release(component);
      } else if (component instanceof MovementComponent) {
        this.componentPools.movement.release(component);
      } else if (component instanceof PlayerComponent) {
        this.componentPools.player.release(component);
      }
    }

    // Remove from manager
    this.objectManager.remove(obj);

    // Reset and return to pool
    obj.reset();
    this.objectPool.release(obj);
  }

  /**
   * Spawn object from level data
   */
  spawnFromLevelData(
    objectData: { type: string; x: number; y: number; flipX?: boolean }
  ): GameObject | null {
    const typeMap: Record<string, GameObjectType> = {
      player: GameObjectType.PLAYER,
      android: GameObjectType.ANDROID,
      brobot: GameObjectType.ENEMY_BROBOT,
      skeleton: GameObjectType.ENEMY_SKELETON,
      wanda: GameObjectType.ENEMY_WANDA,
      kyle: GameObjectType.ENEMY_KYLE,
      kabocha: GameObjectType.ENEMY_KABOCHA,
      coin: GameObjectType.COIN,
      pearl: GameObjectType.PEARL,
      diary: GameObjectType.DIARY,
      spring: GameObjectType.SPRING,
      door: GameObjectType.DOOR,
      cannon: GameObjectType.CANNON,
      crusher: GameObjectType.CRUSHER,
      smoke: GameObjectType.SMOKE_POOF,
      gem: GameObjectType.GEM,
      breakable: GameObjectType.BREAKABLE_BLOCK,
      turret: GameObjectType.TURRET,
      ghost: GameObjectType.GHOST,
      platform: GameObjectType.MOVING_PLATFORM,
      button: GameObjectType.BUTTON,
    };

    const type = typeMap[objectData.type] || GameObjectType.PLAYER;
    return this.spawn(type, objectData.x, objectData.y, objectData.flipX || false);
  }

  /**
   * Get the player object (assumes only one player exists)
   */
  getPlayer(): GameObject | null {
    return this.objectManager.getObjectByTeam(Team.PLAYER);
  }

  /**
   * Reset factory pools
   */
  reset(): void {
    this.componentPools.sprite.clear();
    this.componentPools.physics.clear();
    this.componentPools.movement.clear();
    this.componentPools.player.clear();
    this.objectPool.clear();
  }
}
