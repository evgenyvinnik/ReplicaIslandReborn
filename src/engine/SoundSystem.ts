/**
 * Sound System - Web Audio API wrapper for game audio
 * Ported from: Original/src/com/replica/replicaisland/SoundSystem.java
 * 
 * Note: The original game included bwv_115.mid (Bach's BWV 115 cantata) for background
 * music, but the playback was commented out in the source code. For the web port,
 * we need to convert the MIDI to OGG/MP3 format. Place the converted file at:
 * public/assets/sounds/music_background.ogg
 */

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

/**
 * Music track names
 */
export const MusicTracks = {
  // Background music - originally bwv_115.mid (Bach's BWV 115 cantata)
  // Convert the MIDI file to OGG/MP3 and place at public/assets/sounds/music_background.ogg
  BACKGROUND: 'music_background',
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
  musicVolume: number;
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
  isMusic: boolean;
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

  private currentMusicId: number = -1;
  private config: SoundConfig = {
    masterVolume: 1.0,
    sfxVolume: 1.0,
    musicVolume: 0.7,
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
      console.error('Failed to initialize audio context:', error);
    }
  }

  /**
   * Load a sound file
   */
  async loadSound(name: string, url: string): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    if (!this.audioContext) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.sounds.set(name, {
        buffer: audioBuffer,
        name,
      });
    } catch (error) {
      console.error(`Failed to load sound: ${name}`, error);
    }
  }

  /**
   * Play a sound effect
   */
  playSfx(name: string, volume: number = 1.0, loop: boolean = false): number {
    return this.playSound(name, volume, loop, false);
  }

  /**
   * Play background music
   */
  playMusic(name: string, volume: number = 1.0): number {
    // Stop current music if playing
    this.stopMusic();

    const id = this.playSound(name, volume, true, true);
    this.currentMusicId = id;
    return id;
  }

  /**
   * Stop background music
   */
  stopMusic(): void {
    if (this.currentMusicId >= 0) {
      this.stopSound(this.currentMusicId);
      this.currentMusicId = -1;
    }
  }

  /**
   * Play a sound
   */
  private playSound(
    name: string,
    volume: number,
    loop: boolean,
    isMusic: boolean
  ): number {
    if (!this.audioContext || !this.config.enabled) return -1;
    
    // Ensure gain nodes are initialized
    const targetGain = isMusic ? this.musicGain : this.sfxGain;
    if (!targetGain) {
      console.warn('Sound system not properly initialized - gain nodes missing');
      return -1;
    }

    const sound = this.sounds.get(name);
    if (!sound) {
      console.warn(`Sound not found: ${name}`);
      return -1;
    }

    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = sound.buffer;
      source.loop = loop;

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(targetGain);

      const id = this.nextSoundId++;
      this.playingSounds.set(id, {
        source,
        gainNode,
        name,
        isMusic,
        loop,
      });

      source.onended = (): void => {
        this.playingSounds.delete(id);
        if (isMusic && id === this.currentMusicId) {
          this.currentMusicId = -1;
        }
      };

      source.start(0);
      return id;
    } catch (error) {
      console.error('Failed to play sound:', name, error);
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
    this.playingSounds.forEach((sound, id) => {
      try {
        sound.source.stop();
      } catch {
        // Ignore
      }
      this.playingSounds.delete(id);
    });
    this.currentMusicId = -1;
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
   * Set music volume
   */
  setMusicVolume(volume: number): void {
    this.config.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Enable/disable sound
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
  }

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
    if (this.musicGain) {
      this.musicGain.gain.value = this.config.musicVolume;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopAll();
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
      this.loadSound(name, `/assets/sounds/${name}.ogg`).catch(err => {
        console.warn(`Failed to load sound ${name}:`, err);
      })
    );

    await Promise.all(loadPromises);
    
    // Try to load background music (optional - may not exist)
    await this.loadBackgroundMusic();
  }

  /**
   * Load background music (optional - fails gracefully if file doesn't exist)
   * 
   * The original game included bwv_115.mid (Bach's BWV 115 cantata).
   * To add background music:
   * 1. Convert the MIDI file to OGG format using a tool like Timidity
   * 2. Place the file at: public/assets/sounds/music_background.ogg
   */
  async loadBackgroundMusic(): Promise<void> {
    try {
      await this.loadSound('music_background', '/assets/sounds/music_background.ogg');
    } catch {
      // Music file is optional - game works fine without it
    }
  }

  /**
   * Start playing background music
   * @returns The music sound ID, or -1 if music couldn't be started
   */
  startBackgroundMusic(): number {
    if (!this.config.enabled) return -1;
    
    // Check if music is already playing
    if (this.currentMusicId >= 0) {
      return this.currentMusicId;
    }
    
    // Only play if the music file was loaded
    if (!this.isLoaded('music_background')) {
      return -1;
    }
    
    return this.playMusic('music_background', 0.6);
  }

  /**
   * Check if music is currently playing
   */
  isMusicPlaying(): boolean {
    return this.currentMusicId >= 0 && this.playingSounds.has(this.currentMusicId);
  }

  /**
   * Get music enabled setting
   */
  getMusicEnabled(): boolean {
    return this.config.enabled && this.config.musicVolume > 0;
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
