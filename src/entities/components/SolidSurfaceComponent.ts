/**
 * Solid Surface Component - Makes game objects act as solid collision surfaces
 * Ported from: Original/src/com/replica/replicaisland/SolidSurfaceComponent.java
 *
 * A component that allows a game object to act like a solid object by submitting
 * surfaces to the background collision system every frame. This is used for:
 * - Moving platforms
 * - Crushers
 * - Elevators
 * - Any dynamic solid geometry
 *
 * Surfaces are defined in object-local space and automatically transformed based
 * on the object's position and facing direction.
 *
 * POST_COLLISION Phase: This component runs after collision detection so that
 * other objects can collide with these surfaces in the next frame.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import type { SystemRegistry } from '../../engine/SystemRegistry';
import { Vector2 } from '../../utils/Vector2';

// Global system registry reference
let sSystemRegistry: SystemRegistry | null = null;

export function setSolidSurfaceSystemRegistry(registry: SystemRegistry): void {
  sSystemRegistry = registry;
}

/** Surface definition in local space */
export interface SurfaceDefinition {
  start: Vector2;
  end: Vector2;
  normal: Vector2;
}

export class SolidSurfaceComponent extends GameComponent {
  private surfaces: SurfaceDefinition[] = [];

  // Temp vectors for transformation
  private tempStart: Vector2 = new Vector2();
  private tempEnd: Vector2 = new Vector2();
  private tempNormal: Vector2 = new Vector2();

  constructor(_maxSurfaceCount: number = 4) {
    super(ComponentPhase.POST_COLLISION);
    // Pre-allocate surface array (not strictly necessary in JS, but matches original)
    this.surfaces = [];
  }

  /**
   * Add a surface to this object
   * @param startPoint Start point in local space
   * @param endPoint End point in local space
   * @param normal Surface normal (outward-facing direction)
   */
  addSurface(startPoint: Vector2, endPoint: Vector2, normal: Vector2): void {
    this.surfaces.push({
      start: new Vector2(startPoint.x, startPoint.y),
      end: new Vector2(endPoint.x, endPoint.y),
      normal: new Vector2(normal.x, normal.y),
    });
  }

  /**
   * Add a surface using raw coordinates
   */
  addSurfaceFromCoords(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    normalX: number,
    normalY: number
  ): void {
    this.surfaces.push({
      start: new Vector2(startX, startY),
      end: new Vector2(endX, endY),
      normal: new Vector2(normalX, normalY),
    });
  }

  /**
   * Create a rectangular solid (4 surfaces)
   * Useful for simple platform shapes
   */
  createRectangle(width: number, height: number): void {
    // Top surface (normal pointing up, but in screen coords positive Y is down)
    this.addSurfaceFromCoords(0, 0, width, 0, 0, -1);
    // Bottom surface
    this.addSurfaceFromCoords(0, height, width, height, 0, 1);
    // Left surface
    this.addSurfaceFromCoords(0, 0, 0, height, -1, 0);
    // Right surface
    this.addSurfaceFromCoords(width, 0, width, height, 1, 0);
  }

  /**
   * Create just a top surface for a platform
   */
  createTopSurface(width: number): void {
    this.addSurfaceFromCoords(0, 0, width, 0, 0, -1);
  }

  /**
   * Update - submit surfaces to collision system
   */
  update(_deltaTime: number, parent: GameObject): void {
    const collision = sSystemRegistry?.collisionSystem;
    if (!collision || this.surfaces.length === 0) return;

    const position = parent.getPosition();
    const facingX = parent.facingDirection.x;
    const facingY = parent.facingDirection.y;
    const width = parent.width;
    const height = parent.height;

    for (const surface of this.surfaces) {
      // Transform start point
      this.tempStart.set(surface.start);
      if (facingX < 0) {
        this.tempStart.x = width - this.tempStart.x;
      }
      if (facingY < 0) {
        this.tempStart.y = height - this.tempStart.y;
      }
      this.tempStart.add(position);

      // Transform end point
      this.tempEnd.set(surface.end);
      if (facingX < 0) {
        this.tempEnd.x = width - this.tempEnd.x;
      }
      if (facingY < 0) {
        this.tempEnd.y = height - this.tempEnd.y;
      }
      this.tempEnd.add(position);

      // Transform normal
      this.tempNormal.set(surface.normal);
      if (facingX < 0) {
        this.tempNormal.x = -this.tempNormal.x;
      }
      if (facingY < 0) {
        this.tempNormal.y = -this.tempNormal.y;
      }

      // Submit to collision system
      collision.addTemporarySurface(
        this.tempStart.x,
        this.tempStart.y,
        this.tempEnd.x,
        this.tempEnd.y,
        this.tempNormal.x,
        this.tempNormal.y,
        parent
      );
    }
  }

  /**
   * Get all surfaces
   */
  getSurfaces(): SurfaceDefinition[] {
    return this.surfaces;
  }

  /**
   * Clear all surfaces
   */
  clearSurfaces(): void {
    this.surfaces = [];
  }

  /**
   * Reset component
   */
  reset(): void {
    this.surfaces = [];
  }
}
