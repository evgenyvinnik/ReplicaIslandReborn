/**
 * ButtonAnimationComponent - Handles button press animations
 * Ported from: Original/src/com/replica/replicaisland/ButtonAnimationComponent.java
 *
 * Manages button up/down states when depressed by player stomp
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType, HitType } from '../../types';
import type { GameObject } from '../GameObject';
import { SpriteComponent } from './SpriteComponent';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import type { Channel, ChannelFloatValue } from '../../engine/ChannelSystem';

/**
 * Button Animation states
 */
export const enum ButtonAnimation {
  UP = 0,
  DOWN = 1,
}

export interface ButtonAnimationConfig {
  channel?: Channel;
  depressSound?: string;
}

export class ButtonAnimationComponent extends GameComponent {
  private sprite: SpriteComponent | null = null;
  private channel: Channel | null = null;
  private lastPressedTime: ChannelFloatValue = { value: 0 };
  private depressSound: string | null = null;

  constructor(config?: ButtonAnimationConfig) {
    super(ComponentPhase.ANIMATION);

    if (config) {
      if (config.channel) this.channel = config.channel;
      if (config.depressSound) this.depressSound = config.depressSound;
    }
  }

  override reset(): void {
    this.sprite = null;
    this.channel = null;
    this.lastPressedTime.value = 0;
    this.depressSound = null;
  }

  override update(_timeDelta: number, parent: object): void {
    if (!this.sprite) {
      // Try to find sprite component
      const gameObject = parent as GameObject;
      this.sprite = gameObject.getComponent(SpriteComponent);
      if (!this.sprite) return;
    }

    const parentObject = parent as GameObject;

    if (
      parentObject.getCurrentAction() === ActionType.HIT_REACT &&
      parentObject.lastReceivedHitType === HitType.DEPRESS
    ) {
      // Button is being pressed
      if (this.sprite.getCurrentAnimationIndex() === ButtonAnimation.UP) {
        // Play depress sound
        const sound = sSystemRegistry.soundSystem;
        if (sound && this.depressSound) {
          sound.playSfx(this.depressSound);
        }
        // console.log(`[ButtonAnimationComponent] Button pressed! Channel: ${this.channel?.name}`);
      }

      this.sprite.playAnimation(ButtonAnimation.DOWN);
      parentObject.setCurrentAction(ActionType.IDLE);

      // Notify channel of press time
      if (this.channel) {
        const time = sSystemRegistry.timeSystem;
        if (time) {
          this.lastPressedTime.value = time.getGameTime();
          this.channel.value = this.lastPressedTime;
          // Debug log occasionally
          if (Math.random() < 0.02) {
            // console.log(`[ButtonAnimationComponent] Channel ${this.channel.name} updated to time ${this.lastPressedTime.value}`);
          }
        }
      } else {
        // console.warn('[ButtonAnimationComponent] Button has no channel!');
      }
    } else {
      // Button is not being pressed - return to UP state
      this.sprite.playAnimation(ButtonAnimation.UP);
    }
  }

  // Setters
  setSprite(sprite: SpriteComponent): void {
    this.sprite = sprite;
  }

  setChannel(channel: Channel): void {
    this.channel = channel;
  }

  setDepressSound(sound: string): void {
    this.depressSound = sound;
  }
}
