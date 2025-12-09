/**
 * Game Object Factory - Creates configured game entities
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 */

import { GameObject } from './GameObject';
import { GameObjectManager } from './GameObjectManager';
import { ObjectPool } from '../utils/ObjectPool';
import { Team, ActionType } from '../types';
import { SpriteComponent } from './components/SpriteComponent';
import { PhysicsComponent } from './components/PhysicsComponent';
import { MovementComponent } from './components/MovementComponent';
import { PlayerComponent } from './components/PlayerComponent';
import { GhostComponent, setGhostSystemRegistry } from './components/GhostComponent';
import { SnailbombComponent } from './components/SnailbombComponent';
import { RokudouBossComponent } from './components/RokudouBossComponent';
import { LifetimeComponent } from './components/LifetimeComponent';
import { MultiSpriteAnimComponent } from './components/MultiSpriteAnimComponent';
import { SimpleCollisionComponent } from './components/SimpleCollisionComponent';
import type { RenderSystem } from '../engine/RenderSystem';
import type { CollisionSystem } from '../engine/CollisionSystemNew';
import type { InputSystem } from '../engine/InputSystem';
import type { SystemRegistry } from '../engine/SystemRegistry';

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
  ENEMY_SNAILBOMB = 'enemy_snailbomb',
  ENEMY_ROKUDOU = 'enemy_rokudou',
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
  CANNON_BALL = 'cannon_ball',
  ENERGY_BALL = 'energy_ball',
  TURRET_BULLET = 'turret_bullet',
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
   * Set system registry for components that need it
   */
  setSystemRegistry(registry: SystemRegistry): void {
    setGhostSystemRegistry(registry);
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
      case GameObjectType.ENEMY_SNAILBOMB:
        this.configureEnemySnailbomb(obj);
        break;
      case GameObjectType.ENEMY_ROKUDOU:
        this.configureEnemyRokudou(obj);
        break;
      case GameObjectType.CANNON_BALL:
        this.configureCannonBall(obj);
        break;
      case GameObjectType.ENERGY_BALL:
        this.configureEnergyBall(obj);
        break;
      case GameObjectType.TURRET_BULLET:
        this.configureTurretBullet(obj);
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
      case GameObjectType.GHOST:
        this.configureGhost(obj);
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
    if (player) {
      // Systems are injected in Game.tsx via setSystems()
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
    obj.type = 'coin';
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
    obj.type = 'pearl';
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
   * Configure Snailbomb enemy
   * A ground-based enemy that patrols and shoots cannon balls
   */
  private configureEnemySnailbomb(obj: GameObject): void {
    obj.team = Team.ENEMY;
    obj.type = 'snailbomb';
    obj.width = 64;
    obj.height = 64;
    obj.life = 1;
    obj.maxLife = 1;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('snailbomb');
      sprite.setRenderSystem(this.renderSystem);
      
      // Idle animation (single frame)
      sprite.addAnimation('idle', {
        frames: [
          { x: 0, y: 0, width: 64, height: 64, duration: 1.0 },
        ],
        loop: true,
      });
      
      // Walk animation (5 frames)
      sprite.addAnimation('walk', {
        frames: [
          { x: 0, y: 0, width: 64, height: 64, duration: 0.15 },
          { x: 64, y: 0, width: 64, height: 64, duration: 0.15 },
          { x: 128, y: 0, width: 64, height: 64, duration: 0.15 },
          { x: 192, y: 0, width: 64, height: 64, duration: 0.15 },
          { x: 256, y: 0, width: 64, height: 64, duration: 0.15 },
        ],
        loop: true,
      });
      
      // Attack animation (2 frames)
      sprite.addAnimation('attack', {
        frames: [
          { x: 0, y: 64, width: 64, height: 64, duration: 0.2 },
          { x: 64, y: 64, width: 64, height: 64, duration: 0.2 },
        ],
        loop: true,
      });
      
      sprite.playAnimation('walk');
      obj.addComponent(sprite);
    }

    // Add physics
    const physics = this.componentPools.physics.allocate();
    if (physics) {
      physics.setGravity(1200);
      physics.setMaxVelocity(50, 600);
      obj.addComponent(physics);
    }

    // Add movement
    const movement = this.componentPools.movement.allocate();
    if (movement && this.collisionSystem) {
      movement.setCollisionSystem(this.collisionSystem);
      obj.addComponent(movement);
    }

    // Add snailbomb AI component
    const snailbomb = new SnailbombComponent({
      patrolSpeed: 20,
      attackRange: 300,
      shotCount: 3,
    });
    
    // Set up projectile spawner callback
    snailbomb.setProjectileSpawner((x, y, vx, vy) => {
      const projectile = this.spawn(GameObjectType.CANNON_BALL, x, y);
      if (projectile) {
        projectile.setVelocity(vx, vy);
      }
    });
    
    obj.addComponent(snailbomb);
  }

  /**
   * Configure Rokudou boss enemy
   * A flying boss that shoots energy balls and bullets
   */
  private configureEnemyRokudou(obj: GameObject): void {
    obj.team = Team.ENEMY;
    obj.type = 'rokudou';
    obj.width = 128;
    obj.height = 128;
    obj.life = 3;
    obj.maxLife = 3;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('rokudou');
      sprite.setRenderSystem(this.renderSystem);
      
      // Idle animation
      sprite.addAnimation('idle', {
        frames: [
          { x: 0, y: 0, width: 128, height: 128, duration: 0.2 },
        ],
        loop: true,
      });
      
      // Fly animation (6 frames)
      sprite.addAnimation('fly', {
        frames: [
          { x: 0, y: 0, width: 128, height: 128, duration: 0.1 },
          { x: 128, y: 0, width: 128, height: 128, duration: 0.1 },
          { x: 256, y: 0, width: 128, height: 128, duration: 0.1 },
          { x: 384, y: 0, width: 128, height: 128, duration: 0.1 },
          { x: 512, y: 0, width: 128, height: 128, duration: 0.1 },
          { x: 640, y: 0, width: 128, height: 128, duration: 0.1 },
        ],
        loop: true,
      });
      
      // Shoot animation
      sprite.addAnimation('shoot', {
        frames: [
          { x: 0, y: 128, width: 128, height: 128, duration: 0.15 },
          { x: 128, y: 128, width: 128, height: 128, duration: 0.15 },
        ],
        loop: true,
      });
      
      // Surprised animation
      sprite.addAnimation('surprised', {
        frames: [
          { x: 256, y: 128, width: 128, height: 128, duration: 0.2 },
        ],
        loop: true,
      });
      
      // Hit reaction animation (7 frames from original)
      sprite.addAnimation('hit', {
        frames: [
          { x: 0, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 128, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 256, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 384, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 512, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 640, y: 256, width: 128, height: 128, duration: 0.08 },
          { x: 768, y: 256, width: 128, height: 128, duration: 0.08 },
        ],
        loop: false,
      });
      
      // Death animation (5 frames)
      sprite.addAnimation('death', {
        frames: [
          { x: 0, y: 384, width: 128, height: 128, duration: 0.12 },
          { x: 128, y: 384, width: 128, height: 128, duration: 0.12 },
          { x: 256, y: 384, width: 128, height: 128, duration: 0.12 },
          { x: 384, y: 384, width: 128, height: 128, duration: 0.12 },
          { x: 512, y: 384, width: 128, height: 128, duration: 0.12 },
        ],
        loop: false,
      });
      
      sprite.playAnimation('idle');
      obj.addComponent(sprite);
    }

    // Add physics (no gravity - Rokudou flies)
    const physics = this.componentPools.physics.allocate();
    if (physics) {
      physics.setUseGravity(false);
      physics.setMaxVelocity(200, 200);
      obj.addComponent(physics);
    }

    // Add movement
    const movement = this.componentPools.movement.allocate();
    if (movement && this.collisionSystem) {
      movement.setCollisionSystem(this.collisionSystem);
      obj.addComponent(movement);
    }

    // Add Rokudou boss AI component
    const rokudou = new RokudouBossComponent({
      life: 3,
      attackRange: 300,
      movementSpeed: 100,
    });
    
    // Set up projectile spawner callback
    rokudou.setProjectileSpawner((type, x, y, vx, vy) => {
      const projectileType = type === 'energy_ball' 
        ? GameObjectType.ENERGY_BALL 
        : GameObjectType.TURRET_BULLET;
      const projectile = this.spawn(projectileType, x, y);
      if (projectile) {
        projectile.setVelocity(vx, vy);
      }
    });
    
    obj.addComponent(rokudou);
  }

  /**
   * Configure a cannon ball projectile (used by Snailbomb)
   */
  private configureCannonBall(obj: GameObject): void {
    obj.team = Team.ENEMY;
    obj.type = 'projectile';
    obj.width = 16;
    obj.height = 16;
    obj.life = 1;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('snail_bomb');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('fly', {
        frames: [
          { x: 0, y: 0, width: 16, height: 16, duration: 0.1 },
          { x: 16, y: 0, width: 16, height: 16, duration: 0.1 },
        ],
        loop: true,
      });
      sprite.playAnimation('fly');
      obj.addComponent(sprite);
    }

    // Add physics (no gravity for horizontal travel)
    const physics = this.componentPools.physics.allocate();
    if (physics) {
      physics.setUseGravity(false);
      physics.setMaxVelocity(300, 300);
      obj.addComponent(physics);
    }
  }

  /**
   * Configure an energy ball projectile (used by Rokudou and Wanda)
   */
  private configureEnergyBall(obj: GameObject): void {
    obj.team = Team.ENEMY;
    obj.type = 'projectile';
    obj.width = 32;
    obj.height = 32;
    obj.life = 1;

    // Add multi-sprite animated component for energy ball
    // Since each frame is a separate image (energy_ball01-04), we use MultiSpriteAnimComponent
    const multiSprite = new MultiSpriteAnimComponent();
    if (this.renderSystem) {
      multiSprite.setRenderSystem(this.renderSystem);
      multiSprite.setSpriteSequence(
        ['energy_ball01', 'energy_ball02', 'energy_ball03', 'energy_ball04'],
        0.08,  // 80ms per frame
        true   // loop
      );
      obj.addComponent(multiSprite);
    }

    // Add physics (no gravity for straight projectile - like Wanda's attack)
    const physics = this.componentPools.physics.allocate();
    if (physics) {
      physics.setGravity(0);  // Straight trajectory
      physics.setMaxVelocity(500, 500);
      obj.addComponent(physics);
    }

    // Add simple collision for background collision detection (ray casting)
    const simpleCollision = new SimpleCollisionComponent();
    obj.addComponent(simpleCollision);

    // Add lifetime component so projectile disappears after some time
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(3.0);
    lifetime.setDieOnHitBackground(true);
    obj.addComponent(lifetime);
  }

  /**
   * Configure a turret bullet projectile (used by Rokudou)
   */
  private configureTurretBullet(obj: GameObject): void {
    obj.team = Team.ENEMY;
    obj.type = 'projectile';
    obj.width = 8;
    obj.height = 8;
    obj.life = 1;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('bullet');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('fly', {
        frames: [
          { x: 0, y: 0, width: 8, height: 8, duration: 0.1 },
        ],
        loop: true,
      });
      sprite.playAnimation('fly');
      obj.addComponent(sprite);
    }

    // Add physics (no gravity)
    const physics = this.componentPools.physics.allocate();
    if (physics) {
      physics.setUseGravity(false);
      physics.setMaxVelocity(500, 500);
      obj.addComponent(physics);
    }
  }

  /**
   * Configure ghost entity for possession mechanic
   * The ghost is controlled by the player and floats freely
   */
  private configureGhost(obj: GameObject): void {
    obj.team = Team.PLAYER;
    obj.type = 'ghost';
    obj.width = 32;
    obj.height = 32;
    obj.life = 1;

    // Add sprite component (ghost sprite)
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('ghost');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('float', {
        frames: [
          { x: 0, y: 0, width: 32, height: 32, duration: 0.1 },
        ],
        loop: true,
      });
      sprite.playAnimation('float');
      obj.addComponent(sprite);
    }

    // Add physics for movement
    const physics = this.componentPools.physics.allocate();
    if (physics) {
      physics.setUseGravity(false);  // Ghost floats, no gravity
      physics.setMaxVelocity(300, 300);  // Allow movement in all directions
      obj.addComponent(physics);
    }

    // Add movement component
    const movement = this.componentPools.movement.allocate();
    if (movement) {
      // MovementComponent doesn't have setMaxSpeed, velocity is handled by physics
      obj.addComponent(movement);
    }

    // Add ghost component for possession behavior
    const ghost = new GhostComponent({
      movementSpeed: 200,
      jumpImpulse: 250,
      acceleration: 500,
      useOrientationSensor: true,  // Allow free movement in all directions
      delayOnRelease: 0.3,
      killOnRelease: true,  // Remove ghost when released
      targetAction: ActionType.MOVE,
      lifeTime: 0,  // Unlimited by default, set based on gems collected
      changeActionOnButton: false,
      ambientSound: 'sound_possession',
    });
    obj.addComponent(ghost);
  }

  /**
   * Spawn a ghost at the player's position with gem-based duration
   */
  spawnGhost(playerX: number, playerY: number, gemCount: number): GameObject | null {
    const ghost = this.spawn(GameObjectType.GHOST, playerX, playerY);
    if (ghost) {
      // Set lifetime based on gems collected (from original PlayerComponent.java)
      // Find the GhostComponent in the ghost's components
      for (const component of ghost.getComponents()) {
        if (component instanceof GhostComponent) {
          let lifeTime = 3.0;  // NO_GEMS_GHOST_TIME
          if (gemCount >= 2) {
            lifeTime = 0;  // Unlimited with 2+ gems
          } else if (gemCount >= 1) {
            lifeTime = 8.0;  // ONE_GEM_GHOST_TIME
          }
          component.setLifeTime(lifeTime);
          break;
        }
      }
    }
    return ghost;
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
      snailbomb: GameObjectType.ENEMY_SNAILBOMB,
      rokudou: GameObjectType.ENEMY_ROKUDOU,
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
