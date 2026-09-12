/**
 * Movement Component - Handles position updates based on velocity
 * Ported from: Original/src/com/replica/replicaisland/MovementComponent.java
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import type { CollisionSystem } from '../../engine/CollisionSystemNew';
import { CollisionResponseComponent } from './CollisionResponseComponent';
import { Interpolator } from '../../utils/Interpolator';

/**
 * Original SimplePhysics reflects only velocity directed into the surface.
 * Integrated displacement may still approach a wall after velocity has reversed.
 */
function reflectVelocity(velocity: number, normal: number, bounciness: number): number {
  if (velocity * normal >= 0) return velocity;
  const reflected = -velocity * bounciness;
  return Math.abs(reflected) < 0.0001 ? 0 : reflected;
}

export class MovementComponent extends GameComponent {
  private readonly interpolator = new Interpolator();
  /** Background collision box; null means use the object's full size. */
  private boxWidth: number | null = null;
  private boxHeight: number | null = null;
  private boxOffsetX: number = 0;
  private boxOffsetY: number = 0;

  private collisionSystem: CollisionSystem | null = null;
  private tileWidth: number = 32;
  private tileHeight: number = 32;
  private bounciness: number = 0;

  constructor() {
    super(ComponentPhase.MOVEMENT);
  }

  /**
   * Set collision system reference
   */
  setCollisionSystem(collision: CollisionSystem): void {
    this.collisionSystem = collision;
  }

  /**
   * Set tile dimensions for proper collision snapping
   */
  setTileDimensions(width: number, height: number): void {
    this.tileWidth = width;
    this.tileHeight = height;
  }

  /** Default restitution, used when no swappable collision response is attached. */
  setBounciness(value: number): void {
    this.bounciness = Math.max(0, Math.min(1, value));
  }

  /**
   * Update position based on velocity
   */
  /**
   * Restrict background collision to a box inside the sprite.
   *
   * The original keeps this on BackgroundCollisionComponent (setSize/setOffset)
   * because a character's sprite is much wider than the space it occupies -
   * Wanda is a 64x128 sprite standing in a 32x82 box. Colliding with the full
   * sprite wedges her into walls she should walk past.
   *
   * Offsets are in this port's Y-down sprite space.
   */
  setCollisionBox(width: number, height: number, offsetX: number, offsetY: number): void {
    this.boxWidth = width;
    this.boxHeight = height;
    this.boxOffsetX = offsetX;
    this.boxOffsetY = offsetY;
  }

  /** Move without ever colliding with the background, as the flyers do. */
  disableBackgroundCollision(): void {
    this.collisionSystem = null;
  }

  update(deltaTime: number, parent: GameObject): void {
    // The original routes ordinary enemies through SimplePhysicsComponent
    // before MovementComponent. SimplePhysics consumes scripted impulses (for
    // example Pink Namazu's wake-up jump) and then Movement integrates the
    // resulting velocity. This port folds background response into Movement,
    // so it must also perform that missing SimplePhysics responsibility.
    // PhysicsComponent-backed objects consume and clear the impulse in the
    // earlier PHYSICS phase, making this safe for both component stacks.
    const impulse = parent.getImpulse();
    const velocity = parent.getVelocity();
    velocity.x += impulse.x;
    velocity.y += impulse.y;
    impulse.zero();

    const targetVelocity = parent.getTargetVelocity();
    const acceleration = parent.getAcceleration();

    this.interpolator.set(velocity.x, targetVelocity.x, acceleration.x);
    const displacementX = this.interpolator.interpolate(deltaTime);
    velocity.x = this.interpolator.getCurrent();
    this.interpolator.set(velocity.y, targetVelocity.y, acceleration.y);
    const displacementY = this.interpolator.interpolate(deltaTime);
    velocity.y = this.interpolator.getCurrent();

    // An animation owns position only; interpolation and impulses still advance.
    if (parent.positionLocked) return;

    // Fast orbs can cross more than a tile in one frame. Keep tile probes close
    // enough to see narrow walls, without applying steering/impulses twice.
    const steps = this.collisionSystem
      ? Math.max(1, Math.ceil(Math.max(Math.abs(displacementX), Math.abs(displacementY)) /
        (Math.min(this.tileWidth, this.tileHeight) / 2)))
      : 1;
    const stepTime = deltaTime / steps;
    let stepX = displacementX / steps;
    let stepY = displacementY / steps;
    for (let i = 0; i < steps; i++) {
      const collidedAxes = this.move(stepTime, parent, stepX, stepY);
      // Once an axis hits something, remaining travel follows its collision
      // response rather than continuing the pre-impact integrated displacement.
      if (collidedAxes & 1) stepX = velocity.x * stepTime;
      if (collidedAxes & 2) stepY = velocity.y * stepTime;
    }
  }

