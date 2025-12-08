/**
 * Game Object - Base entity class
 * Ported from: Original/src/com/replica/replicaisland/GameObject.java
 * 
 * GameObject defines any object that resides in the game world (character, background, 
 * special effect, enemy, etc). It is a collection of GameComponents which implement its 
 * behavior; GameObjects themselves have no intrinsic behavior. GameObjects are also 
 * "bags of data" that components can use to share state.
 */

import { Vector2 } from '../utils/Vector2';
import { ActionType, Team, ComponentPhase, HitType } from '../types';
import type { Rect } from '../types';
import type { GameComponent } from './GameComponent';
import { Poolable } from '../utils/ObjectPool';

const COLLISION_SURFACE_DECAY_TIME = 0.3;
const DEFAULT_LIFE = 1;

export class GameObject implements Poolable {
  // Identity
  public id: number = 0;
  public type: string = '';
  public name: string = '';

  // Transform
  private position: Vector2 = new Vector2();
  private velocity: Vector2 = new Vector2();
  private targetVelocity: Vector2 = new Vector2();
  private acceleration: Vector2 = new Vector2();
  private impulse: Vector2 = new Vector2();
  private backgroundCollisionNormal: Vector2 = new Vector2();

  // Collision timing (public for external systems to update)
  public lastTouchedFloorTime: number = 0;
  public lastTouchedCeilingTime: number = 0;
  public lastTouchedLeftWallTime: number = 0;
  public lastTouchedRightWallTime: number = 0;

  // State
  public positionLocked: boolean = false;
  public activationRadius: number = 0;
  public destroyOnDeactivation: boolean = false;
  public life: number = DEFAULT_LIFE;
  public maxLife: number = DEFAULT_LIFE;
  public lastReceivedHitType: HitType = HitType.INVALID;
  public facingDirection: Vector2 = new Vector2(1, 0);
  public width: number = 0;
  public height: number = 0;
  public team: Team = Team.NONE;

  // Action state
  private currentAction: ActionType = ActionType.INVALID;

  // Animation state (for simple objects without AnimationComponent)
  public animTimer: number = 0;
  public animFrame: number = 0;
  public projectileAnimTimer: number = 0;  // Separate timer for faster projectile animation
  public subType: string = '';

  // Components organized by phase
  private components: Map<ComponentPhase, GameComponent[]> = new Map();
  private allComponents: GameComponent[] = [];

  // Flags
  private active: boolean = true;
  private visible: boolean = true;
  private markedForRemoval: boolean = false;

  // Reference to current game time (set externally)
  private gameTime: number = 0;

  constructor() {
    // Initialize component maps for each phase
    for (let phase = ComponentPhase.THINK; phase <= ComponentPhase.FRAME_END; phase++) {
      this.components.set(phase, []);
    }
    this.reset();
  }

  /**
   * Reset the game object to initial state
   */
  reset(): void {
    this.position.zero();
    this.velocity.zero();
    this.targetVelocity.zero();
    this.acceleration.zero();
    this.impulse.zero();
    this.backgroundCollisionNormal.zero();
    this.facingDirection.set(1, 0);

    this.currentAction = ActionType.INVALID;
    this.animTimer = 0;
    this.animFrame = 0;
    this.projectileAnimTimer = 0;
    this.subType = '';
    this.positionLocked = false;
    this.activationRadius = 0;
    this.destroyOnDeactivation = false;
    this.life = DEFAULT_LIFE;
    this.maxLife = DEFAULT_LIFE;
    this.team = Team.NONE;
    this.width = 0;
    this.height = 0;
    this.lastReceivedHitType = HitType.INVALID;

    this.lastTouchedFloorTime = 0;
    this.lastTouchedCeilingTime = 0;
    this.lastTouchedLeftWallTime = 0;
    this.lastTouchedRightWallTime = 0;

    this.active = true;
    this.visible = true;
    this.markedForRemoval = false;

    // Reset all components
    for (const component of this.allComponents) {
      component.reset();
    }
  }

  /**
   * Update the game object
   */
  update(deltaTime: number, gameTime: number): void {
    if (!this.active) return;

    this.gameTime = gameTime;

    // Update components in phase order
    for (let phase = ComponentPhase.THINK; phase <= ComponentPhase.FRAME_END; phase++) {
      const phaseComponents = this.components.get(phase);
      if (phaseComponents) {
        for (const component of phaseComponents) {
          component.update(deltaTime, this);
        }
      }
    }
  }

  /**
   * Add a component to this game object
   */
  addComponent(component: GameComponent): void {
    const phase = component.getPhase();
    const phaseComponents = this.components.get(phase);
    if (phaseComponents) {
      phaseComponents.push(component);
    }
    this.allComponents.push(component);
    component.setParent(this);
  }

  /**
   * Remove a component from this game object
   */
  removeComponent(component: GameComponent): void {
    const phase = component.getPhase();
    const phaseComponents = this.components.get(phase);
    if (phaseComponents) {
      const index = phaseComponents.indexOf(component);
      if (index !== -1) {
        phaseComponents.splice(index, 1);
      }
    }

    const allIndex = this.allComponents.indexOf(component);
    if (allIndex !== -1) {
      this.allComponents.splice(allIndex, 1);
    }
    component.setParent(null);
  }

