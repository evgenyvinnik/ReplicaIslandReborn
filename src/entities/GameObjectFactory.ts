/**
 * Game Object Factory - Creates configured game entities
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 */

import { GameObject } from './GameObject';
import { GameObjectManager } from './GameObjectManager';
import { ObjectPool } from '../utils/ObjectPool';
import { Team, ActionType, HitType } from '../types';
import { SpriteComponent } from './components/SpriteComponent';
import { PhysicsComponent } from './components/PhysicsComponent';
import { MovementComponent } from './components/MovementComponent';
import { PlayerComponent } from './components/PlayerComponent';
import { PatrolComponent } from './components/PatrolComponent';
import { LaunchProjectileComponent } from './components/LaunchProjectileComponent';
import { GhostComponent, setGhostSystemRegistry } from './components/GhostComponent';
import { setCameraBiasSystemRegistry } from './components/CameraBiasComponent';
import { setSelectDialogSystemRegistry } from './components/SelectDialogComponent';
import { TheSourceComponent } from './components/TheSourceComponent';
import { LifetimeComponent } from './components/LifetimeComponent';
import { createObjectAnimation } from '../data/objectAnimations';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { GravityComponent } from './components/GravityComponent';
import { ChangeComponentsComponent } from './components/ChangeComponentsComponent';
import { EnemyAnimation, EnemyAnimationComponent } from './components/EnemyAnimationComponent';
import { createEnemyAnimations } from '../data/enemyAnimations';
import {
  createEnemyCollisionProfile,
  selectEnemyAttackVolumes,
} from './enemyCollisionProfiles';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { MultiSpriteAnimComponent } from './components/MultiSpriteAnimComponent';
import {
  SimpleCollisionComponent,
  setSimpleCollisionSystemRegistry,
} from './components/SimpleCollisionComponent';
import type { RenderSystem } from '../engine/RenderSystem';
import type { CollisionSystem } from '../engine/CollisionSystemNew';
import type { InputSystem } from '../engine/InputSystem';
import type { SystemRegistry } from '../engine/SystemRegistry';

/**
 * Activation radii, derived from the screen size the way the original derives
 * them in GameObjectFactory's constructor. See the fuller note in
 * levels/LevelSystemNew.ts.
 */
const SCREEN_SIZE_RADIUS = Math.sqrt(240 * 240 + 160 * 160);
const TIGHT_ACTIVATION_RADIUS = SCREEN_SIZE_RADIUS + 128;
const NORMAL_ACTIVATION_RADIUS = SCREEN_SIZE_RADIUS * 1.25;
/**
 * The original's mAlwaysActive. GameObject.activationRadius defaults to 0, and
 * GameObjectManager tests `dx*dx + dy*dy < radius*radius`, so leaving it unset
 * means "never within range": the object is deactivated on its very first
 * update and stops running. Every configure* below has to say what it wants.
 */
