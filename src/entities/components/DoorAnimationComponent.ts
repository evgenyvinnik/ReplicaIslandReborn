/**
 * DoorAnimationComponent - Handles door open/close animations
 * Ported from: Original/src/com/replica/replicaisland/DoorAnimationComponent.java
 *
 * Manages door states: closed, opening, open, closing
 * Triggered by channel system (usually connected to buttons)
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import { SpriteComponent } from './SpriteComponent';
import { SolidSurfaceComponent } from './SolidSurfaceComponent';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import type { Channel, ChannelFloatValue } from '../../engine/ChannelSystem';

/**
 * Door Animation indices
 */
export const enum DoorAnimation {
  CLOSED = 0,
  OPEN = 1,
  CLOSING = 2,
  OPENING = 3,
}

/**
 * Door states
 */
const enum DoorState {
  CLOSED = 0,
  OPEN = 1,
  CLOSING = 2,
  OPENING = 3,
}

const DEFAULT_STAY_OPEN_TIME = 5.0;

export interface DoorAnimationConfig {
  channel?: Channel;
  stayOpenTime?: number;
  openSound?: string;
  closeSound?: string;
}

export class DoorAnimationComponent extends GameComponent {
  private sprite: SpriteComponent | null = null;
  private state: DoorState = DoorState.CLOSED;
  private channel: Channel | null = null;
  private stayOpenTime: number = DEFAULT_STAY_OPEN_TIME;
  private openSound: string | null = null;
  private closeSound: string | null = null;
  private solidSurface: SolidSurfaceComponent | null = null; // Reference to solid surface for collision
  private solidSurfaceEnabled: boolean = true; // Track if collision is enabled

  constructor(config?: DoorAnimationConfig) {
    super(ComponentPhase.ANIMATION);

    if (config) {
      if (config.channel) this.channel = config.channel;
      if (config.stayOpenTime !== undefined) this.stayOpenTime = config.stayOpenTime;
      if (config.openSound) this.openSound = config.openSound;
      if (config.closeSound) this.closeSound = config.closeSound;
    }
  }

  override reset(): void {
    this.sprite = null;
    this.state = DoorState.CLOSED;
    this.channel = null;
    this.stayOpenTime = DEFAULT_STAY_OPEN_TIME;
    this.openSound = null;
    this.closeSound = null;
    this.solidSurface = null;
    this.solidSurfaceEnabled = true;
  }

  private open(timeSinceTriggered: number, parentObject: GameObject): void {
    if (!this.sprite) return;

    const openAnimation = this.sprite.findAnimation(DoorAnimation.OPENING);
    if (!openAnimation) return;

    const openAnimationLength = this.getAnimationLength(DoorAnimation.OPENING);

    if (timeSinceTriggered > openAnimationLength) {
      // Snap to open
      this.sprite.playAnimation(DoorAnimation.OPEN);
      this.state = DoorState.OPEN;
      this.solidSurfaceEnabled = false;
      // Remove solid surface when door is open
      if (this.solidSurface) {
        parentObject.removeComponent(this.solidSurface);
      }
    } else {
      let timeOffset = timeSinceTriggered;

      if (this.state === DoorState.CLOSING) {
        // Reverse direction mid-animation
        timeOffset = openAnimationLength - this.sprite.getCurrentAnimationTime();
      } else {
        this.solidSurfaceEnabled = false;
        // Remove solid surface when door starts opening
        if (this.solidSurface) {
          parentObject.removeComponent(this.solidSurface);
        }
      }

      this.state = DoorState.OPENING;
      this.sprite.playAnimation(DoorAnimation.OPENING);
      this.sprite.setCurrentAnimationTime(timeOffset);

      // Play open sound
      if (this.openSound) {
        const sound = sSystemRegistry.soundSystem;
        if (sound) {
          sound.playSfx(this.openSound);
        }
      }
    }
  }