  /**
   * Get a component by type
   */
  getComponent<T extends GameComponent>(
    componentClass: new (...args: unknown[]) => T
  ): T | null {
    for (const component of this.allComponents) {
      if (component instanceof componentClass) {
        return component;
      }
    }
    return null;
  }

  /**
   * Check if this object has a specific component instance
   */
  hasComponent(component: GameComponent): boolean {
    return this.allComponents.includes(component);
  }

  /**
   * Get all components
   */
  getComponents(): GameComponent[] {
    return [...this.allComponents];
  }

  /**
   * Remove all components
   */
  removeAllComponents(): void {
    for (const component of this.allComponents) {
      component.setParent(null);
    }
    this.allComponents = [];
    for (let phase = ComponentPhase.THINK; phase <= ComponentPhase.FRAME_END; phase++) {
      this.components.set(phase, []);
    }
  }

  // Collision surface checks (ported from original)
  touchingGround(): boolean {
    return (
      this.gameTime > 0.1 &&
      Math.abs(this.lastTouchedFloorTime - this.gameTime) < COLLISION_SURFACE_DECAY_TIME
    );
  }

  touchingCeiling(): boolean {
    return (
      this.gameTime > 0.1 &&
      Math.abs(this.lastTouchedCeilingTime - this.gameTime) < COLLISION_SURFACE_DECAY_TIME
    );
  }

  touchingLeftWall(): boolean {
    return (
      this.gameTime > 0.1 &&
      Math.abs(this.lastTouchedLeftWallTime - this.gameTime) < COLLISION_SURFACE_DECAY_TIME
    );
  }

  touchingRightWall(): boolean {
    return (
      this.gameTime > 0.1 &&
      Math.abs(this.lastTouchedRightWallTime - this.gameTime) < COLLISION_SURFACE_DECAY_TIME
    );
  }

  // Position getters/setters
  getPosition(): Vector2 {
    return this.position;
  }

  setPosition(x: number | Vector2, y?: number): void {
    if (x instanceof Vector2) {
      this.position.set(x);
    } else {
      this.position.set(x, y!);
    }
  }

  getCenteredPositionX(): number {
    return this.position.x + this.width / 2;
  }

  getCenteredPositionY(): number {
    return this.position.y + this.height / 2;
  }

  // Velocity getters/setters
  getVelocity(): Vector2 {
    return this.velocity;
  }

  setVelocity(x: number | Vector2, y?: number): void {
    if (x instanceof Vector2) {
      this.velocity.set(x);
    } else {
      this.velocity.set(x, y!);
    }
  }

  // Target velocity
  getTargetVelocity(): Vector2 {
    return this.targetVelocity;
  }

  setTargetVelocity(x: number | Vector2, y?: number): void {
    if (x instanceof Vector2) {
      this.targetVelocity.set(x);
    } else {
      this.targetVelocity.set(x, y!);
    }
  }

  // Acceleration
  getAcceleration(): Vector2 {
    return this.acceleration;
  }

  setAcceleration(x: number | Vector2, y?: number): void {
    if (x instanceof Vector2) {
      this.acceleration.set(x);
    } else {
      this.acceleration.set(x, y!);
    }
  }

  // Impulse
  getImpulse(): Vector2 {
    return this.impulse;
  }

  setImpulse(x: number | Vector2, y?: number): void {
    if (x instanceof Vector2) {
      this.impulse.set(x);
    } else {
      this.impulse.set(x, y!);
    }
  }

  // Background collision normal
  getBackgroundCollisionNormal(): Vector2 {
    return this.backgroundCollisionNormal;
  }

  setBackgroundCollisionNormal(normal: Vector2): void {
    this.backgroundCollisionNormal.set(normal);
  }

  // Collision timing setters
  setLastTouchedFloorTime(time: number): void {
    this.lastTouchedFloorTime = time;
  }

  getLastTouchedFloorTime(): number {
    return this.lastTouchedFloorTime;
  }

  // Game time setters/getters (for external systems that need to update gameTime before using touchingGround)
  setGameTime(time: number): void {
    this.gameTime = time;
  }

  getGameTime(): number {
    return this.gameTime;
  }

  setLastTouchedCeilingTime(time: number): void {
    this.lastTouchedCeilingTime = time;
  }

  setLastTouchedLeftWallTime(time: number): void {
    this.lastTouchedLeftWallTime = time;
  }

  setLastTouchedRightWallTime(time: number): void {
    this.lastTouchedRightWallTime = time;
  }

  // Action state
  getCurrentAction(): ActionType {
    return this.currentAction;
  }

  setCurrentAction(action: ActionType): void {
    this.currentAction = action;
  }

  // Active/visible state
  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    this.active = active;
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  // Removal
  markForRemoval(): void {
    this.markedForRemoval = true;
  }

  isMarkedForRemoval(): boolean {
    return this.markedForRemoval;
  }

  // Collision rect
  getCollisionRect(): Rect {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.width,
      height: this.height,
    };
  }
}
