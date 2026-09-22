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
import { configurePlayerObject } from './player';
import { configureCollectible } from './collectible';
import { configureRokudou } from './rokudou';
import { configureButton, configureDoor } from './buttonGate';
import { PatrolComponent } from './components/PatrolComponent';
import { LaunchProjectileComponent } from './components/LaunchProjectileComponent';
import { GhostComponent, setGhostSystemRegistry } from './components/GhostComponent';
import { setCameraBiasSystemRegistry } from './components/CameraBiasComponent';
import { setSelectDialogSystemRegistry } from './components/SelectDialogComponent';
import { configureTheSource } from './theSource';
import { LifetimeComponent } from './components/LifetimeComponent';
import { FadeDrawableComponent, FadeFunction, FadeLoopType } from './components/FadeDrawableComponent';
import { createObjectAnimation } from '../data/objectAnimations';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { GravityComponent } from './components/GravityComponent';
import { ChangeComponentsComponent } from './components/ChangeComponentsComponent';
import { attachEnemyCollisionResponse, attachPossessedCollisionResponse } from './enemyPhysics';
import { EnemyAnimation, EnemyAnimationComponent } from './components/EnemyAnimationComponent';
import { createEnemyAnimations } from '../data/enemyAnimations';
import {
  createEnemyCollisionProfile,
  selectEnemyAttackVolumes,
} from './enemyCollisionProfiles';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { drawPriorityFor } from '../data/objectDrawPriority';
import { BIG_SMOKE_FRAMES, bigSmokeFrameTimes } from '../data/smokeAnimation';
import { configureGiantExplosion } from './giantExplosion';
import { configureExplosion } from './explosion';
import { configureProjectile } from './projectile';
import { configureBreakableBlock } from './breakableBlock';
import {
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
  RUBY = 'ruby',
  PEARL = 'pearl',
  DIARY = 'diary',
  SPRING = 'spring',
  DOOR = 'door',
  DOOR_RED = 'door_red',
  DOOR_BLUE = 'door_blue',
  DOOR_GREEN = 'door_green',
  DOOR_RED_NONBLOCKING = 'door_red_nonblocking',
  DOOR_BLUE_NONBLOCKING = 'door_blue_nonblocking',
  DOOR_GREEN_NONBLOCKING = 'door_green_nonblocking',
  CANNON = 'cannon',
  CRUSHER = 'crusher',
  SMOKE_POOF = 'smoke_poof',
  SMOKE_BIG = 'smoke_big',
  SMOKE_SMALL = 'smoke_small',
  DUST = 'dust',
  FLASH = 'flash',
  EXPLOSION_GIANT = 'explosion_giant',
  EXPLOSION_SMALL = 'explosion_small',
  EXPLOSION_LARGE = 'explosion_large',
  GEM = 'gem',
  GEM_EFFECT = 'gem_effect',
  BREAKABLE_BLOCK = 'breakable_block',
  BLOCK_PIECE = 'block_piece',
  BLOCK_PIECE_SPAWNER = 'block_piece_spawner',
  TURRET = 'turret',
  GHOST = 'ghost',
  MOVING_PLATFORM = 'moving_platform',
  BUTTON = 'button',
  BUTTON_RED = 'button_red',
  BUTTON_BLUE = 'button_blue',
  BUTTON_GREEN = 'button_green',
  CANNON_BALL = 'cannon_ball',
  ENERGY_BALL = 'energy_ball',
  WANDA_SHOT = 'wanda_shot',
  TURRET_BULLET = 'turret_bullet',
  BROBOT_BULLET = 'brobot_bullet',
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
  private playerMaxLife: number = 3;
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

  /** Match the level loader's configured difficulty for runtime players. */
  setPlayerMaxLife(life: number): void {
    this.playerMaxLife = Math.max(1, Math.floor(life));
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
      case GameObjectType.ENERGY_BALL:
      case GameObjectType.WANDA_SHOT:
      case GameObjectType.TURRET_BULLET:
      case GameObjectType.BROBOT_BULLET:
        configureProjectile(obj, type, this.componentPools.movement.allocate());
        break;
      case GameObjectType.COIN:
        configureCollectible(obj, 'coin');
        break;
      case GameObjectType.RUBY:
        configureCollectible(obj, 'ruby');
        break;
      case GameObjectType.DIARY:
        configureCollectible(obj, 'diary');
        break;
      case GameObjectType.PEARL:
        this.configurePearl(obj);
        break;
      case GameObjectType.SPRING:
        this.configureSpring(obj);
        break;
      case GameObjectType.DOOR:
      case GameObjectType.DOOR_RED:
        configureDoor(obj, 'red');
        break;
      case GameObjectType.DOOR_BLUE:
        configureDoor(obj, 'blue');
        break;
      case GameObjectType.DOOR_GREEN:
        configureDoor(obj, 'green');
        break;
      case GameObjectType.DOOR_RED_NONBLOCKING:
        configureDoor(obj, 'red', false);
        break;
      case GameObjectType.DOOR_BLUE_NONBLOCKING:
        configureDoor(obj, 'blue', false);
        break;
      case GameObjectType.DOOR_GREEN_NONBLOCKING:
        configureDoor(obj, 'green', false);
        break;
      case GameObjectType.BUTTON:
      case GameObjectType.BUTTON_RED:
        configureButton(obj, 'red');
        break;
      case GameObjectType.BUTTON_BLUE:
        configureButton(obj, 'blue');
        break;
      case GameObjectType.BUTTON_GREEN:
        configureButton(obj, 'green');
        break;
      case GameObjectType.SMOKE_POOF:
        this.configureSmokePoof(obj);
        break;
      case GameObjectType.SMOKE_BIG:
        this.configureSmokeParticle(obj, true);
        break;
      case GameObjectType.SMOKE_SMALL:
        this.configureSmokeParticle(obj, false);
        break;
      case GameObjectType.DUST:
        this.configureDust(obj);
        break;
      case GameObjectType.FLASH:
        this.configureFlash(obj);
        break;
      case GameObjectType.GEM_EFFECT:
        this.configureGemEffect(obj);
        break;
      case GameObjectType.EXPLOSION_GIANT:
        configureGiantExplosion(obj, this.renderSystem);
        break;
      case GameObjectType.EXPLOSION_SMALL:
      case GameObjectType.EXPLOSION_LARGE:
        configureExplosion(obj, type === GameObjectType.EXPLOSION_LARGE, this.renderSystem);
        break;
      case GameObjectType.BREAKABLE_BLOCK:
        configureBreakableBlock(obj);
        break;
      case GameObjectType.BLOCK_PIECE:
        this.configureBlockPiece(obj);
        break;
      case GameObjectType.BLOCK_PIECE_SPAWNER:
        this.configureBlockPieceSpawner(obj);
        break;
      case GameObjectType.GHOST:
        this.configureGhost(obj);
        break;
      case GameObjectType.THE_SOURCE:
        configureTheSource(obj, this.renderSystem);
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
    // The Source owns five independent layer priorities, not one generic sprite.
    if (obj.subType === 'the_source') return;
    const existing = obj.getComponent(SpriteComponent);
    if (existing) {
      existing.setPriority(drawPriorityFor(obj));
      if (this.renderSystem) existing.setRenderSystem(this.renderSystem);
      if (existing.getCurrentAnimation()) return;
    }

    const animation = createObjectAnimation(obj.type, obj.width, obj.height, obj.subType);
    if (!animation) return;

    const sprite = obj.getComponent(SpriteComponent) ?? new SpriteComponent();
    if (!obj.getComponent(SpriteComponent)) obj.addComponent(sprite);
    sprite.setPriority(drawPriorityFor(obj));
    if (this.renderSystem) sprite.setRenderSystem(this.renderSystem);
    sprite.addAnimation(animation.name ?? obj.type, animation);
    sprite.playAnimation(animation.name ?? obj.type);
  }

  /**
   * Configure the player character
   */
  private configurePlayer(obj: GameObject): void {
    const sprite = this.componentPools.sprite.allocate();
    if (this.renderSystem) sprite.setRenderSystem(this.renderSystem);
    configurePlayerObject(obj, this.playerMaxLife, this.componentPools.player.allocate(), sprite);
    this.objectManager.setPlayer(obj);
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

  /** Original bouncing debris emitted when a breakable block dies. */
  private configureBlockPiece(obj: GameObject): void {
    obj.type = 'effect';
    obj.subType = 'block_piece';
    obj.width = obj.height = 16;
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
    obj.addComponent(new GravityComponent());
    const movement = this.componentPools.movement.allocate();
    if (this.collisionSystem) movement.setCollisionSystem(this.collisionSystem);
    movement.setCollisionBox(12, 12, 2, 2);
    movement.setBounciness(0.3);
    obj.addComponent(movement);
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(3);
    obj.addComponent(lifetime);
  }

  private configureBlockPieceSpawner(obj: GameObject): void {
    obj.type = 'effect';
    obj.subType = 'block_piece_spawner';
    obj.width = obj.height = 1;
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(0.5);
    obj.addComponent(lifetime);
    obj.addComponent(new LaunchProjectileComponent({
      objectTypeToSpawn: GameObjectType.BLOCK_PIECE, setsPerActivation: 1,
      projectilesInSet: 3, delayBetweenShots: 0, delayBeforeFirstSet: 0,
      offsetX: 16, offsetY: 16, velocityX: 600, velocityY: 1000, thetaError: 1,
    }));
  }

  /**
   * Original spawnGemEffectSpawner: six one-shot guns at 60-degree intervals.
   * Emit directly from the pickup; the original's invisible emitter has no
   * later shots. Its (16,16) Y-up offset is the center of the 32px ruby.
   */
  spawnRubyBurst(ruby: GameObject): void {
    for (let index = 0; index < 6; index++) {
      const angle = index * Math.PI * 2 / 6;
      const gem = this.spawn(
        GameObjectType.GEM_EFFECT,
        ruby.getCenteredPositionX() - 16,
        ruby.getCenteredPositionY() - 16
      );
      if (!gem) continue;
      gem.getVelocity().set(Math.sin(angle) * 150, -Math.cos(angle) * 150);
      gem.getTargetVelocity().set(gem.getVelocity());
    }
  }

  /** Original spawnGemEffect: moving ruby artwork, not another collectible. */
  private configureGemEffect(obj: GameObject): void {
    obj.type = 'effect';
    obj.subType = 'gem_effect';
    obj.team = Team.NONE;
    obj.width = obj.height = 32;
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
    const sprite = this.componentPools.sprite.allocate();
    if (this.renderSystem) sprite.setRenderSystem(this.renderSystem);
    sprite.addAnimation('gem', {
      frames: [{ sprite: 'ruby01', x: 0, y: 0, width: 32, height: 32, duration: 0.5 }],
      loop: false,
    });
    sprite.playAnimation('gem');
    obj.addComponent(sprite);
    obj.addComponent(this.componentPools.movement.allocate());
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(0.5);
    obj.addComponent(lifetime);
    const fade = new FadeDrawableComponent();
    fade.setupFade({
      startOpacity: 1, endOpacity: 0, duration: 0.5,
      loopType: FadeLoopType.NONE, fadeFunction: FadeFunction.LINEAR,
    });
    fade.setSpriteComponent(sprite);
    obj.addComponent(fade);
  }

  /** Configure smoke poof effect. */
  private configureSmokePoof(obj: GameObject): void {
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
    obj.team = Team.NONE;
    obj.type = 'effect';
    obj.subType = 'smoke_poof';
    obj.width = obj.height = 1;
    obj.life = 1;
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(0.5);
    obj.addComponent(lifetime);
    // Original spawnSmokePoof is an invisible emitter with two three-shot guns.
    for (const type of [GameObjectType.SMOKE_BIG, GameObjectType.SMOKE_SMALL]) {
      obj.addComponent(new LaunchProjectileComponent({
        objectTypeToSpawn: type, setsPerActivation: 1, projectilesInSet: 3,
        delayBetweenShots: 0, velocityX: 200, velocityY: -200,
        offsetX: 16, offsetY: 16, thetaError: 1,
      }));
    }
  }

  private configureSmokeParticle(obj: GameObject, big: boolean): void {
    obj.activationRadius = big ? TIGHT_ACTIVATION_RADIUS : ALWAYS_ACTIVE;
    obj.team = Team.NONE;
    obj.type = 'effect';
    obj.subType = big ? 'smoke_big' : 'smoke_small';
    const size = big ? 32 : 16;
    obj.width = obj.height = size;
    obj.life = 1;

    const holds = big ? bigSmokeFrameTimes() : [10, 1, 1, 1, 1];
    const frames = big ? BIG_SMOKE_FRAMES : [1, 2, 3, 4, 5].map(n => `effect_smoke_small0${n}.png`);
    const sprite = new SpriteComponent();
    if (this.renderSystem) sprite.setRenderSystem(this.renderSystem);
    sprite.addAnimation('poof', {
      frames: frames.map((name, i) => ({
        sprite: name, x: 0, y: 0, width: size, height: size, duration: holds[i] / 24,
      })),
      loop: false,
    });
    sprite.playAnimation('poof');
    obj.addComponent(sprite);
    obj.addComponent(new MovementComponent());
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(holds.reduce((sum, frames) => sum + frames, 0) / 24);
    obj.addComponent(lifetime);
  }

  /** Original spawnEffectFlash: Kyle's stationary, non-damaging dash impact. */
  private configureFlash(obj: GameObject): void {
    obj.type = 'effect';
    obj.subType = 'flash';
    obj.team = Team.NONE;
    obj.width = obj.height = 64;
    obj.life = 1;
    obj.activationRadius = ALWAYS_ACTIVE;
    const sprite = new SpriteComponent();
    if (this.renderSystem) sprite.setRenderSystem(this.renderSystem);
    sprite.addAnimation('flash', {
      frames: [1, 2, 3].map(n => ({
        sprite: `effect_crush_back0${n}.png`,
        x: 0, y: 0, width: 64, height: 64, duration: 1 / 24,
      })),
      loop: false,
    });
    sprite.playAnimation('flash');
    obj.addComponent(sprite);
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(3 / 24);
    obj.addComponent(lifetime);
  }

  /** Original spawnDust: stationary, five 24 FPS frames, removed after 0.3s. */
  private configureDust(obj: GameObject): void {
    obj.type = 'effect';
    obj.subType = 'dust';
    obj.team = Team.NONE;
    obj.width = obj.height = 32;
    obj.life = 1;
    obj.activationRadius = TIGHT_ACTIVATION_RADIUS;
    obj.destroyOnDeactivation = true;
    const sprite = new SpriteComponent();
    if (this.renderSystem) sprite.setRenderSystem(this.renderSystem);
    sprite.addAnimation('dust', {
      frames: [1, 2, 3, 4, 5].map(n => ({
        sprite: `dust0${n}.png`, x: 0, y: 0, width: 32, height: 32, duration: 1 / 24,
      })),
      loop: false,
    });
    sprite.playAnimation('dust');
    obj.addComponent(sprite);
    const lifetime = new LifetimeComponent();
    lifetime.setTimeUntilDeath(0.3);
    obj.addComponent(lifetime);
  }

  /** Spawn a dust puff at a Canvas-space top-left position. */
  spawnDust(x: number, y: number, flipHorizontal: boolean): GameObject | null {
    const dust = this.spawn(GameObjectType.DUST, x, y);
    if (dust) dust.facingDirection.x = flipHorizontal ? -1 : 1;
    return dust;
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
    // Android's Brobots and Snailbombs sleep off-camera instead of being discarded.
    obj.destroyOnDeactivation = false;
    attachEnemyCollisionResponse(obj);
    const lifetime = new LifetimeComponent();
    lifetime.setVulnerableToDeathTiles(true);
    // resolveEnemyDeath owns removal, effects and awards; this only detects hazards.
    obj.addComponent(lifetime);
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
      attachPossessedCollisionResponse(obj, swap);
      reaction.setPossessionComponent(swap);
      obj.addComponent(swap);
    }
  }

  /**
   * Configure Rokudou boss enemy
   * A flying boss that shoots energy balls and bullets
   */
  private configureEnemyRokudou(obj: GameObject): void {
    configureRokudou(obj, this.collisionSystem, this.renderSystem,
      GameObjectType.ENERGY_BALL, GameObjectType.TURRET_BULLET);
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

    // attachObjectSprite supplies the four energy-ball frames. ghost.png is
    // an unused android image, not the possession orb.
    // GhostComponent's acceleration is a steering rate, consumed by Movement.
    // PhysicsComponent would also add it as a constant down-right force.

    // Add movement component
    const movement = this.componentPools.movement.allocate();
    if (movement) {
      if (this.collisionSystem) movement.setCollisionSystem(this.collisionSystem);
      movement.setBounciness(0.6);
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
      movementSpeed: 2000,
      jumpImpulse: 250,
      acceleration: 700,
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

  /** Align the orb with Andou's sprite centre and feet, converting Y-up spawn placement. */
  spawnPlayerGhost(player: GameObject, gemCount: number): GameObject | null {
    const position = player.getPosition();
    return this.spawnGhost(position.x + player.width / 2 - 32,
      position.y + player.height - 64, gemCount);
  }

  /** Spawn an orb at a Y-down top-left position with gem-based duration. */
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
      ruby: GameObjectType.RUBY,
      pearl: GameObjectType.PEARL,
      diary: GameObjectType.DIARY,
      spring: GameObjectType.SPRING,
      door: GameObjectType.DOOR,
      door_red: GameObjectType.DOOR_RED,
      door_blue: GameObjectType.DOOR_BLUE,
      door_green: GameObjectType.DOOR_GREEN,
      door_red_nonblocking: GameObjectType.DOOR_RED_NONBLOCKING,
      door_blue_nonblocking: GameObjectType.DOOR_BLUE_NONBLOCKING,
      door_green_nonblocking: GameObjectType.DOOR_GREEN_NONBLOCKING,
      cannon: GameObjectType.CANNON,
      crusher: GameObjectType.CRUSHER,
      smoke: GameObjectType.SMOKE_POOF,
      gem: GameObjectType.GEM,
      breakable: GameObjectType.BREAKABLE_BLOCK,
      turret: GameObjectType.TURRET,
      ghost: GameObjectType.GHOST,
      platform: GameObjectType.MOVING_PLATFORM,
      button: GameObjectType.BUTTON,
      button_red: GameObjectType.BUTTON_RED,
      button_blue: GameObjectType.BUTTON_BLUE,
      button_green: GameObjectType.BUTTON_GREEN,
    };

    const type = typeMap[objectData.type];
    if (!type) return null;
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
}
