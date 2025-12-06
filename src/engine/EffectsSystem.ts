/**
 * Effects System - Manages visual effects like explosions, smoke, dust
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 * 
 * Effects are short-lived animated objects that don't interact with gameplay.
 */

import type { RenderSystem } from './RenderSystem';
import type { SoundSystem } from './SoundSystem';

/**
 * Types of visual effects
 */
export enum EffectType {
  EXPLOSION_SMALL = 'explosion_small',
  EXPLOSION_LARGE = 'explosion_large',
  EXPLOSION_GIANT = 'explosion_giant',
  SMOKE_BIG = 'smoke_big',
  SMOKE_SMALL = 'smoke_small',
  CRUSH_FLASH = 'crush_flash',
  DUST = 'dust',
}

/**
 * Effect animation configuration
 */
interface EffectConfig {
  type: EffectType;
  frames: string[];
  frameDuration: number;
  width: number;
  height: number;
  loop: boolean;
  sound?: string;
  hasAttackVolume?: boolean;
}

/**
 * Active effect instance
 */
interface ActiveEffect {
  type: EffectType;
  x: number;
  y: number;
  frameIndex: number;
  frameTimer: number;
  config: EffectConfig;
  alive: boolean;
  velocityX?: number;
  velocityY?: number;
  gravity?: number;
}

/**
 * Pre-configured effect definitions
 */
const EFFECT_CONFIGS: Record<EffectType, EffectConfig> = {
  [EffectType.EXPLOSION_SMALL]: {
    type: EffectType.EXPLOSION_SMALL,
    frames: [
      'effect_explosion_small01.png',
      'effect_explosion_small02.png',
      'effect_explosion_small03.png',
      'effect_explosion_small04.png',
      'effect_explosion_small05.png',
      'effect_explosion_small06.png',
      'effect_explosion_small07.png',
    ],
    frameDuration: 1 / 24, // 24fps
    width: 32,
    height: 32,
    loop: false,
    sound: 'quick_explosion',
    hasAttackVolume: true,
  },
  [EffectType.EXPLOSION_LARGE]: {
    type: EffectType.EXPLOSION_LARGE,
    frames: [
      'effect_explosion_big01.png',
      'effect_explosion_big02.png',
      'effect_explosion_big03.png',
      'effect_explosion_big04.png',
      'effect_explosion_big05.png',
      'effect_explosion_big06.png',
      'effect_explosion_big07.png',
      'effect_explosion_big08.png',
      'effect_explosion_big09.png',
    ],
    frameDuration: 1 / 24,
    width: 64,
    height: 64,
    loop: false,
    sound: 'sound_explode',
    hasAttackVolume: true,
  },
  [EffectType.EXPLOSION_GIANT]: {
    type: EffectType.EXPLOSION_GIANT,
    frames: [
      'effect_explosion_big01.png',
      'effect_explosion_big02.png',
      'effect_explosion_big03.png',
      'effect_explosion_big04.png',
      'effect_explosion_big05.png',
      'effect_explosion_big06.png',
      'effect_explosion_big07.png',
      'effect_explosion_big08.png',
      'effect_explosion_big09.png',
    ],
    frameDuration: 1 / 24,
    width: 128,
    height: 128,
    loop: false,
    sound: 'sound_explode',
    hasAttackVolume: true,
  },
  [EffectType.SMOKE_BIG]: {
    type: EffectType.SMOKE_BIG,
    frames: [
      'effect_smoke_big01.png',
      'effect_smoke_big02.png',
      'effect_smoke_big03.png',
      'effect_smoke_big04.png',
      'effect_smoke_big05.png',
    ],
    frameDuration: 1 / 24,
    width: 32,
    height: 32,
    loop: false,
  },
  [EffectType.SMOKE_SMALL]: {
    type: EffectType.SMOKE_SMALL,
    frames: [
      'effect_smoke_small01.png',
      'effect_smoke_small02.png',
      'effect_smoke_small03.png',
      'effect_smoke_small04.png',
      'effect_smoke_small05.png',
    ],
    frameDuration: 1 / 24,
    width: 16,
    height: 16,
    loop: false,
  },
  [EffectType.CRUSH_FLASH]: {
    type: EffectType.CRUSH_FLASH,
    frames: [
      'effect_crush_front01.png',
      'effect_crush_front02.png',
      'effect_crush_front03.png',
      'effect_crush_front04.png',
      'effect_crush_front05.png',
      'effect_crush_front06.png',
      'effect_crush_front07.png',
    ],
    frameDuration: 1 / 30,
    width: 64,
    height: 64,
    loop: false,
    sound: 'sound_stomp',
  },
  [EffectType.DUST]: {
    type: EffectType.DUST,
    frames: [
      'effect_smoke_small01.png',
      'effect_smoke_small02.png',
      'effect_smoke_small03.png',
    ],
    frameDuration: 1 / 16,
    width: 16,
    height: 16,
    loop: false,
  },
};

