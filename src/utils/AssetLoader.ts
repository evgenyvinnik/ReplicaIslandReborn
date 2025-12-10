/**
 * Asset Loader - Handles loading of all game assets
 * Manages sprites, audio, and level data
 */

import type { AssetManifest, SpriteAsset, AudioAsset } from '../types';
import type { RenderSystem } from '../engine/RenderSystem';
import type { SoundSystem } from '../engine/SoundSystem';
import { assetPath } from './helpers';

export interface LoadProgress {
  loaded: number;
  total: number;
  currentAsset: string;
  percent: number;
}

export type ProgressCallback = (progress: LoadProgress) => void;

export class AssetLoader {
  private renderSystem: RenderSystem | null = null;
  private soundSystem: SoundSystem | null = null;
  private loadedAssets: Set<string> = new Set();
  private manifest: AssetManifest | null = null;

  /**
   * Set systems for loading assets into
   */
  setSystems(render: RenderSystem, sound: SoundSystem): void {
    this.renderSystem = render;
    this.soundSystem = sound;
  }

  /**
   * Load the asset manifest
   */
  async loadManifest(url: string = assetPath('/assets/manifest.json')): Promise<AssetManifest> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.status}`);
    }
    this.manifest = await response.json();
    return this.manifest!;
  }

  /**
   * Load all assets from manifest
   */
  async loadAll(progressCallback?: ProgressCallback): Promise<void> {
    if (!this.manifest) {
      throw new Error('No manifest loaded. Call loadManifest first.');
    }

    const totalAssets =
      this.manifest.sprites.length +
      this.manifest.audio.length;

    let loadedCount = 0;

    const updateProgress = (assetName: string): void => {
      loadedCount++;
      if (progressCallback) {
        progressCallback({
          loaded: loadedCount,
          total: totalAssets,
          currentAsset: assetName,
          percent: (loadedCount / totalAssets) * 100,
        });
      }
    };

    // Load sprites
    for (const sprite of this.manifest.sprites) {
      await this.loadSprite(sprite);
      updateProgress(sprite.name);
    }

    // Load audio
    for (const audio of this.manifest.audio) {
      await this.loadAudio(audio);
      updateProgress(audio.name);
    }
  }

  /**
   * Load a single sprite
   */
  async loadSprite(sprite: SpriteAsset): Promise<void> {
    if (!this.renderSystem) {
      throw new Error('Render system not set');
    }

    if (this.loadedAssets.has(`sprite:${sprite.name}`)) {
      return;
    }

    // Default frame size - can be overridden in manifest
    const frameWidth = 64;
    const frameHeight = 64;

    await this.renderSystem.loadSprite(
      sprite.name,
      assetPath(sprite.path),
      frameWidth,
      frameHeight
    );

    this.loadedAssets.add(`sprite:${sprite.name}`);
  }

  /**
   * Load a single audio file
   */
  async loadAudio(audio: AudioAsset): Promise<void> {
    if (!this.soundSystem) {
      throw new Error('Sound system not set');
    }

    if (this.loadedAssets.has(`audio:${audio.name}`)) {
      return;
    }

    await this.soundSystem.loadSound(audio.name, assetPath(audio.path));
    this.loadedAssets.add(`audio:${audio.name}`);
  }

  /**
   * Load a sprite sheet with specific dimensions
   */
  async loadSpriteSheet(
    name: string,
    url: string,
    frameWidth: number,
    frameHeight: number
  ): Promise<void> {
    if (!this.renderSystem) {
      throw new Error('Render system not set');
    }

    await this.renderSystem.loadSprite(name, url, frameWidth, frameHeight);
    this.loadedAssets.add(`sprite:${name}`);
  }

  /**
   * Load a level
   */
  async loadLevel(levelFile: string): Promise<unknown> {
    const response = await fetch(assetPath(`/assets/levels/${levelFile}.json`));
    if (!response.ok) {
      throw new Error(`Failed to load level: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Check if an asset is loaded
   */
  isLoaded(type: 'sprite' | 'audio', name: string): boolean {
    return this.loadedAssets.has(`${type}:${name}`);
  }

  /**
   * Preload essential game assets
   */
  async preloadEssentials(progressCallback?: ProgressCallback): Promise<void> {
    // Define essential assets that must be loaded first
    const essentialSprites: SpriteAsset[] = [
      { name: 'player', path: assetPath('/assets/sprites/player.png') },
      { name: 'tileset', path: assetPath('/assets/sprites/tileset.png') },
    ];

    const essentialAudio: AudioAsset[] = [
      { name: 'jump', path: assetPath('/assets/audio/jump.mp3'), type: 'sfx' },
      { name: 'collect', path: assetPath('/assets/audio/collect.mp3'), type: 'sfx' },
    ];

    const total = essentialSprites.length + essentialAudio.length;
    let loaded = 0;

    for (const sprite of essentialSprites) {
      try {
        await this.loadSprite(sprite);
      } catch {
        // console.log(`Failed to load essential sprite: ${sprite.name}`);
      }
      loaded++;
      progressCallback?.({
        loaded,
        total,
        currentAsset: sprite.name,
        percent: (loaded / total) * 100,
      });
    }

    for (const audio of essentialAudio) {
      try {
        await this.loadAudio(audio);
      } catch {
        // console.log(`Failed to load essential audio: ${audio.name}`);
      }
      loaded++;
      progressCallback?.({
        loaded,
        total,
        currentAsset: audio.name,
        percent: (loaded / total) * 100,
      });
    }
  }

  /**
   * Get loaded asset count
   */
  getLoadedCount(): number {
    return this.loadedAssets.size;
  }

  /**
   * Clear all loaded assets
   */
  clear(): void {
    this.loadedAssets.clear();
  }
}
