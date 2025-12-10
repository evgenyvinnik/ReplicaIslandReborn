/**
 * Sound System - Web Audio API wrapper for game sound effects
 * Ported from: Original/src/com/replica/replicaisland/SoundSystem.java
 */

import { assetPath } from '../utils/helpers';

/**
 * Sound effect names mapping
 */
export const SoundEffects = {
  // UI
  BUTTON: 'sound_button',
  
  // Player
  STOMP: 'sound_stomp',
  POING: 'sound_poing',      // Bounce/spring
  POSSESSION: 'sound_possession',
  
  // Collectibles
  GEM1: 'gem1',
  GEM2: 'gem2',
  GEM3: 'gem3',
  DING: 'ding',
  
  // Combat
  GUN: 'sound_gun',
  CANNON: 'sound_cannon',
  EXPLODE: 'sound_explode',
  QUICK_EXPLOSION: 'quick_explosion',
  
  // Enemies
  KABOCHA_HIT: 'sound_kabocha_hit',
  ROKUDOU_HIT: 'sound_rokudou_hit',
  BUZZ: 'sound_buzz',
  
  // Environment
  BREAK_BLOCK: 'sound_break_block',
  DOOR_OPEN: 'sound_open',
  DOOR_CLOSE: 'sound_close',
  DEEP_CLANG: 'deep_clang',
  HARD_THUMP: 'hard_thump',
  THUMP: 'thump',
  ROCKETS: 'rockets',
} as const;

export type SoundEffectName = typeof SoundEffects[keyof typeof SoundEffects];

/**
 * Sound priorities
 */
export const SoundPriority = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
} as const;

export interface SoundConfig {
  masterVolume: number;
  sfxVolume: number;
  enabled: boolean;
}

interface LoadedSound {
  buffer: AudioBuffer;
  name: string;
}

interface PlayingSound {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  name: string;
  loop: boolean;
}

export class SoundSystem {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private sounds: Map<string, LoadedSound> = new Map();
  private playingSounds: Map<number, PlayingSound> = new Map();
  private nextSoundId: number = 0;

  // Background music
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicPlaying: boolean = false;
  private musicVolume: number = 0.5;

  private config: SoundConfig = {
    masterVolume: 1.0,
    sfxVolume: 1.0,
    enabled: true,
  };

  private initialized: boolean = false;
  private suspended: boolean = false;

  constructor() {
    // Audio context is created on first user interaction
  }

