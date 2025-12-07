/**
 * Ghost Component - Handles ghost/possession mechanic
 * Ported from: Original/src/com/replica/replicaisland/GhostComponent.java
 *
 * The Ghost mechanic allows the player to control a floating ghost entity.
 * This is used in specific story moments where the player can possess enemies
 * or control a detached ghost form with different movement abilities.
 *
 * Features:
 * - Movement via stick/keyboard input
 * - Lifetime tracking with fade-out effect
 * - Camera target switching (follows ghost instead of player)
 * - Ambient sound loop during possession
 * - Action type switching on button press
 * - Configurable release delay and kill-on-release
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import type { SystemRegistry } from '../../engine/SystemRegistry';
import { SpriteComponent } from './SpriteComponent';
import { PlayerComponent } from './PlayerComponent';

// Global system registry reference (set by GameObjectFactory)
let sSystemRegistry: SystemRegistry | null = null;

export function setGhostSystemRegistry(registry: SystemRegistry): void {
  sSystemRegistry = registry;
}

export interface GhostConfig {
  /** Movement speed for the ghost */
  movementSpeed: number;
  /** Jump impulse when ghost touches ground */
  jumpImpulse: number;
  /** Acceleration for movement interpolation */
  acceleration: number;
  /** Whether to use orientation/tilt sensor for movement (mobile) */
  useOrientationSensor: boolean;
  /** Delay before player regains control after ghost release */
  delayOnRelease: number;
  /** Whether to kill the ghost object when released */
  killOnRelease: boolean;
  /** Default action type for the ghost */
  targetAction: ActionType;
  /** Ghost lifetime (0 = unlimited) */
  lifeTime: number;
  /** Whether button changes action instead of jump */
  changeActionOnButton: boolean;
  /** Action to use when button is pressed (if changeActionOnButton is true) */
  buttonPressedAction: ActionType;
  /** Ambient sound to play while ghost is active */
  ambientSound: string | null;
}

const DEFAULT_GHOST_CONFIG: GhostConfig = {
  movementSpeed: 200,
  jumpImpulse: 250,
  acceleration: 500,
  useOrientationSensor: false,
  delayOnRelease: 0.3,
  killOnRelease: false,
  targetAction: ActionType.MOVE,
  lifeTime: 0,
  changeActionOnButton: false,
  buttonPressedAction: ActionType.INVALID,
  ambientSound: null,
};

export class GhostComponent extends GameComponent {
  private config: GhostConfig;
  private lifeTimeRemaining: number = 0;
  private ambientSoundId: number = -1;
  private released: boolean = false;

  constructor(config?: Partial<GhostConfig>) {
    super(ComponentPhase.THINK);
    this.config = { ...DEFAULT_GHOST_CONFIG, ...config };
    this.lifeTimeRemaining = this.config.lifeTime;
  }

  /**
   * Configure the ghost component
   */
  configure(config: Partial<GhostConfig>): void {
    this.config = { ...this.config, ...config };
    this.lifeTimeRemaining = this.config.lifeTime;
  }

  /**
   * Set movement speed
   */
  setMovementSpeed(speed: number): void {
    this.config.movementSpeed = speed;
  }

  /**
   * Set jump impulse
   */
  setJumpImpulse(impulse: number): void {
    this.config.jumpImpulse = impulse;
  }

  /**
   * Set acceleration
   */
  setAcceleration(acceleration: number): void {
    this.config.acceleration = acceleration;
  }

  /**
   * Set whether to use orientation sensor
   */
  setUseOrientationSensor(use: boolean): void {
    this.config.useOrientationSensor = use;
  }

  /**
   * Set delay on release
   */
  setDelayOnRelease(delay: number): void {
    this.config.delayOnRelease = delay;
  }

  /**
   * Set kill on release
   */
  setKillOnRelease(kill: boolean): void {
    this.config.killOnRelease = kill;
  }

  /**
   * Set target action
   */
  setTargetAction(action: ActionType): void {
    this.config.targetAction = action;
  }

  /**
   * Set lifetime
   */
  setLifeTime(time: number): void {
    this.config.lifeTime = time;
    this.lifeTimeRemaining = time;
  }

  /**
   * Enable action change on button press
   */
  changeActionOnButton(pressedAction: ActionType): void {
    this.config.changeActionOnButton = true;
    this.config.buttonPressedAction = pressedAction;
  }

  /**
   * Set ambient sound
   */
  setAmbientSound(sound: string): void {
    this.config.ambientSound = sound;
  }

