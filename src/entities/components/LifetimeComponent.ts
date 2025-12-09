/**
 * Lifetime Component - Handles object lifetime and death conditions
 * Ported from: Original/src/com/replica/replicaisland/LifetimeComponent.java
 * 
 * This component allows objects to die and be deleted when their life is reduced 
 * to zero or they meet other configurable criteria (time limit, off-screen, etc.)
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import type { CameraSystem } from '../../engine/CameraSystem';

export class LifetimeComponent extends GameComponent {
  private dieWhenInvisible: boolean = false;
  private timeUntilDeath: number = -1;
  private spawnOnDeathType: number = -1;
  private _vulnerableToDeathTiles: boolean = false;
  private _dieOnHitBackground: boolean = false;
  private deathSound: string | null = null;
  private onDeath: (() => void) | null = null;
  
  // Reference to camera for visibility checks
  private cameraSystem: CameraSystem | null = null;
  private screenWidth: number = 480;
  private screenHeight: number = 320;
  
  constructor() {
    super(ComponentPhase.THINK);
  }
  
  reset(): void {
    this.dieWhenInvisible = false;
    this.timeUntilDeath = -1;
    this.spawnOnDeathType = -1;
    this._vulnerableToDeathTiles = false;
    this._dieOnHitBackground = false;
    this.deathSound = null;
    this.onDeath = null;
  }
  
  /**
   * Set camera system for visibility checks
   */
  setCameraSystem(camera: CameraSystem): void {
    this.cameraSystem = camera;
  }
  
  /**
   * Set screen dimensions for visibility checks
   */
  setScreenDimensions(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }
  
  /**
   * Configure object to die when off-screen
   */
  setDieWhenInvisible(die: boolean): void {
    this.dieWhenInvisible = die;
  }
  
  /**
   * Set a timer until automatic death
   */
  setTimeUntilDeath(time: number): void {
    this.timeUntilDeath = time;
  }
  
  /**
   * Set object type to spawn on death
   */
  setObjectToSpawnOnDeath(type: number): void {
    this.spawnOnDeathType = type;
  }
  
  /**
   * Set whether object dies when touching death tiles
   */
  setVulnerableToDeathTiles(vulnerable: boolean): void {
    this._vulnerableToDeathTiles = vulnerable;
  }
  
  /**
   * Check if vulnerable to death tiles
   */
  isVulnerableToDeathTiles(): boolean {
    return this._vulnerableToDeathTiles;
  }
  
  /**
   * Set whether object dies on background collision
   */
  setDieOnHitBackground(die: boolean): void {
    this._dieOnHitBackground = die;
  }
  
  /**
   * Check if dies on background hit
   */
  getDieOnHitBackground(): boolean {
    return this._dieOnHitBackground;
  }
  
  /**
   * Set sound to play on death
   */
  setDeathSound(sound: string): void {
    this.deathSound = sound;
  }
  
  /**
   * Set callback function for death
   */
  setOnDeath(callback: () => void): void {
    this.onDeath = callback;
  }
  
  /**
   * Get spawn type for death
   */
  getSpawnOnDeathType(): number {
    return this.spawnOnDeathType;
  }
  
  /**
   * Get death sound
   */
  getDeathSound(): string | null {
    return this.deathSound;
  }
  
  update(dt: number, parent: GameObject): void {
    // Check time-based death
    if (this.timeUntilDeath > 0) {
      this.timeUntilDeath -= dt;
      // Debug logging for projectiles
      if (parent.type === 'projectile') {
        console.log(`[LifetimeComponent] Projectile ${parent.subType} timeUntilDeath=${this.timeUntilDeath.toFixed(2)} dt=${dt.toFixed(4)}`);
      }
      if (this.timeUntilDeath <= 0) {
        console.log(`[LifetimeComponent] Projectile ${parent.type}/${parent.subType} DYING - timeUntilDeath expired`);
        this.die(parent);
        return;
      }
    }
    
    // Check visibility-based death
    if (this.dieWhenInvisible && this.cameraSystem) {
      const pos = parent.getPosition();
      const cameraX = this.cameraSystem.getFocusPositionX();
      const cameraY = this.cameraSystem.getFocusPositionY();
      const dx = Math.abs(pos.x - cameraX);
      const dy = Math.abs(pos.y - cameraY);
      
      // Add some buffer beyond screen edge
      if (dx > this.screenWidth * 1.5 || dy > this.screenHeight * 1.5) {
        this.die(parent);
        return;
      }
    }
    
    // Check background collision death (like original Java)
    // parentObject.getBackgroundCollisionNormal().length2() > 0.0f
    if (this._dieOnHitBackground) {
      const normal = parent.getBackgroundCollisionNormal();
      if (normal && (normal.x !== 0 || normal.y !== 0)) {
        console.log(`[LifetimeComponent] ${parent.type}/${parent.subType} hit background, dying`);
        parent.life = 0;
      }
    }
    
    // Check life
    if (parent.life <= 0) {
      this.die(parent);
      return;
    }
  }
  
  /**
   * Kill the object
   */
  private die(parent: GameObject): void {
    // Mark for removal
    parent.markForRemoval();
    
    // Trigger death callback
    if (this.onDeath) {
      this.onDeath();
    }
  }
}
