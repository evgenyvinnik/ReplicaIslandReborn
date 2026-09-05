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
  private componentReleaseHandler: ((object: GameObject) => void) | null = null;

  // For activation based on camera proximity
  private inactiveObjects: FixedSizeArray<GameObject>;
  private camera: CameraSystem | null = null;
  /**
   * activationRadius === -1 means "never deactivate". Original:
   * GameObjectFactory.mAlwaysActive.
   */
  private static readonly ALWAYS_ACTIVE = -1;

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
      this.releaseObject(obj);
    });
    this.objects.clear();

    this.inactiveObjects.forEach((obj) => {
      this.releaseObject(obj);
    });
    this.inactiveObjects.clear();

    // A level transition can happen between update phases, while newly spawned
    // projectiles or effects are still waiting to be committed. Release those
    // objects too so they cannot leak into the next level or stay allocated.
    for (const obj of this.pendingAdditions) {
      this.releaseObject(obj);
    }

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
   * Let the factory reclaim any pooled components before an object is reset.
   * Components created directly by the level loader are intentionally ignored
   * by the factory's handler and remain normal garbage-collected objects.
   */
  setComponentReleaseHandler(handler: (object: GameObject) => void): void {
    this.componentReleaseHandler = handler;
  }

  private releaseObject(object: GameObject): void {
    this.componentReleaseHandler?.(object);
    object.removeAllComponents();
    this.objectPool.release(object);
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

    // Log NPC counts every 60 frames
    if (Math.random() < 0.016) { // ~once per second
      // console.log(`[GameObjectManager] Total objects: ${this.objects.getCount()}, NPCs: ${npcCount}, active NPCs: ${activeNpcCount}`);
    }
  }

  /**
   * Commit pending additions and removals
   * Made public so it can be called immediately after level load
   */
  commitUpdates(): void {
    // Add pending objects
    for (const object of this.pendingAdditions) {
      const added = this.objects.add(object);
      if (!added) {
        // console.error('[GameObjectManager] Failed to add object - capacity exceeded:', object.type, object.id);
      }
    }
    this.pendingAdditions = [];

    // Remove pending objects
    for (const object of this.pendingRemovals) {
      this.objects.remove(object);
      if (object.destroyOnDeactivation) {
        this.releaseObject(object);
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
  /**
   * Activate and deactivate objects by distance from the camera.
   *
   * The original is a plain circle test: the squared distance from the camera
   * focus to the object's position against the object's activationRadius
   * squared, with -1 meaning always active (GameObjectManager.java).
   *
   * This port used to test a box instead - half the viewport, plus the radius,
   * plus a 128px margin, on each axis independently. That made the live area
   * roughly twice the original's in every direction, so objects a screen and a
   * half away were still being simulated. Now that the radii themselves come
   * from the original's formulas, the shape has to match too or they describe
   * the wrong region.
   */
  private updateActivation(): void {
    if (!this.camera) return;

    // The port's focus position is the viewport's top-left; the original's is
    // its centre, which is what the distance is measured from.
    const focusX = this.camera.getFocusPositionX() + this.camera.getViewportWidth() / 2;
    const focusY = this.camera.getFocusPositionY() + this.camera.getViewportHeight() / 2;

    const withinRadius = (object: GameObject): boolean => {
      if (object.activationRadius === GameObjectManager.ALWAYS_ACTIVE) return true;
      const position = object.getPosition();
      const dx = position.x - focusX;
      const dy = position.y - focusY;
      return dx * dx + dy * dy < object.activationRadius * object.activationRadius;
    };

    this.objects.forEach((object) => {
      if (object.activationRadius === GameObjectManager.ALWAYS_ACTIVE) return;
      if (withinRadius(object)) return;
      if (object.destroyOnDeactivation) {
        object.markForRemoval();
      } else {
        this.objects.remove(object);
        object.setActive(false);
        this.inactiveObjects.add(object);
      }
    });

    const toReactivate: GameObject[] = [];
    this.inactiveObjects.forEach((object) => {
      if (withinRadius(object)) toReactivate.push(object);
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

  /** Submit current sprites and trails once per display frame, even if paused. */
  render(): void {
    this.objects.forEach((object) => object.render());
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