  /**
   * Initialize the audio context (must be called after user interaction)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.audioContext = new AudioContext();

      // Create gain nodes
      this.masterGain = this.audioContext.createGain();
      this.sfxGain = this.audioContext.createGain();
      this.musicGain = this.audioContext.createGain();

      // Connect: source -> sfx/music gain -> master gain -> destination
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);

      // Apply initial volumes
      this.updateVolumes();

      this.initialized = true;

      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      // console.error('Failed to initialize audio context:', error);
    }
  }

  /**
   * Load a sound file
   */
  async loadSound(name: string, url: string, optional: boolean = false): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    if (!this.audioContext) return;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (optional) {
          // Silently skip optional sounds that don't exist
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Check content type to avoid trying to decode HTML error pages
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('audio') && !contentType.includes('octet-stream')) {
        if (optional) {
          // Silently skip - likely got an HTML error page
          return;
        }
        throw new Error(`Invalid content type: ${contentType}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Check if we got actual audio data (at least a few bytes)
      if (arrayBuffer.byteLength < 100) {
        if (optional) {
          return;
        }
        throw new Error('Audio file too small or empty');
      }
      
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.sounds.set(name, {
        buffer: audioBuffer,
        name,
      });
    } catch (error) {
      // Only log errors for required sounds, not optional ones
      if (!optional) {
        // console.error(`Failed to load sound: ${name}`, error);
      }
      // Optional sounds fail silently - no console spam
    }
  }

  /**
   * Play a sound effect
   */
  playSfx(name: string, volume: number = 1.0, loop: boolean = false): number {
    if (!this.audioContext || !this.config.enabled) return -1;
    if (this.audioContext.state === 'closed') return -1;

    // Limit concurrent sounds to prevent browser crash
    if (this.playingSounds.size > 32) {
      return -1;
    }
    
    // Ensure gain nodes are initialized
    if (!this.sfxGain) {
      // console.log('Sound system not properly initialized - gain nodes missing');
      return -1;
    }

    const sound = this.sounds.get(name);
    if (!sound) {
      // console.log(`Sound not found: ${name}`);
      return -1;
    }

    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = sound.buffer;
      source.loop = loop;

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(this.sfxGain);

      const id = this.nextSoundId++;
      this.playingSounds.set(id, {
        source,
        gainNode,
        name,
        loop,
      });

      source.onended = (): void => {
        this.playingSounds.delete(id);
      };

      source.start(0);
      return id;
    } catch (error) {
      // console.error('Failed to play sound:', name, error);
      return -1;
    }
  }

  /**
   * Stop a specific sound
   */
  stopSound(id: number): void {
    const sound = this.playingSounds.get(id);
    if (sound) {
      try {
        sound.source.stop();
      } catch {
        // Ignore if already stopped
      }
      this.playingSounds.delete(id);
    }
  }

  /**
   * Stop all sounds
   */
  stopAll(): void {
    this.playingSounds.forEach((sound) => {
      try {
        sound.source.stop();
      } catch {
        // Ignore
      }
    });
    this.playingSounds.clear();
  }

  /**
   * Pause all sounds
   */
  pauseAll(): void {
    if (this.audioContext && !this.suspended) {
      this.audioContext.suspend();
      this.suspended = true;
    }
  }

  /**
   * Resume all sounds
   */
  resumeAll(): void {
    if (this.audioContext && this.suspended) {
      this.audioContext.resume();
      this.suspended = false;
    }
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Set SFX volume
   */
  setSfxVolume(volume: number): void {
    this.config.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Enable/disable sound
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.stopAll();
      this.stopBackgroundMusic();
    }
  }

  // ==========================================
  // Background Music Methods
  // ==========================================

  /**
   * Load background music
   */
  async loadBackgroundMusic(url: string): Promise<boolean> {
    if (!this.audioContext) {
      await this.initialize();
    }

    if (!this.audioContext) return false;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        // console.log(`Background music not found: ${url}`);
        return false;
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('audio') && !contentType.includes('octet-stream')) {
        // console.log(`Invalid content type for music: ${contentType}`);
        return false;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength < 100) {
        // console.log('Music file too small or empty');
        return false;
      }
      
      this.musicBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return true;
    } catch (error) {
      // console.log('Failed to load background music:', error);
      return false;
    }
  }

  /**
   * Start playing background music (loops)
   */
  startBackgroundMusic(): void {
    if (!this.audioContext || !this.musicBuffer || !this.musicGain || !this.config.enabled) {
      return;
    }

    // Stop existing music if playing
    this.stopBackgroundMusic();

    this.musicSource = this.audioContext.createBufferSource();
    this.musicSource.buffer = this.musicBuffer;
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicGain);
    this.musicSource.start();
    this.musicPlaying = true;
  }

  /**
   * Stop background music
   */
  stopBackgroundMusic(): void {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        // Ignore if already stopped
      }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
    this.musicPlaying = false;
  }

  /**
   * Pause background music (with fade)
   */
  pauseBackgroundMusic(): void {
    if (this.musicGain && this.audioContext && this.musicPlaying) {
      this.musicGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
    }
  }

  /**
   * Resume background music (with fade)
   */
  resumeBackgroundMusic(): void {
    if (this.musicGain && this.audioContext && this.musicPlaying) {
      this.musicGain.gain.linearRampToValueAtTime(this.musicVolume, this.audioContext.currentTime + 0.3);
    }
  }

  /**
   * Set background music volume (0.0 to 1.0)
   */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicVolume;
    }
  }

  /**
   * Get music volume
   */
  getMusicVolume(): number {
    return this.musicVolume;
  }

  /**
   * Check if music is playing
   */
  isMusicPlaying(): boolean {
    return this.musicPlaying;
  }

  /**
   * Check if background music is loaded
   */
  isMusicLoaded(): boolean {
    return this.musicBuffer !== null;
  }

  // ==========================================
  // End Background Music Methods
  // ==========================================

  /**
   * Get current config
   */
  getConfig(): SoundConfig {
    return { ...this.config };
  }

  /**
   * Check if a sound is loaded
   */
  isLoaded(name: string): boolean {
    return this.sounds.has(name);
  }

  /**
   * Check if sound system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  private updateVolumes(): void {
    if (this.masterGain) {
      this.masterGain.gain.value = this.config.masterVolume;
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.config.sfxVolume;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopAll();
    this.stopBackgroundMusic();
    this.musicBuffer = null;
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.sounds.clear();
    this.initialized = false;
  }

  /**
   * Preload all game sounds
   */
  async preloadAllSounds(): Promise<void> {
    const soundFiles = [
      'deep_clang',
      'ding',
      'gem1',
      'gem2',
      'gem3',
      'hard_thump',
      'quick_explosion',
      'rockets',
      'sound_break_block',
      'sound_button',
      'sound_buzz',
      'sound_cannon',
      'sound_close',
      'sound_explode',
      'sound_gun',
      'sound_kabocha_hit',
      'sound_open',
      'sound_poing',
      'sound_possession',
      'sound_rokudou_hit',
      'sound_stomp',
      'thump',
    ];

    const loadPromises = soundFiles.map(name =>
      this.loadSound(name, assetPath(`/assets/sounds/${name}.ogg`)).catch(err => {
        // console.log(`Failed to load sound ${name}:`, err);
      })
    );

    await Promise.all(loadPromises);
    
    // Try to load background music (optional - will fail silently if not available)
    // The original game uses bwv_115.mid (Bach's Cantata BWV 115)
    // For web, we need an OGG version. Place it at /assets/sounds/music.ogg
    await this.loadBackgroundMusic(assetPath('/assets/sounds/music.ogg'));
  }

  /**
   * Pause a specific sound by ID
   */
  pause(soundId: number): void {
    // Web Audio API doesn't support pause directly on BufferSourceNode
    // We would need to track position and recreate, which is complex
    // For now, just stop the sound
    const sound = this.playingSounds.get(soundId);
    if (sound && this.audioContext) {
      // Fade out quickly instead of abrupt stop
      sound.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);
    }
  }

  /**
   * Resume a specific sound by ID
   */
  resume(soundId: number): void {
    // Since we can't truly pause/resume, this is a no-op
    // The sound would need to be replayed
    const sound = this.playingSounds.get(soundId);
    if (sound && this.audioContext) {
      sound.gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.1);
    }
  }

  /**
   * Check if sound is enabled
   */
  getSoundEnabled(): boolean {
    return this.config.enabled;
  }
}

// Export singleton instance
export const soundSystem = new SoundSystem();