/**
 * Maximum number of concurrent effects
 */
const MAX_EFFECTS = 64;

/**
 * Effects System - manages visual effects
 */
export class EffectsSystem {
  private activeEffects: ActiveEffect[] = [];
  private renderSystem: RenderSystem | null = null;
  private soundSystem: SoundSystem | null = null;
  private loadedSprites: Set<string> = new Set();
  private spritesLoaded: boolean = false;
  
  constructor() {
    // Pre-allocate effect pool
    for (let i = 0; i < MAX_EFFECTS; i++) {
      this.activeEffects.push({
        type: EffectType.EXPLOSION_SMALL,
        x: 0,
        y: 0,
        frameIndex: 0,
        frameTimer: 0,
        config: EFFECT_CONFIGS[EffectType.EXPLOSION_SMALL],
        alive: false,
      });
    }
  }
  
  /**
   * Set render system for drawing effects
   */
  setRenderSystem(renderSystem: RenderSystem): void {
    this.renderSystem = renderSystem;
  }
  
  /**
   * Set sound system for effect sounds
   */
  setSoundSystem(soundSystem: SoundSystem): void {
    this.soundSystem = soundSystem;
  }
  
  /**
   * Preload all effect sprites
   */
  async preloadSprites(): Promise<void> {
    if (!this.renderSystem || this.spritesLoaded) return;
    
    const allFrames: string[] = [];
    for (const config of Object.values(EFFECT_CONFIGS)) {
      for (const frame of config.frames) {
        if (!allFrames.includes(frame)) {
          allFrames.push(frame);
        }
      }
    }
    
    await Promise.all(
      allFrames.map(async (frame) => {
        try {
          await this.renderSystem!.loadSingleImage(frame, `/assets/sprites/${frame}`);
          this.loadedSprites.add(frame);
        } catch (e) {
          console.warn(`Failed to load effect sprite: ${frame}`, e);
        }
      })
    );
    
    this.spritesLoaded = true;
  }
  
  /**
   * Spawn an effect at a position
   */
  spawn(type: EffectType, x: number, y: number, velocityX: number = 0, velocityY: number = 0): void {
    const config = EFFECT_CONFIGS[type];
    if (!config) {
      console.warn(`Unknown effect type: ${type}`);
      return;
    }
    
    // Find an available effect slot
    let effect: ActiveEffect | null = null;
    for (const e of this.activeEffects) {
      if (!e.alive) {
        effect = e;
        break;
      }
    }
    
    if (!effect) {
      // Pool exhausted, skip this effect
      return;
    }
    
    // Initialize effect
    effect.type = type;
    effect.x = x - config.width / 2; // Center the effect
    effect.y = y - config.height / 2;
    effect.frameIndex = 0;
    effect.frameTimer = 0;
    effect.config = config;
    effect.alive = true;
    effect.velocityX = velocityX;
    effect.velocityY = velocityY;
    effect.gravity = type === EffectType.DUST ? 100 : 0;
    
    // Play sound
    if (config.sound && this.soundSystem) {
      this.soundSystem.playSfx(config.sound, 0.8);
    }
  }
  
