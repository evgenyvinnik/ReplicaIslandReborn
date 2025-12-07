/**
 * Game Object Manager - Manages all game objects
 * Ported from: Original/src/com/replica/replicaisland/GameObjectManager.java
 * 
 * Activates/deactivates objects based on camera proximity and manages object lifecycle
 */

import { GameObject } from './GameObject';
import { ObjectPool, FixedSizeArray } from '../utils/ObjectPool';
import type { CameraSystem } from '../engine/CameraSystem';

export class GameObjectManager {
  private objects: FixedSizeArray<GameObject>;
  private objectPool: ObjectPool<GameObject>;
  private pendingAdditions: GameObject[] = [];
  private pendingRemovals: GameObject[] = [];
  private nextId: number = 1;

  // For activation based on camera proximity
  private inactiveObjects: FixedSizeArray<GameObject>;
  private camera: CameraSystem | null = null;
  private activationMargin: number = 128; // Pixels beyond viewport to activate

  // Player reference
  private player: GameObject | null = null;

  constructor(maxObjects: number = 512) {
    this.objects = new FixedSizeArray<GameObject>(maxObjects);
    this.inactiveObjects = new FixedSizeArray<GameObject>(maxObjects);
    this.objectPool = new ObjectPool<GameObject>(() => new GameObject(), 50, maxObjects);
  }

  /**
   * Reset the manager
   */
  reset(): void {
    this.objects.forEach((obj) => {
      this.objectPool.release(obj);
    });
    this.objects.clear();

    this.inactiveObjects.forEach((obj) => {
      this.objectPool.release(obj);
    });
    this.inactiveObjects.clear();

    this.pendingAdditions = [];
    this.pendingRemovals = [];
    this.player = null;
    this.nextId = 1;
  }

  /**
   * Set the camera for activation distance checking
   */
  setCamera(camera: CameraSystem): void {
    this.camera = camera;
  }

  /**
   * Create a new game object
   */
  createObject(): GameObject {
    const obj = this.objectPool.allocate();
    obj.id = this.nextId++;
    return obj;
  }

  /**
   * Add an object to be managed (will be added next frame)
   */
  add(object: GameObject): void {
    this.pendingAdditions.push(object);
  }

  /**
   * Remove an object from management (will be removed next frame)
   */
  remove(object: GameObject): void {
    this.pendingRemovals.push(object);
  }

  /**
   * Get the player object
   */
  getPlayer(): GameObject | null {
    return this.player;
  }

  /**
   * Set the player object
   */
  setPlayer(player: GameObject): void {
    this.player = player;
  }

  /**
   * Update all active objects
   */
  update(deltaTime: number, gameTime: number): void {
    // Commit pending changes
    this.commitUpdates();

    // Update activation based on camera
    this.updateActivation();

    // Update all active objects
    this.objects.forEach((object) => {
      if (object.isActive()) {
        object.update(deltaTime, gameTime);

        // Check for removal
        if (object.isMarkedForRemoval()) {
          this.pendingRemovals.push(object);
        }
      }
    });
  }

  /**
   * Commit pending additions and removals
   * Made public so it can be called immediately after level load
   */
  commitUpdates(): void {
    // Add pending objects
    for (const object of this.pendingAdditions) {
      this.objects.add(object);
    }
    this.pendingAdditions = [];

    // Remove pending objects
    for (const object of this.pendingRemovals) {
      this.objects.remove(object);
      if (object.destroyOnDeactivation) {
        object.removeAllComponents();
        this.objectPool.release(object);
      } else {
        object.setActive(false);
        this.inactiveObjects.add(object);
      }
    }
    this.pendingRemovals = [];
  }

  /**
   * Update object activation based on camera distance
   */
  private updateActivation(): void {
    if (!this.camera) return;

    const cameraX = this.camera.getFocusPositionX();
    const cameraY = this.camera.getFocusPositionY();
    const viewWidth = this.camera.getViewportWidth();
    const viewHeight = this.camera.getViewportHeight();

    // Deactivate objects that are too far from camera
    this.objects.forEach((object) => {
      if (object.activationRadius > 0) {
        const objX = object.getCenteredPositionX();
        const objY = object.getCenteredPositionY();

        const dx = Math.abs(objX - (cameraX + viewWidth / 2));
        const dy = Math.abs(objY - (cameraY + viewHeight / 2));

        if (dx > viewWidth / 2 + object.activationRadius + this.activationMargin ||
            dy > viewHeight / 2 + object.activationRadius + this.activationMargin) {
          if (object.destroyOnDeactivation) {
            object.markForRemoval();
          } else {
            // Move to inactive list
            this.objects.remove(object);
            object.setActive(false);
            this.inactiveObjects.add(object);
          }
        }
      }
    });

    // Reactivate objects that are close to camera
    const toReactivate: GameObject[] = [];
    this.inactiveObjects.forEach((object) => {
      const objX = object.getCenteredPositionX();
      const objY = object.getCenteredPositionY();

      const dx = Math.abs(objX - (cameraX + viewWidth / 2));
      const dy = Math.abs(objY - (cameraY + viewHeight / 2));

      if (dx <= viewWidth / 2 + object.activationRadius + this.activationMargin &&
          dy <= viewHeight / 2 + object.activationRadius + this.activationMargin) {
        toReactivate.push(object);
      }
    });

    for (const object of toReactivate) {
      this.inactiveObjects.remove(object);
      object.setActive(true);
      this.objects.add(object);
    }
  }

  /**
   * Get all active objects
   */
  getActiveObjects(): GameObject[] {
    return this.objects.toArray();
  }

  /**
   * Find objects by type
   */
  findObjectsByType(type: string): GameObject[] {
    const result: GameObject[] = [];
    this.objects.forEach((obj) => {
      if (obj.type === type && obj.isActive()) {
        result.push(obj);
      }
    });
    return result;
  }

  /**
   * Find first object by type
   */
  findObjectByType(type: string): GameObject | null {
    return this.objects.find((obj) => obj.type === type && obj.isActive());
  }

  /**
   * Find first object by team
   */
  getObjectByTeam(team: import('../types').Team): GameObject | null {
    return this.objects.find((obj) => obj.team === team && obj.isActive());
  }

  /**
   * Get object count
   */
  getObjectCount(): number {
    return this.objects.getCount();
  }

  /**
   * Get inactive object count
   */
  getInactiveObjectCount(): number {
    return this.inactiveObjects.getCount();
  }

  /**
   * Clear all objects
   */
  clear(): void {
    this.reset();
  }

  /**
   * Iterate over all active objects
   */
  forEach(callback: (object: GameObject) => void): void {
    this.objects.forEach(callback);
  }
}
