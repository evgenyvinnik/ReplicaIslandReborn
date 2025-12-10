/**
 * LaunchProjectileComponent - Spawns projectiles with configurable timing
 * Ported from: Original/src/com/replica/replicaisland/LaunchProjectileComponent.java
 *
 * Allows an object to spawn projectiles at specific intervals and apply velocity.
 * Used for turrets, enemies that shoot, etc.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import { GameObjectType } from '../GameObjectFactory';
import type { GameObject } from '../GameObject';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { Vector2 } from '../../utils/Vector2';

export interface LaunchProjectileConfig {
  objectTypeToSpawn?: GameObjectType;
  offsetX?: number;
  offsetY?: number;
  velocityX?: number;
  velocityY?: number;
  requiredAction?: ActionType;
  delayBetweenShots?: number;
  projectilesInSet?: number;
  delayBetweenSets?: number;
  setsPerActivation?: number;
  delayBeforeFirstSet?: number;
  thetaError?: number;
  shootSound?: string;
  trackProjectiles?: boolean;
  maxTrackedProjectiles?: number;
}

export class LaunchProjectileComponent extends GameComponent {
  private objectTypeToSpawn: GameObjectType = GameObjectType.INVALID;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private velocityX: number = 0;
  private velocityY: number = 0;
  private thetaError: number = 0;
  private requiredAction: ActionType = ActionType.INVALID;
  private delayBetweenShots: number = 0;
  private projectilesInSet: number = 0;
  private delayBetweenSets: number = 0;
  private setsPerActivation: number = -1;
  private delayBeforeFirstSet: number = 0;

  private lastProjectileTime: number = 0;
  private setStartedTime: number = -1;
  private launchedCount: number = 0;
  private setCount: number = 0;

  private trackProjectiles: boolean = false;
  private maxTrackedProjectiles: number = 0;
  private trackedProjectileCount: number = 0;

  private workingVector: Vector2 = new Vector2();
  private shootSound: string | null = null;

  constructor(config?: LaunchProjectileConfig) {
    super(ComponentPhase.POST_COLLISION);

    if (config) {
      if (config.objectTypeToSpawn !== undefined) this.objectTypeToSpawn = config.objectTypeToSpawn;
      if (config.offsetX !== undefined) this.offsetX = config.offsetX;
      if (config.offsetY !== undefined) this.offsetY = config.offsetY;
      if (config.velocityX !== undefined) this.velocityX = config.velocityX;
      if (config.velocityY !== undefined) this.velocityY = config.velocityY;
      if (config.requiredAction !== undefined) this.requiredAction = config.requiredAction;
      if (config.delayBetweenShots !== undefined) this.delayBetweenShots = config.delayBetweenShots;
      if (config.projectilesInSet !== undefined) this.projectilesInSet = config.projectilesInSet;
      if (config.delayBetweenSets !== undefined) this.delayBetweenSets = config.delayBetweenSets;
      if (config.setsPerActivation !== undefined) this.setsPerActivation = config.setsPerActivation;
      if (config.delayBeforeFirstSet !== undefined) this.delayBeforeFirstSet = config.delayBeforeFirstSet;
      if (config.thetaError !== undefined) this.thetaError = config.thetaError;
      if (config.shootSound !== undefined) this.shootSound = config.shootSound;
      if (config.trackProjectiles !== undefined) this.trackProjectiles = config.trackProjectiles;
      if (config.maxTrackedProjectiles !== undefined) this.maxTrackedProjectiles = config.maxTrackedProjectiles;
    }
  }

  override reset(): void {
    this.requiredAction = ActionType.INVALID;
    this.objectTypeToSpawn = GameObjectType.INVALID;
    this.offsetX = 0;
    this.offsetY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.delayBetweenShots = 0;
    this.projectilesInSet = 0;
    this.delayBetweenSets = 0;
    this.lastProjectileTime = 0;
    this.setStartedTime = -1;
    this.launchedCount = 0;
    this.setCount = 0;
    this.setsPerActivation = -1;
    this.delayBeforeFirstSet = 0;
    this.trackProjectiles = false;
    this.maxTrackedProjectiles = 0;
    this.trackedProjectileCount = 0;
    this.thetaError = 0;
    this.shootSound = null;
  }

  override update(_timeDelta: number, parent: object): void {
    const parentObject = parent as GameObject;

    const time = sSystemRegistry.timeSystem;
    if (!time) return;

    const gameTime = time.getGameTime();

    // Debug: Log when checking for launch
    if (parentObject.subType === 'wanda') {
      // console.log(`[LaunchProjectile] Wanda action=${parentObject.getCurrentAction()} required=${this.requiredAction} match=${parentObject.getCurrentAction() === this.requiredAction}`);
    }

    if (this.trackedProjectileCount < this.maxTrackedProjectiles || !this.trackProjectiles) {
      if (
        parentObject.getCurrentAction() === this.requiredAction ||
        this.requiredAction === ActionType.INVALID
      ) {
        if (this.setStartedTime === -1) {
          this.launchedCount = 0;
          this.lastProjectileTime = 0;
          this.setStartedTime = gameTime;
          if (parentObject.subType === 'wanda') {
            // console.log(`[LaunchProjectile] Wanda STARTING launch sequence at gameTime=${gameTime}`);
          }
        }

        const setDelay = this.setCount > 0 ? this.delayBetweenSets : this.delayBeforeFirstSet;

        if (
          gameTime - this.setStartedTime >= setDelay &&
          (this.setCount < this.setsPerActivation || this.setsPerActivation === -1)
        ) {
          // We can start shooting
          const timeSinceLastShot = gameTime - this.lastProjectileTime;

          if (timeSinceLastShot >= this.delayBetweenShots) {
            this.launch(parentObject);
            this.lastProjectileTime = gameTime;

            if (this.launchedCount >= this.projectilesInSet && this.projectilesInSet > 0) {
              this.setStartedTime = -1;
              this.setCount++;
            }
          }
        }
      } else {
        // Force the timer to restart when the right action is activated
        this.setStartedTime = -1;
        this.setCount = 0;
      }
    }
  }

  private launch(parentObject: GameObject): void {
    this.launchedCount++;

    const factory = sSystemRegistry.gameObjectFactory;
    const manager = sSystemRegistry.gameObjectManager;
    if (!factory || !manager) {
      // console.log(`[LaunchProjectile] FAILED: factory=${!!factory} manager=${!!manager}`);
      return;
    }

    let offsetX = this.offsetX;
    let offsetY = this.offsetY;
    let flip = false;

    if (parentObject.facingDirection.x < 0) {
      offsetX = parentObject.width - this.offsetX;
      flip = true;
    }

    if (parentObject.facingDirection.y < 0) {
      offsetY = parentObject.height - this.offsetY;
    }

    const x = parentObject.getPosition().x + offsetX;
    const y = parentObject.getPosition().y + offsetY;
    
    // console.log(`[LaunchProjectile] Launching ${this.objectTypeToSpawn} at (${x}, ${y}) flip=${flip}`);
    
    const object = factory.spawn(this.objectTypeToSpawn, x, y, flip);

    if (object) {
      // console.log(`[LaunchProjectile] Spawned object: type=${object.type} subType=${object.subType} team=${object.team}`);
      this.workingVector.set(1, 1);

      if (this.thetaError > 0) {
        const angle = Math.random() * this.thetaError * Math.PI * 2;
        this.workingVector.x = Math.sin(angle);
        this.workingVector.y = Math.cos(angle);

        if (this.workingVector.lengthSquared() < 0.001) {
          this.workingVector.set(1, 1);
        }
      }

      this.workingVector.x *= flip ? -this.velocityX : this.velocityX;
      this.workingVector.y *= this.velocityY;

      object.getVelocity().set(this.workingVector);
      object.getTargetVelocity().set(this.workingVector);

      // Center the projectile on the spawn point
      object.getPosition().x -= object.width / 2;
      object.getPosition().y -= object.height / 2;

      if (this.trackProjectiles) {
        this.trackedProjectileCount++;
        // Note: In the original, projectiles have LifetimeComponent that calls back
        // to trackedProjectileDestroyed. This needs a callback mechanism.
      }

      // NOTE: Object already added to manager by factory.spawn(), so don't add again
      // console.log(`[LaunchProjectile] Object spawned at pos(${object.getPosition().x}, ${object.getPosition().y}) vel(${object.getVelocity().x}, ${object.getVelocity().y})`);

      // Play shoot sound
      if (this.shootSound) {
        const sound = sSystemRegistry.soundSystem;
        if (sound) {
          sound.playSfx(this.shootSound);
        }
      }
    }
  }

  /**
   * Called when a tracked projectile is destroyed
   */
  trackedProjectileDestroyed(): void {
    if (this.trackedProjectileCount === this.maxTrackedProjectiles) {
      // Restart the set
      this.setStartedTime = -1;
      this.setCount = 0;
    }
    this.trackedProjectileCount--;
  }

  // Setters
  setObjectTypeToSpawn(type: GameObjectType): void {
    this.objectTypeToSpawn = type;
  }

  setOffsetX(offset: number): void {
    this.offsetX = offset;
  }

  setOffsetY(offset: number): void {
    this.offsetY = offset;
  }

  setVelocityX(velocity: number): void {
    this.velocityX = velocity;
  }

  setVelocityY(velocity: number): void {
    this.velocityY = velocity;
  }

  setRequiredAction(action: ActionType): void {
    this.requiredAction = action;
  }

  setDelayBetweenShots(delay: number): void {
    this.delayBetweenShots = delay;
  }

  setDelayBetweenSets(delay: number): void {
    this.delayBetweenSets = delay;
  }

  setDelayBeforeFirstSet(delay: number): void {
    this.delayBeforeFirstSet = delay;
  }

  setShotsPerSet(count: number): void {
    this.projectilesInSet = count;
  }

  setSetsPerActivation(count: number): void {
    this.setsPerActivation = count;
  }

  enableProjectileTracking(max: number): void {
    this.maxTrackedProjectiles = max;
    this.trackProjectiles = true;
  }

  disableProjectileTracking(): void {
    this.maxTrackedProjectiles = 0;
    this.trackProjectiles = false;
  }

  setThetaError(error: number): void {
    this.thetaError = error;
  }

  setShootSound(sound: string): void {
    this.shootSound = sound;
  }
}