  /**
   * Spawn an explosion effect
   */
  spawnExplosion(x: number, y: number, size: 'small' | 'large' | 'giant' = 'small'): void {
    const type = size === 'giant' 
      ? EffectType.EXPLOSION_GIANT 
      : size === 'large' 
        ? EffectType.EXPLOSION_LARGE 
        : EffectType.EXPLOSION_SMALL;
    this.spawn(type, x, y);
  }
  
  /**
   * Spawn smoke effect
   */
  spawnSmoke(x: number, y: number, big: boolean = false): void {
    const type = big ? EffectType.SMOKE_BIG : EffectType.SMOKE_SMALL;
    // Add some random upward velocity for smoke
    const vx = (Math.random() - 0.5) * 20;
    const vy = -20 - Math.random() * 30;
    this.spawn(type, x, y, vx, vy);
  }
  
  /**
   * Spawn crush/stomp flash effect
   */
  spawnCrushFlash(x: number, y: number): void {
    this.spawn(EffectType.CRUSH_FLASH, x, y);
  }
  
  /**
   * Spawn dust effect (for landing, running)
   */
  spawnDust(x: number, y: number): void {
    const vx = (Math.random() - 0.5) * 40;
    const vy = -10 - Math.random() * 20;
    this.spawn(EffectType.DUST, x, y, vx, vy);
  }
  
  /**
   * Update all active effects
   */
  update(dt: number): void {
    for (const effect of this.activeEffects) {
      if (!effect.alive) continue;
      
      // Update frame timer
      effect.frameTimer += dt;
      if (effect.frameTimer >= effect.config.frameDuration) {
        effect.frameTimer = 0;
        effect.frameIndex++;
        
        // Check if animation is complete
        if (effect.frameIndex >= effect.config.frames.length) {
          if (effect.config.loop) {
            effect.frameIndex = 0;
          } else {
            effect.alive = false;
            continue;
          }
        }
      }
      
      // Update position (for moving effects like smoke)
      if (effect.velocityX || effect.velocityY) {
        effect.x += (effect.velocityX || 0) * dt;
        effect.y += (effect.velocityY || 0) * dt;
        
        // Apply gravity
        if (effect.gravity) {
          effect.velocityY = (effect.velocityY || 0) + effect.gravity * dt;
        }
      }
    }
  }
  
  /**
   * Render all active effects
   */
  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
    if (!this.renderSystem) return;
    
    for (const effect of this.activeEffects) {
      if (!effect.alive) continue;
      
      const frameName = effect.config.frames[effect.frameIndex];
      if (!frameName) continue;
      
      // Get screen position
      const screenX = effect.x - cameraX;
      const screenY = effect.y - cameraY;
      
      // Cull if off-screen (with some buffer)
      if (screenX < -effect.config.width || screenX > ctx.canvas.width + effect.config.width ||
          screenY < -effect.config.height || screenY > ctx.canvas.height + effect.config.height) {
        continue;
      }
      
      // Draw the effect sprite directly
      const sprite = this.renderSystem.getSpriteImage(frameName);
      if (sprite) {
        ctx.drawImage(
          sprite,
          Math.floor(screenX),
          Math.floor(screenY),
          effect.config.width,
          effect.config.height
        );
      }
    }
  }
  
  /**
   * Get count of active effects
   */
  getActiveCount(): number {
    let count = 0;
    for (const effect of this.activeEffects) {
      if (effect.alive) count++;
    }
    return count;
  }
  
  /**
   * Clear all active effects
   */
  clear(): void {
    for (const effect of this.activeEffects) {
      effect.alive = false;
    }
  }
  
  /**
   * Reset the effects system
   */
  reset(): void {
    this.clear();
  }
}
