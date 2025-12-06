/**
 * LauncherComponent - Handles launching projectiles or player
 * Ported from: Original/src/com/replica/replicaisland/LauncherComponent.java
 *
 * Used for cannons, spring pads, and other launch mechanics
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import { GameObjectType } from '../GameObjectFactory';
import type { GameObject } from '../GameObject';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { Vector2 } from '../../utils/Vector2';

const DEFAULT_LAUNCH_DELAY = 2.0;
const DEFAULT_LAUNCH_MAGNITUDE = 2000.0;
const DEFAULT_POST_LAUNCH_DELAY = 1.0;

export interface LauncherConfig {
  angle?: number;
  magnitude?: number;
  launchDelay?: number;
  postLaunchDelay?: number;
  driveActions?: boolean;
  launchEffect?: GameObjectType;
  launchEffectOffsetX?: number;
  launchEffectOffsetY?: number;
  launchSound?: string;
}

export class LauncherComponent extends GameComponent {
  private shot: GameObject | null = null;
  private launchTime: number = 0;
  private angle: number = 0;
  private launchDelay: number = DEFAULT_LAUNCH_DELAY;
  private launchDirection: Vector2 = new Vector2();
  private launchMagnitude: number = DEFAULT_LAUNCH_MAGNITUDE;
  private postLaunchDelay: number = DEFAULT_POST_LAUNCH_DELAY;
  private driveActions: boolean = true;
  private launchEffect: GameObjectType = GameObjectType.INVALID;
  private launchEffectOffsetX: number = 0;
  private launchEffectOffsetY: number = 0;
  private launchSound: string | null = null;

  constructor(config?: LauncherConfig) {
    super(ComponentPhase.THINK);

    if (config) {
      if (config.angle !== undefined) this.angle = config.angle;
      if (config.magnitude !== undefined) this.launchMagnitude = config.magnitude;
      if (config.launchDelay !== undefined) this.launchDelay = config.launchDelay;
      if (config.postLaunchDelay !== undefined) this.postLaunchDelay = config.postLaunchDelay;
      if (config.driveActions !== undefined) this.driveActions = config.driveActions;
      if (config.launchEffect !== undefined) this.launchEffect = config.launchEffect;
      if (config.launchEffectOffsetX !== undefined) this.launchEffectOffsetX = config.launchEffectOffsetX;
      if (config.launchEffectOffsetY !== undefined) this.launchEffectOffsetY = config.launchEffectOffsetY;
      if (config.launchSound !== undefined) this.launchSound = config.launchSound;
    }
  }

  override reset(): void {
    this.shot = null;
    this.launchTime = 0;
    this.angle = 0;
    this.launchDelay = DEFAULT_LAUNCH_DELAY;
    this.launchMagnitude = DEFAULT_LAUNCH_MAGNITUDE;
    this.postLaunchDelay = DEFAULT_POST_LAUNCH_DELAY;
    this.driveActions = true;
    this.launchEffect = GameObjectType.INVALID;
    this.launchEffectOffsetX = 0;
    this.launchEffectOffsetY = 0;
    this.launchSound = null;
  }

  override update(_timeDelta: number, parent: object): void {
    const time = sSystemRegistry.timeSystem;
    if (!time) return;

    const gameTime = time.getGameTime();
    const parentObject = parent as GameObject;

    if (this.shot != null) {
      if (this.shot.life <= 0) {
        // Shot is dead, forget about it
        this.shot = null;
      } else {
        if (gameTime > this.launchTime) {
          // Fire!
          this.fire(this.shot, parentObject, this.angle);
          this.shot = null;

          if (this.driveActions) {
            parentObject.setCurrentAction(ActionType.ATTACK);
          }
        } else {
          // Keep shot at launcher position until fire time
          this.shot.setPosition(parentObject.getPosition());
        }
      }
    } else if (gameTime > this.launchTime + this.postLaunchDelay) {
      // Return to idle after post-launch delay
      if (this.driveActions) {
        parentObject.setCurrentAction(ActionType.IDLE);
      }
    }
  }

  /**
   * Prepare to launch an object
   */
  prepareToLaunch(object: GameObject, parentObject: GameObject): void {
    if (this.shot !== object) {
      if (this.shot != null) {
        // Already have a shot loaded - fire it first
        this.fire(this.shot, parentObject, this.angle);
      }

      const time = sSystemRegistry.timeSystem;
      if (time) {
        const gameTime = time.getGameTime();
        this.shot = object;
        this.launchTime = gameTime + this.launchDelay;
      }
    }
  }

  private fire(object: GameObject, parentObject: GameObject, angle: number): void {
    if (this.driveActions) {
      object.setCurrentAction(ActionType.MOVE);
    }

    // Calculate launch direction from angle
    this.launchDirection.set(Math.sin(angle), Math.cos(angle));
    this.launchDirection.multiplyVector(parentObject.facingDirection);
    this.launchDirection.multiply(this.launchMagnitude);

    object.setVelocity(this.launchDirection);

    // Play launch sound
    if (this.launchSound) {
      const sound = sSystemRegistry.soundSystem;
      if (sound) {
        sound.playSfx(this.launchSound);
      }
    }

    // Spawn launch effect
    if (this.launchEffect !== GameObjectType.INVALID) {
      const factory = sSystemRegistry.gameObjectFactory;
      const manager = sSystemRegistry.gameObjectManager;

      if (factory && manager) {
        const position = parentObject.getPosition();
        const effect = factory.spawn(
          this.launchEffect,
          position.x + this.launchEffectOffsetX * parentObject.facingDirection.x,
          position.y + this.launchEffectOffsetY * parentObject.facingDirection.y
        );

        if (effect) {
          manager.add(effect);
        }
      }
    }
  }

  /**
   * Setup launcher parameters
   */
  setup(
    angle: number,
    magnitude: number,
    launchDelay: number,
    postLaunchDelay: number,
    driveActions: boolean
  ): void {
    this.angle = angle;
    this.launchMagnitude = magnitude;
    this.launchDelay = launchDelay;
    this.postLaunchDelay = postLaunchDelay;
    this.driveActions = driveActions;
  }

  /**
   * Set launch effect parameters
   */
  setLaunchEffect(effectType: GameObjectType, offsetX: number, offsetY: number): void {
    this.launchEffect = effectType;
    this.launchEffectOffsetX = offsetX;
    this.launchEffectOffsetY = offsetY;
  }

  /**
   * Set launch sound
   */
  setLaunchSound(sound: string): void {
    this.launchSound = sound;
  }
}
