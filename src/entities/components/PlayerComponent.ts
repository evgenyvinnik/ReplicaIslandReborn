/**
 * Player Component - Handles player-specific behavior
 * Ported from: Original/src/com/replica/replicaisland/PlayerComponent.java
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import type { InputSystem } from '../../engine/InputSystem';

export interface PlayerConfig {
  moveSpeed: number;
  jumpForce: number;
  jumpTime: number;
  maxJumps: number;
  attackCooldown: number;
}

const DEFAULT_CONFIG: PlayerConfig = {
  moveSpeed: 200,
  jumpForce: 400,
  jumpTime: 0.2,
  maxJumps: 2, // Allow double jump
  attackCooldown: 0.3,
};

export class PlayerComponent extends GameComponent {
  private inputSystem: InputSystem | null = null;
  private config: PlayerConfig;

  // State
  private jumpCount: number = 0;
  private jumpHeldTime: number = 0;
  private isJumping: boolean = false;
  private canJump: boolean = true;
  private attackTimer: number = 0;
  private isAttacking: boolean = false;

  constructor(config?: Partial<PlayerConfig>) {
    super(ComponentPhase.THINK);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set input system reference
   */
  setInputSystem(input: InputSystem): void {
    this.inputSystem = input;
  }

  /**
   * Update player behavior
   */
  update(deltaTime: number, parent: GameObject): void {
    if (!this.inputSystem) return;

    const input = this.inputSystem.getInputState();
    const velocity = parent.getVelocity();
    const targetVelocity = parent.getTargetVelocity();

    // Reset ground-based states
    if (parent.touchingGround()) {
      this.jumpCount = 0;
      this.canJump = true;
    }

    // Horizontal movement
    let moveX = 0;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    targetVelocity.x = moveX * this.config.moveSpeed;

    // Update facing direction
    if (moveX !== 0) {
      parent.facingDirection.x = moveX;
    }

    // Jump handling
    this.handleJump(input.jump, deltaTime, parent, velocity);

    // Attack handling
    this.handleAttack(input.attack, deltaTime, parent);

    // Update action state
    this.updateActionState(parent, moveX);
  }

  /**
   * Handle jump input and physics
   */
  private handleJump(
    jumpPressed: boolean,
    deltaTime: number,
    parent: GameObject,
    velocity: { x: number; y: number }
  ): void {
    // Start jump
    if (jumpPressed && this.canJump && this.jumpCount < this.config.maxJumps) {
      if (!this.isJumping) {
        this.isJumping = true;
        this.jumpHeldTime = 0;
        this.jumpCount++;

        // Apply initial jump impulse
        const impulse = parent.getImpulse();
        impulse.y = -this.config.jumpForce;

        // Cancel any downward velocity
        if (velocity.y > 0) {
          velocity.y = 0;
        }
      }
    }

    // Continue jump while held (variable height jump)
    if (jumpPressed && this.isJumping && this.jumpHeldTime < this.config.jumpTime) {
      this.jumpHeldTime += deltaTime;
      
      // Reduce gravity effect while holding jump
      const jumpMultiplier = 1 - (this.jumpHeldTime / this.config.jumpTime);
      velocity.y += -this.config.jumpForce * jumpMultiplier * deltaTime * 0.5;
    }

    // End jump
    if (!jumpPressed) {
      this.isJumping = false;
      
      // Allow jump again after releasing
      if (parent.touchingGround()) {
        this.canJump = true;
      }
    }

    // Prevent holding jump for multi-jump
    if (this.isJumping && this.jumpHeldTime >= this.config.jumpTime) {
      this.canJump = false;
    }
  }

  /**
   * Handle attack input
   */
  private handleAttack(
    attackPressed: boolean,
    deltaTime: number,
    parent: GameObject
  ): void {
    // Update attack cooldown
    if (this.attackTimer > 0) {
      this.attackTimer -= deltaTime;
    }

    // Start attack
    if (attackPressed && this.attackTimer <= 0 && !this.isAttacking) {
      this.isAttacking = true;
      this.attackTimer = this.config.attackCooldown;
      parent.setCurrentAction(ActionType.ATTACK);
    }

    // End attack after animation would complete
    if (this.isAttacking && this.attackTimer <= this.config.attackCooldown * 0.5) {
      this.isAttacking = false;
    }
  }

  /**
   * Update the action state for animation
   */
  private updateActionState(parent: GameObject, moveX: number): void {
    // Don't override attack animation
    if (this.isAttacking) return;

    if (!parent.touchingGround()) {
      // Airborne
      parent.setCurrentAction(ActionType.MOVE);
    } else if (Math.abs(moveX) > 0) {
      // Walking
      parent.setCurrentAction(ActionType.MOVE);
    } else {
      // Idle
      parent.setCurrentAction(ActionType.IDLE);
    }
  }

  /**
   * Get current config
   */
  getConfig(): PlayerConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  setConfig(config: Partial<PlayerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset component
   */
  reset(): void {
    this.jumpCount = 0;
    this.jumpHeldTime = 0;
    this.isJumping = false;
    this.canJump = true;
    this.attackTimer = 0;
    this.isAttacking = false;
  }
}