  /**
   * Update ghost behavior
   */
  update(deltaTime: number, parent: GameObject): void {
    if (this.released) return;

    let timeToRelease = false;

    const input = sSystemRegistry?.inputSystem;
    const camera = sSystemRegistry?.cameraSystem;
    const soundSystem = sSystemRegistry?.soundSystem;

    if (parent.life > 0) {
      // Update lifetime
      if (this.config.lifeTime > 0 && this.lifeTimeRemaining > 0) {
        this.lifeTimeRemaining -= deltaTime;

        if (this.lifeTimeRemaining <= 0) {
          timeToRelease = true;
        } else if (this.lifeTimeRemaining < 1.0) {
          // Fade out sprite as ghost expires
          const sprite = parent.getComponent(SpriteComponent);
          if (sprite) {
            sprite.setOpacity(this.lifeTimeRemaining);
          }
        }
      }

      // Check if ghost fell off screen
      if (parent.getPosition().y < -parent.height) {
        parent.life = 0;
        timeToRelease = true;
      }

      // Set ghost action
      parent.setCurrentAction(this.config.targetAction);

      // Make camera follow ghost
      if (camera) {
        camera.setTarget(parent);
      }

      // Handle input
      if (input) {
        const inputState = input.getInputState();
        const targetVelocity = parent.getTargetVelocity();
        const acceleration = parent.getAcceleration();

        if (this.config.useOrientationSensor) {
          // Use orientation sensor (tilt) for movement - both X and Y
          // Note: Web uses DeviceOrientation API, but for now use directional input
          let moveX = 0;
          let moveY = 0;

          if (inputState.left) moveX -= 1;
          if (inputState.right) moveX += 1;
          if (inputState.up) moveY -= 1;
          if (inputState.down) moveY += 1;

          targetVelocity.x = moveX * this.config.movementSpeed;
          targetVelocity.y = moveY * this.config.movementSpeed;
          acceleration.x = this.config.acceleration;
          acceleration.y = this.config.acceleration;
        } else {
          // Use directional pad for horizontal movement only
          let moveX = 0;
          if (inputState.left) moveX -= 1;
          if (inputState.right) moveX += 1;

          targetVelocity.x = moveX * this.config.movementSpeed;
          acceleration.x = this.config.acceleration;
        }

        // Update facing direction
        if (targetVelocity.x !== 0) {
          parent.facingDirection.x = targetVelocity.x > 0 ? 1 : -1;
        }

        // Handle jump button
        if (inputState.jump) {
          if (
            parent.touchingGround() &&
            parent.getVelocity().y <= 0 &&
            !this.config.changeActionOnButton
          ) {
            // Apply jump impulse
            parent.getImpulse().y = -this.config.jumpImpulse;
          } else if (this.config.changeActionOnButton) {
            // Change action on button press
            parent.setCurrentAction(this.config.buttonPressedAction);
          }
        }

        // Attack button releases ghost control
        if (inputState.attack) {
          timeToRelease = true;
        }
      }

      // Start ambient sound if not already playing
      if (!timeToRelease && this.config.ambientSound && this.ambientSoundId === -1) {
        if (soundSystem) {
          this.ambientSoundId = soundSystem.playSfx(this.config.ambientSound, 1.0, true);
        }
      }
    }

    // Stop ambient sound if ghost died
    if (parent.life <= 0) {
      this.stopAmbientSound();
    }

    // Release control
    if (timeToRelease) {
      this.releaseControl(parent);
    }
  }

  /**
   * Release control back to the player
   */
  releaseControl(parent: GameObject): void {
    if (this.released) return;
    this.released = true;

    const manager = sSystemRegistry?.gameObjectManager;
    const camera = sSystemRegistry?.cameraSystem;

    // Reset camera target
    if (camera) {
      camera.setTarget(null);
    }

    // Get player reference
    const player = manager?.getPlayer();

    if (player) {
      if (this.config.killOnRelease) {
        // Kill the ghost object
        parent.life = 0;
      } else {
        // TODO: Check for ChangeComponentsComponent to swap behaviors
        // const swap = parent.getComponent(ChangeComponentsComponent);
        // if (swap) {
        //   swap.activate(parent);
        // }
      }

      // Deactivate ghost mode on player
      const playerComponent = player.getComponent(
        PlayerComponent as unknown as new (...args: unknown[]) => PlayerComponent
      );
      if (playerComponent) {
        // Check if player is visible to camera
        const playerVisible = camera?.isVisible(
          player.getPosition().x,
          player.getPosition().y,
          player.width,
          player.height
        );

        if (playerVisible) {
          // @ts-expect-error - deactivateGhost may not exist yet
          playerComponent.deactivateGhost?.(0);
        } else {
          // @ts-expect-error - deactivateGhost may not exist yet
          playerComponent.deactivateGhost?.(this.config.delayOnRelease);
        }
      }
    }

    // Stop ambient sound
    this.stopAmbientSound();
  }

  /**
   * Stop the ambient sound
   */
  private stopAmbientSound(): void {
    if (this.ambientSoundId !== -1) {
      const soundSystem = sSystemRegistry?.soundSystem;
      if (soundSystem) {
        soundSystem.stopSound(this.ambientSoundId);
      }
      this.ambientSoundId = -1;
    }
  }

  /**
   * Check if ghost has been released
   */
  isReleased(): boolean {
    return this.released;
  }

  /**
   * Get remaining lifetime
   */
  getRemainingLifeTime(): number {
    return this.lifeTimeRemaining;
  }

  /**
   * Reset the component
   */
  reset(): void {
    this.lifeTimeRemaining = this.config.lifeTime;
    this.ambientSoundId = -1;
    this.released = false;
  }
}