const ALWAYS_ACTIVE = -1;

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
  WANDA_SHOT = 'wanda_shot',
  TURRET_BULLET = 'turret_bullet',
  THE_SOURCE = 'the_source',
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
  // Component object pools for recycling
  private componentPools: ComponentPools;

  constructor(objectManager: GameObjectManager) {
    this.objectManager = objectManager;

    // Initialize component pools
    this.componentPools = {
      sprite: new ObjectPool(() => new SpriteComponent(), 64),
      physics: new ObjectPool(() => new PhysicsComponent(), 64),
      movement: new ObjectPool(() => new MovementComponent(), 64),
      player: new ObjectPool(() => new PlayerComponent(), 4),
    };

    this.objectManager.setComponentReleaseHandler((object) => {
      this.releasePooledComponents(object);
    });
  }

  private releasePooledComponents(obj: GameObject): void {
    for (const component of obj.getComponents()) {
      if (component instanceof SpriteComponent) {
        this.componentPools.sprite.release(component);
      } else if (component instanceof PhysicsComponent) {
        this.componentPools.physics.release(component);
      } else if (component instanceof MovementComponent) {
        this.componentPools.movement.release(component);
      } else if (component instanceof PlayerComponent) {
        this.componentPools.player.release(component);
      }
    }
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
  /**
   * Set input system
   */
  setInputSystem(_inputSystem: InputSystem): void {
    // this.inputSystem = inputSystem; // Unused in factory, injected in Game.tsx
  }

  /**
   * Set system registry for components that need it
   */
  setSystemRegistry(registry: SystemRegistry): void {
    setGhostSystemRegistry(registry);
    setSimpleCollisionSystemRegistry(registry);
    setCameraBiasSystemRegistry(registry);
    setSelectDialogSystemRegistry(registry.hotSpotSystem, registry.gameFlowEvent);
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
    // All managed objects must come from the manager's pool. Using a separate
    // factory pool meant the manager could never return projectiles/ghosts to
    // their owner, leaking every dynamically spawned entity.
    const obj = this.objectManager.createObject();
    obj.destroyOnDeactivation = true;
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
      case GameObjectType.WANDA_SHOT:
        this.configureWandaShot(obj);
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
      case GameObjectType.THE_SOURCE:
        this.configureTheSource(obj);
        break;
      default:
        // Default configuration
        this.configureBasicObject(obj);
        break;
    }

    // Add to object manager
    this.objectManager.add(obj);

    this.attachObjectSprite(obj);

    return obj;
  }

  /**
   * Give a runtime-spawned object its animation so SpriteComponent draws it.
   *
   * Projectiles and effects come from here rather than from level data, so they
   * need the same treatment LevelSystem gives level-placed objects.
   */
  private attachObjectSprite(obj: GameObject): void {
    if (obj.getComponent(SpriteComponent)?.getCurrentAnimation()) return;

    const animation = createObjectAnimation(obj.type, obj.width, obj.height, obj.subType);
    if (!animation) return;

    const sprite = obj.getComponent(SpriteComponent) ?? new SpriteComponent();
    if (!obj.getComponent(SpriteComponent)) obj.addComponent(sprite);
    if (this.renderSystem) sprite.setRenderSystem(this.renderSystem);
    sprite.addAnimation(animation.name ?? obj.type, animation);
    sprite.playAnimation(animation.name ?? obj.type);
  }

  /**
   * Configure the player character
   */
  private configurePlayer(obj: GameObject): void {
    // spawnPlayer: object.activationRadius = mAlwaysActive.
    obj.activationRadius = ALWAYS_ACTIVE;
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
    obj.type = 'enemy';
    obj.subType = 'brobot';
    obj.team = Team.ENEMY;
    obj.width = 64;
    obj.height = 64;
    obj.life = 1;
    obj.maxLife = 1;
    obj.activationRadius = NORMAL_ACTIVATION_RADIUS;
    const patrol = new PatrolComponent({
      maxSpeed: 50,
      acceleration: 1000,
      flying: false,
      turnToFacePlayer: false,
    });
    obj.addComponent(patrol);
    this.finishRuntimeEnemy(obj, patrol, { width: 32, height: 48, offsetX: 16, offsetY: 16 });
  }

  /**
   * Configure a coin collectible
   */
  private configureCoin(obj: GameObject): void {
    // spawnCoin: object.activationRadius = mTightActivationRadius.
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
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
    // Collectibles are tight, as spawnCoin and spawnRuby are.
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
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
    // A placed object, like the other tight-radius furniture.
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
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
    // spawnEffectSmokeBig: object.activationRadius = mTightActivationRadius.
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
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
    obj.type = 'enemy';
    obj.subType = 'snailbomb';
    obj.width = 64;
    obj.height = 64;
    obj.life = 1;
    obj.maxLife = 1;
    obj.activationRadius = NORMAL_ACTIVATION_RADIUS;

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

    const patrol = new PatrolComponent({
      maxSpeed: 20,
      acceleration: 1000,
      flying: false,
      turnToFacePlayer: false,
      attack: {
        enabled: true,
        atDistance: 300,
        duration: 1,
        delay: 4,
        stopsMovement: true,
      },
    });
    obj.addComponent(patrol);
    obj.addComponent(new LaunchProjectileComponent({
      objectTypeToSpawn: GameObjectType.CANNON_BALL,
      offsetX: 55,
      offsetY: 21,
      velocityX: 100,
      requiredAction: ActionType.ATTACK,
      delayBetweenShots: 0.25,
      projectilesInSet: 3,
      setsPerActivation: 1,
      delayBeforeFirstSet: 5 / 24,
    }));
    this.finishRuntimeEnemy(obj, patrol, { width: 32, height: 48, offsetX: 16, offsetY: 11 });
  }

  /**
   * Complete an enemy created during play with the same physics, animation,
   * collision and possession stack used for a level-placed enemy.
   */
  private finishRuntimeEnemy(
    obj: GameObject,
    patrol: PatrolComponent,
    collisionBox: { width: number; height: number; offsetX: number; offsetY: number }
  ): void {
    obj.addComponent(new GravityComponent());
    const movement = this.componentPools.movement.allocate();
    if (this.collisionSystem) {
      movement.setCollisionSystem(this.collisionSystem);
      movement.setCollisionBox(
        collisionBox.width,
        collisionBox.height,
        collisionBox.offsetX,
        collisionBox.offsetY
      );
    }
    obj.addComponent(movement);

    const profile = createEnemyCollisionProfile(obj.subType);
    if (!profile) return;
    const collision = new DynamicCollisionComponent();
    const reaction = new HitReactionComponent({
      invincibleAfterHitTime: 0.5,
      pauseOnAttack: true,
    });
    collision.setHitReactionComponent(reaction);
    collision.setCollisionVolumes(
      selectEnemyAttackVolumes(profile, obj.getCurrentAction()),
      profile.vulnerability
    );
    obj.addComponent(collision);
    obj.addComponent(reaction);

    const animations = createEnemyAnimations(obj.subType);
    if (animations) {
      const existingSprite = obj.getComponent(SpriteComponent);
      const sprite = existingSprite ?? this.componentPools.sprite.allocate();
      if (!existingSprite) obj.addComponent(sprite);
      if (this.renderSystem) sprite.setRenderSystem(this.renderSystem);
      sprite.setCollisionComponent(collision);
      for (const [index, animation] of animations) {
        sprite.addAnimationAtIndex(index, animation);
      }
      sprite.playAnimation(EnemyAnimation.IDLE);
      const animator = new EnemyAnimationComponent();
      animator.setSprite(sprite);
      obj.addComponent(animator);
    }

    const possessable = profile.vulnerability?.some((volume) => {
      const type = volume.getHitType();
      return type === HitType.INVALID || type === HitType.POSSESS;
    });
    if (possessable) {
      const swap = new ChangeComponentsComponent();
      swap.setPingPongBehavior(true);
      swap.addSwapInComponent(new GhostComponent({
        movementSpeed: 500,
        jumpImpulse: 300,
        acceleration: 1000,
        useOrientationSensor: false,
        delayOnRelease: 1.5,
        killOnRelease: true,
        targetAction: ActionType.MOVE,
        lifeTime: 0,
        ambientSound: 'sound_possession',
      }));
      swap.addSwapOutComponent(patrol);
      reaction.setPossessionComponent(swap);
      obj.addComponent(swap);
    }
  }

  /**
   * Configure Rokudou boss enemy
   * A flying boss that shoots energy balls and bullets
   */
  private configureEnemyRokudou(obj: GameObject): void {
    // spawnEnemyRokudou: object.activationRadius = mNormalActivationRadius.
    obj.activationRadius = NORMAL_ACTIVATION_RADIUS;
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

    // Behaviour (hot-spot flight, guns, hit reaction) is assembled by
    // LevelSystemNew's ROKUDOU case the way the original assembles it; this
    // factory path only builds the body.
  }

  /**
   * Configure a cannon ball projectile (used by Snailbomb)
   */
  private configureCannonBall(obj: GameObject): void {
    obj.team = Team.ENEMY;
    obj.type = 'projectile';
    obj.subType = 'cannon_ball';
    obj.width = 32;
    obj.height = 32;
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
    obj.life = 1;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('snail_bomb');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('fly', {
        frames: [{ x: 0, y: 0, width: 32, height: 32, duration: 0.1 }],
        loop: true,
      });
      sprite.playAnimation('fly');
      obj.addComponent(sprite);
    }

    // Projectiles carry an initial velocity from their launcher. The original
    // uses MovementComponent directly so shots do not lose speed to friction.
    const movement = this.componentPools.movement.allocate();
    obj.addComponent(movement);

    this.attachProjectileCollision(
      obj,
      new SphereCollisionVolume(8, 16, 16, HitType.HIT),
      true
    );

    // Cannon balls disappear when they hit level geometry, matching the
    // original game's SimpleCollision + Lifetime configuration.
    obj.addComponent(new SimpleCollisionComponent());
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(3.0);
    lifetime.setDieOnHitBackground(true);
    obj.addComponent(lifetime);
  }

  /**
   * Configure an energy ball projectile (used by Rokudou and Wanda)
   */
  private configureEnergyBall(obj: GameObject): void {
    obj.team = Team.ENEMY;
    obj.type = 'projectile';
    obj.subType = 'energy_ball';
    obj.width = 32;
    obj.height = 32;
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
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

    const movement = this.componentPools.movement.allocate();
    obj.addComponent(movement);

    this.attachProjectileCollision(
      obj,
      new SphereCollisionVolume(16, 16, 16, HitType.HIT),
      true
    );

    // The original energy ball passes through background geometry and expires
    // by time; this is necessary for Rokudou's shots to cross the finale arena.
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(5.0);
    obj.addComponent(lifetime);
  }

  /** Configure Wanda's neutral, straight-traveling story projectile. */
  private configureWandaShot(obj: GameObject): void {
    obj.team = Team.NONE;
    obj.type = 'projectile';
    obj.subType = 'wanda_shot';
    obj.width = 32;
    obj.height = 32;
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
    obj.life = 1;

    const multiSprite = new MultiSpriteAnimComponent();
    if (this.renderSystem) {
      multiSprite.setRenderSystem(this.renderSystem);
      multiSprite.setSpriteSequence(
        ['energy_ball01', 'energy_ball02', 'energy_ball03', 'energy_ball04'],
        1 / 24,
        true
      );
      obj.addComponent(multiSprite);
    }

    obj.addComponent(this.componentPools.movement.allocate());

    this.attachProjectileCollision(
      obj,
      new SphereCollisionVolume(16, 16, 16, HitType.HIT),
      false
    );

    // Unlike enemy energy balls, the original Wanda shot does not collide
    // with the background and remains alive for the full story beat.
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(5.0);
    obj.addComponent(lifetime);
  }

  /**
   * Configure a turret bullet projectile (used by Rokudou)
   */
  private configureTurretBullet(obj: GameObject): void {
    obj.team = Team.ENEMY;
    obj.type = 'projectile';
    obj.subType = 'turret_bullet';
    obj.width = 16;
    obj.height = 16;
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
    obj.life = 1;

    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('shot01');
      sprite.setRenderSystem(this.renderSystem);
      sprite.addAnimation('fly', {
        frames: [
          { x: 0, y: 0, width: 16, height: 16, duration: 0.1 },
        ],
        loop: true,
      });
      sprite.playAnimation('fly');
      obj.addComponent(sprite);
    }

    const movement = this.componentPools.movement.allocate();
    obj.addComponent(movement);

    this.attachProjectileCollision(
      obj,
      new SphereCollisionVolume(8, 8, 8, HitType.HIT),
      true
    );

    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(3.0);
    obj.addComponent(lifetime);
  }

  /** Give a runtime-spawned shot the attack pipeline carried by its frames. */
  private attachProjectileCollision(
    obj: GameObject,
    attackVolume: SphereCollisionVolume,
    dieOnAttack: boolean
  ): void {
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes([attackVolume], null);
    const reaction = new HitReactionComponent({ dieOnAttack });
    collision.setHitReactionComponent(reaction);
    obj.addComponent(collision);
    obj.addComponent(reaction);
  }

  /**
   * Configure ghost entity for possession mechanic
   * The ghost is controlled by the player and floats freely
   */
  private configureGhost(obj: GameObject): void {
    // spawnPlayerGhost: object.activationRadius = mAlwaysActive. The player is
    // driving this thing, so it must never be culled by distance.
    obj.activationRadius = ALWAYS_ACTIVE;
    obj.team = Team.PLAYER;
    obj.type = 'ghost';
    obj.width = 64;
    obj.height = 64;
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

    // The ghost takes objects over with a POSSESS attack volume, exactly as
    // the original does: Sphere(32, 32, 32, POSSESS) on its animation frames.
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(
      [new SphereCollisionVolume(32, 32, 32, HitType.POSSESS)],
      null
    );
    obj.addComponent(collision);

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
    obj.destroyOnDeactivation = true;

    // The manager releases both the object's pooled components and the object
    // itself when the pending removal is committed.
    this.objectManager.remove(obj);
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
  }
  /**
   * Configure The Source (final boss)
   */
  private configureTheSource(obj: GameObject): void {
    // spawnObjectTheSource: object.activationRadius = mAlwaysActive.
    obj.activationRadius = ALWAYS_ACTIVE;
    obj.team = Team.ENEMY;
    obj.type = 'the_source';
    obj.width = 256;  // Large boss
    obj.height = 256;
    obj.life = 10;    // It takes many hits
    obj.maxLife = 10;
    
    // Add sprite
    const sprite = this.componentPools.sprite.allocate();
    if (sprite && this.renderSystem) {
      sprite.setSprite('the_source'); // Ensure this sprite exists or is loaded
      sprite.setRenderSystem(this.renderSystem);
      
      // Animations
      sprite.addAnimation('idle', {
        frames: [{ x: 0, y: 0, width: 256, height: 256, duration: 1.0 }],
        loop: true,
      });
      
      sprite.playAnimation('idle');
      obj.addComponent(sprite);
    }
    
    // Add physics (static, no gravity)
    const physics = this.componentPools.physics.allocate();
    if (physics) {
      physics.setUseGravity(false);
      physics.setImmovable(true);
      obj.addComponent(physics);
    }
    
    // Add The Source component
    const source = new TheSourceComponent();
    // Configure event triggers if needed (e.g. game ending)
    // source.setGameEvent(GameFlowEvent.EVENT_END_GAME, 0); 
    obj.addComponent(source);
    
    // Add dynamic collision for hit detection
    // Note: TheSourceComponent handles hit reactions
    const collision = new SimpleCollisionComponent();
    obj.addComponent(collision);
  }
}
