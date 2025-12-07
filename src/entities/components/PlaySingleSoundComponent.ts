/**
 * PlaySingleSoundComponent - Plays a sound once when the object is spawned
 * Ported from: Original/src/com/replica/replicaisland/PlaySingleSoundComponent.java
 * 
 * This component is useful for objects that should play a sound effect
 * when they appear, like explosions, power-ups, or certain enemy spawns.
 */

import { GameComponent } from '../GameComponent';
import { GameObject } from '../GameObject';
import { ComponentPhase } from '../../types';
import type { SoundSystem, SoundEffectName } from '../../engine/SoundSystem';

export class PlaySingleSoundComponent extends GameComponent {
  /** Sound name to play */
  private soundName: SoundEffectName | string | null = null;
  
  /** Sound system reference */
  private soundSystem: SoundSystem | null = null;
  
  /** Whether the sound has been played */
  private hasPlayed: boolean = false;
  
  /** Volume for the sound (0.0 to 1.0) */
  private volume: number = 1.0;
  
  /** Optional delay before playing (in seconds) */
  private delay: number = 0;
  
  /** Time accumulated for delay */
  private delayTimer: number = 0;

  constructor() {
    super(ComponentPhase.THINK);
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.soundName = null;
    this.hasPlayed = false;
    this.volume = 1.0;
    this.delay = 0;
    this.delayTimer = 0;
  }

  /**
   * Set the sound system reference
   */
  setSoundSystem(soundSystem: SoundSystem): void {
    this.soundSystem = soundSystem;
  }

  /**
   * Set the sound to play
   * @param soundName The sound name from SoundEffects
   */
  setSound(soundName: SoundEffectName | string): void {
    this.soundName = soundName;
  }

  /**
   * Set the volume for the sound
   * @param volume Volume level 0.0 to 1.0
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Set a delay before playing the sound
   * @param delay Delay in seconds
   */
  setDelay(delay: number): void {
    this.delay = Math.max(0, delay);
  }

  /**
   * Update - plays the sound once
   */
  update(deltaTime: number, _parent: GameObject): void {
    if (this.hasPlayed || !this.soundName || !this.soundSystem) {
      return;
    }

    // Handle delay if set
    if (this.delay > 0) {
      this.delayTimer += deltaTime;
      if (this.delayTimer < this.delay) {
        return;
      }
    }

    // Play the sound
    this.soundSystem.playSfx(this.soundName, this.volume);
    this.hasPlayed = true;
  }

  /**
   * Check if the sound has been played
   */
  hasSoundPlayed(): boolean {
    return this.hasPlayed;
  }

  /**
   * Force replay of the sound (resets played state)
   */
  replay(): void {
    this.hasPlayed = false;
    this.delayTimer = 0;
  }
}
