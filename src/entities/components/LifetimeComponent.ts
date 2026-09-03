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
import { HotSpotType } from '../../engine/HotSpotSystem';
import { sSystemRegistry } from '../../engine/SystemRegistry';

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
        // console.log(`[LifetimeComponent] Projectile ${parent.subType} timeUntilDeath=${this.timeUntilDeath.toFixed(2)} dt=${dt.toFixed(4)}`);
      }
      if (this.timeUntilDeath <= 0) {
        // console.log(`[LifetimeComponent] Projectile ${parent.type}/${parent.subType} DYING - timeUntilDeath expired`);
        this.die(parent);
        return;
      }
    }
    
    // Check visibility-based death.
    // Two conversions the original does not need: its getFocusPosition* is the
    // centre of the view, while this port's is the viewport's top-left, and its
    // position.y is the object's bottom, while here it is the top. Comparing
    // against the raw top-left made the cull asymmetric - twice as forgiving
    // above and to the left of the camera as below and to the right.
    if (this.dieWhenInvisible && this.cameraSystem) {
      const pos = parent.getPosition();
      const centreX = this.cameraSystem.getFocusPositionX() + this.screenWidth / 2;
      const centreY = this.cameraSystem.getFocusPositionY() + this.screenHeight / 2;
      const dx = Math.abs(pos.x - centreX);
      const dy = Math.abs(pos.y + parent.height - centreY);

      if (dx > this.screenWidth || dy > this.screenHeight) {
        this.die(parent);
        return;
      }
    }
    
    // Death tiles. The flag for this was ported with a setter, a getter and
    // no reader, so the four walking enemies the original marks vulnerable
    // (brobot, snailbomb, skeleton, onion) would stroll through a death pit.
    // Sampled at the feet: the original's position.y is the object's bottom.
    if (parent.life > 0 && this._vulnerableToDeathTiles) {
      const hotSpotSystem = sSystemRegistry.hotSpotSystem;
      if (hotSpotSystem) {
        const spot = hotSpotSystem.getHotSpot(
          parent.getCenteredPositionX(),
          parent.getPosition().y + parent.height - 10
        );
        if (spot === HotSpotType.DIE) {
          parent.life = 0;
        }
      }
    }

    // Check background collision death (like original Java)
    // parentObject.getBackgroundCollisionNormal().length2() > 0.0f
    if (this._dieOnHitBackground) {
      const normal = parent.getBackgroundCollisionNormal();
      if (normal && (normal.x !== 0 || normal.y !== 0)) {
        // console.log(`[LifetimeComponent] ${parent.type}/${parent.subType} hit background, dying`);
        parent.life = 0;
      }
    }
    
    // Check life.
    // In the original this component owns every death: die() spawns the smoke
    // poof, plays the death sound and destroys the object. This port splits
    // that - projectiles and effects are owned here, but an ordinary enemy's
    // death (crush flash, stomp sound, score) belongs to Game.tsx's
    // resolveCollisionOutcomes, which skips anything already marked for
    // removal. So a component attached purely to make an enemy vulnerable to
    // death tiles reports the kill and leaves the consequences to that owner;
    // removing the object here would make it vanish silently instead.
    if (parent.life <= 0 && this.ownsDeath()) {
      this.die(parent);
      return;
    }
  }
  
  /**
   * Was this component given anything that makes it responsible for the
   * object's removal - a lifetime trigger, or a death consequence? These are
   * exactly the fields the original's die() acts on.
   */
  private ownsDeath(): boolean {
    return (
      this.timeUntilDeath >= 0 ||
      this.dieWhenInvisible ||
      this._dieOnHitBackground ||
      this.spawnOnDeathType >= 0 ||
      this.deathSound !== null ||
      this.onDeath !== null
    );
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
