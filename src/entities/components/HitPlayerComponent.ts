/**
 * Hit Player Component - Proximity-based player hit detection
 * Ported from: Original/src/com/replica/replicaisland/HitPlayerComponent.java
 *
 * Checks if the player is within a certain distance and triggers a hit reaction.
 * Can either hit the player or be hit by the player depending on configuration.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, HitType } from '../../types';
import type { GameObject } from '../GameObject';
import { HitReactionComponent } from './HitReactionComponent';
import type { GameObjectManager } from '../GameObjectManager';
import { Vector2 } from '../../utils/Vector2';

/**
 * Hit Player Component Configuration
 */
export interface HitPlayerConfig {
  /** The distance at which the hit triggers */
  distance: number;
  /** The hit reaction component for this object */
  hitReaction: HitReactionComponent;
  /** The type of hit to deal/receive */
  hitType: HitType;
  /** If true, hits the player. If false, gets hit by the player */
  hitPlayer: boolean;
}

/**
 * Hit Player Component
 * Detects when the player is within range and triggers hit reactions
 */
export class HitPlayerComponent extends GameComponent {
  private distanceSquared: number = 0;
  private hitReaction: HitReactionComponent | null = null;
  private hitType: HitType = HitType.INVALID;
  private hitPlayer: boolean = false;

  // Workspace vectors
  private playerPosition: Vector2 = new Vector2();
  private myPosition: Vector2 = new Vector2();

  // System reference
  private gameObjectManager: GameObjectManager | null = null;

  constructor() {
    super(ComponentPhase.THINK);
  }

  /**
   * Reset the component
   */
  reset(): void {
    this.distanceSquared = 0;
    this.playerPosition.zero();
    this.myPosition.zero();
    this.hitReaction = null;
    this.hitType = HitType.INVALID;
    this.hitPlayer = false;
  }

  /**
   * Set the game object manager reference
   */
  setGameObjectManager(manager: GameObjectManager): void {
    this.gameObjectManager = manager;
  }

  /**
   * Update - check distance to player and trigger hits
   */
  update(_deltaTime: number, parent: GameObject): void {
    if (!this.gameObjectManager || !this.hitReaction) {
      return;
    }

    const player = this.gameObjectManager.getPlayer();
    if (!player || player.life <= 0) {
      return;
    }

    // Get centered positions
    this.playerPosition.set(player.getCenteredPositionX(), player.getCenteredPositionY());
    this.myPosition.set(parent.getCenteredPositionX(), parent.getCenteredPositionY());

    // Check if within hit distance
    if (this.myPosition.distanceSquared(this.playerPosition) <= this.distanceSquared) {
      // Get player's hit reaction component
      const playerHitReaction = player.getComponent(
        HitReactionComponent as new (...args: unknown[]) => HitReactionComponent
      );

      if (playerHitReaction) {
        if (!this.hitPlayer) {
          // Hit myself (this object gets hit by the player)
          const accepted = this.hitReaction.receivedHit(parent, player, this.hitType);
          playerHitReaction.hitVictim(player, parent, this.hitType, accepted);
        } else {
          // Hit the player
          const accepted = playerHitReaction.receivedHit(player, parent, this.hitType);
          this.hitReaction.hitVictim(parent, player, this.hitType, accepted);
        }
      }
    }
  }

  /**
   * Configure the hit player component
   */
  setup(config: HitPlayerConfig): void {
    this.distanceSquared = config.distance * config.distance;
    this.hitReaction = config.hitReaction;
    this.hitType = config.hitType;
    this.hitPlayer = config.hitPlayer;
  }

  /**
   * Set hit distance
   */
  setDistance(distance: number): void {
    this.distanceSquared = distance * distance;
  }

  /**
   * Set hit reaction component
   */
  setHitReaction(hitReaction: HitReactionComponent): void {
    this.hitReaction = hitReaction;
  }

  /**
   * Set hit type
   */
  setHitType(hitType: HitType): void {
    this.hitType = hitType;
  }

  /**
   * Set hit direction
   */
  setHitPlayer(hitPlayer: boolean): void {
    this.hitPlayer = hitPlayer;
  }
}