  private close(timeSinceTriggered: number, parentObject: GameObject): void {
    if (!this.sprite) return;

    const closeAnimationLength = this.getAnimationLength(DoorAnimation.CLOSING);

    if (timeSinceTriggered > this.stayOpenTime + closeAnimationLength) {
      // Snap to closed
      this.sprite.playAnimation(DoorAnimation.CLOSED);
      this.state = DoorState.CLOSED;
      this.solidSurfaceEnabled = true;
      // Add solid surface back when door is closed
      if (this.solidSurface && !parentObject.hasComponent(this.solidSurface)) {
        parentObject.addComponent(this.solidSurface);
      }
    } else {
      let timeOffset = timeSinceTriggered - this.stayOpenTime;

      if (this.state === DoorState.OPENING) {
        // Reverse direction mid-animation
        timeOffset = closeAnimationLength - this.sprite.getCurrentAnimationTime();
      }

      this.state = DoorState.CLOSING;
      this.sprite.playAnimation(DoorAnimation.CLOSING);
      this.sprite.setCurrentAnimationTime(timeOffset);

      // Play close sound
      if (this.closeSound) {
        const sound = sSystemRegistry.soundSystem;
        if (sound) {
          sound.playSfx(this.closeSound);
        }
      }
    }
  }

  private getAnimationLength(animationIndex: number): number {
    const animation = this.sprite?.findAnimation(animationIndex);
    if (!animation) return 1.0;

    return animation.frames.reduce((sum, frame) => sum + (frame.duration || 0.1), 0);
  }

  override update(_timeDelta: number, parent: object): void {
    if (!this.sprite) {
      // Try to find sprite component
      const gameObject = parent as GameObject;
      this.sprite = gameObject.getComponent(SpriteComponent);
      if (!this.sprite) return;
    }

    const parentObject = parent as GameObject;

    // Check channel for trigger
    if (this.channel?.value) {
      const channelValue = this.channel.value as ChannelFloatValue;
      const lastPressedTime = channelValue.value;

      const time = sSystemRegistry.timeSystem;
      if (time) {
        const gameTime = time.getGameTime();
        const delta = gameTime - lastPressedTime;
        
        // Debug log occasionally
        if (Math.random() < 0.01) {
          // console.log(`[DoorAnimationComponent] Channel ${this.channel.name}, delta=${delta.toFixed(2)}, state=${this.state}, stayOpenTime=${this.stayOpenTime}`);
        }

        if (delta < this.stayOpenTime && (this.state === DoorState.CLOSED || this.state === DoorState.CLOSING)) {
          // console.log(`[DoorAnimationComponent] Opening door! Channel: ${this.channel.name}`);
          this.open(delta, parentObject);
        } else if (
          delta > this.stayOpenTime &&
          (this.state === DoorState.OPEN || this.state === DoorState.OPENING)
        ) {
          this.close(delta, parentObject);
        }
      }
    }

    // Handle animation state transitions
    if (this.state === DoorState.OPENING && this.sprite.animationFinished()) {
      this.sprite.playAnimation(DoorAnimation.OPEN);
      this.state = DoorState.OPEN;
    } else if (this.state === DoorState.CLOSING && this.sprite.animationFinished()) {
      this.sprite.playAnimation(DoorAnimation.CLOSED);
      this.state = DoorState.CLOSED;
      this.solidSurfaceEnabled = true;
    }

    // Handle out-of-sync animation/state
    if (this.sprite.getCurrentAnimationIndex() === DoorAnimation.OPENING && this.state === DoorState.CLOSED) {
      this.sprite.playAnimation(DoorAnimation.CLOSING);
      this.state = DoorState.CLOSING;
    }
  }

  /**
   * Check if the door's solid surface is enabled (for collision)
   */
  isSolidSurfaceEnabled(): boolean {
    return this.solidSurfaceEnabled;
  }

  /**
   * Get the current door state for rendering
   */
  getCurrentState(): number {
    return this.state;
  }

  /**
   * Get current animation time from sprite
   */
  getCurrentAnimationTime(): number {
    return this.sprite?.getCurrentAnimationTime() ?? 0;
  }

  // Setters
  setSprite(sprite: SpriteComponent): void {
    this.sprite = sprite;
  }

  setChannel(channel: Channel): void {
    this.channel = channel;
  }

  setStayOpenTime(time: number): void {
    this.stayOpenTime = time;
  }

  setSounds(openSound: string, closeSound: string): void {
    this.openSound = openSound;
    this.closeSound = closeSound;
  }

  setSolidSurface(solidSurface: SolidSurfaceComponent): void {
    this.solidSurface = solidSurface;
  }
}