  private move(deltaTime: number, parent: GameObject, displacementX: number, displacementY: number): number {
    const position = parent.getPosition();
    const velocity = parent.getVelocity();
    const gameTime = parent.getGameTime();
    const bounciness = parent.getComponent(
      CollisionResponseComponent as unknown as new (...args: unknown[]) => CollisionResponseComponent
    )?.bounciness ?? this.bounciness;
    let collidedAxes = 0;
    // Tile probes need the direction of travel, not the clamped final velocity.
    const travelX = deltaTime > 0 ? displacementX / deltaTime : velocity.x;
    const travelY = deltaTime > 0 ? displacementY / deltaTime : velocity.y;

    // Calculate new position
    let newX = position.x + displacementX;
    let newY = position.y + displacementY;

    // Check collision if collision system is available
    if (this.collisionSystem) {
      // The collision box may be smaller than the sprite; work in box space and
      // convert back when writing the position.
      const boxWidth = this.boxWidth ?? parent.width;
      const boxHeight = this.boxHeight ?? parent.height;
      const offsetX = this.boxWidth === null ? 0 : this.boxOffsetX;
      const offsetY = this.boxHeight === null ? 0 : this.boxOffsetY;

      const objectWall = this.collisionSystem.sweepTemporaryBox(
        position.x + offsetX, position.y + offsetY, boxWidth, boxHeight,
        newX - position.x, 0, parent
      );
      const incomingX = velocity.x;

      // Handle horizontal movement first
      const horizontalCollision = this.collisionSystem.checkTileCollision(
        newX + offsetX,
        position.y + offsetY,
        boxWidth,
        boxHeight,
        travelX,
        0
      );

      if (horizontalCollision.leftWall || horizontalCollision.rightWall) {
        collidedAxes |= 1;
        // Snap to tile edge
        if (horizontalCollision.leftWall) {
          // Box's left edge hit a wall (moving left)
          const tileX = Math.floor((newX + offsetX) / this.tileWidth);
          // Snap left edge just past the right edge of the blocking tile
          newX = (tileX + 1) * this.tileWidth + 0.1 - offsetX;
          velocity.x = reflectVelocity(incomingX, 1, bounciness);
          parent.setLastTouchedLeftWallTime(gameTime);
        }
        if (horizontalCollision.rightWall) {
          // Box's right edge hit a wall (moving right)
          const tileX = Math.floor((newX + offsetX + boxWidth) / this.tileWidth);
          // Snap right edge just before the left edge of the blocking tile
          newX = tileX * this.tileWidth - boxWidth - 0.1 - offsetX;
          velocity.x = reflectVelocity(incomingX, -1, bounciness);
          parent.setLastTouchedRightWallTime(gameTime);
        }
      }

      if (objectWall && (travelX > 0 ? newX + offsetX >= objectWall.x : newX + offsetX <= objectWall.x)) {
        collidedAxes |= 1;
        newX = objectWall.x - offsetX;
        velocity.x = reflectVelocity(incomingX, objectWall.normalX, bounciness);
        horizontalCollision.normal.set(objectWall.normalX, objectWall.normalY);
        if (objectWall.normalX > 0) parent.setLastTouchedLeftWallTime(gameTime);
        else parent.setLastTouchedRightWallTime(gameTime);
      }

      const objectFloor = this.collisionSystem.sweepTemporaryBox(
        newX + offsetX, position.y + offsetY, boxWidth, boxHeight,
        0, newY - position.y, parent
      );
      const incomingY = velocity.y;

      // Now handle vertical movement with the adjusted X position
      const verticalCollision = this.collisionSystem.checkTileCollision(
        newX + offsetX,
        newY + offsetY,
        boxWidth,
        boxHeight,
        0,
        travelY
      );

      if (verticalCollision.grounded) {
        collidedAxes |= 2;
        // Snap the box's feet to the top of the tile
        const tileY = Math.floor((newY + offsetY + boxHeight) / this.tileHeight);
        newY = tileY * this.tileHeight - boxHeight - offsetY;
        velocity.y = reflectVelocity(incomingY, -1, bounciness);
        parent.setLastTouchedFloorTime(gameTime);
      }

      if (verticalCollision.ceiling) {
        collidedAxes |= 2;
        // Snap the box's head to the bottom of the tile
        const tileY = Math.floor((newY + offsetY) / this.tileHeight);
        newY = (tileY + 1) * this.tileHeight - offsetY;
        velocity.y = reflectVelocity(incomingY, 1, bounciness);
        parent.setLastTouchedCeilingTime(gameTime);
      }

      if (objectFloor && (travelY > 0 ? newY + offsetY >= objectFloor.y : newY + offsetY <= objectFloor.y)) {
        collidedAxes |= 2;
        newY = objectFloor.y - offsetY;
        velocity.y = reflectVelocity(incomingY, objectFloor.normalY, bounciness);
        verticalCollision.normal.set(objectFloor.normalX, objectFloor.normalY);
        if (objectFloor.normalY < 0) parent.setLastTouchedFloorTime(gameTime);
        else parent.setLastTouchedCeilingTime(gameTime);
      }

      // Merge normals for background collision
      const normal = horizontalCollision.normal.clone();
      normal.add(verticalCollision.normal);
      if (normal.lengthSquared() > 0) {
        normal.normalize();
      }
      parent.setBackgroundCollisionNormal(normal);
    } else {
      // No collision system, just update position
    }

    // Update position
    position.x = newX;
    position.y = newY;
    return collidedAxes;
  }

  /**
   * Reset component
   */
  reset(): void {
    this.collisionSystem = null;
    this.boxWidth = null;
    this.boxHeight = null;
    this.boxOffsetX = 0;
    this.boxOffsetY = 0;
    this.tileWidth = 32;
    this.tileHeight = 32;
    this.bounciness = 0;
  }
}
