/**
 * Per-enemy collision volumes, taken from the original's animation frames.
 *
 * In the original every `AnimationFrame` carries its own attack and
 * vulnerability volume lists, so an enemy's hitboxes change with its animation.
 * This port's SpriteComponent has no per-frame volume data, so the volumes are
 * selected from the object's current `ActionType` instead - the same approach
 * `playerCollisionVolumes.ts` takes for Andou.
 *
 * Two details from the original that matter for play:
 *
 * - Mudman and Pink Namazu have **no vulnerability volume at all**. They cannot
 *   be stomped; the player has to avoid or possess them. The port used to let a
 *   single stomp kill either one.
 * - Skeleton, Mudman and Pink Namazu only carry an attack volume on their
 *   attack frames, so they are harmless mid-patrol. Brobots and the flying
 *   enemies carry theirs on every frame and hurt on contact.
 *
 * Coordinates are converted from the original's Y-up sprite space (origin at
 * the bottom-left) to this port's Y-down space (origin at the top-left):
 *   sphere  centerY_down = spriteHeight - centerY_up
 *   AABox   offsetY_down = spriteHeight - (offsetY_up + height)
 *
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 */

import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import type { CollisionVolume } from '../engine/collision/CollisionVolume';
import { ActionType, HitType } from '../types';

export interface EnemyCollisionProfile {
  /** Volumes that let this enemy damage the player. */
  attack: CollisionVolume[] | null;
  /** Volumes that let the player damage this enemy. Null means invulnerable. */
  vulnerability: CollisionVolume[] | null;
  /**
   * True when the attack volume only exists on the enemy's attack frames.
   * These enemies are harmless while patrolling.
   */
  attackOnlyWhileAttacking: boolean;
}

/**
 * Build the volume set for one enemy subType, or null when the port has no
 * profile for it (bosses and scripted characters configure their own).
 */
export function createEnemyCollisionProfile(subType: string): EnemyCollisionProfile | null {
  switch (subType) {
    // 64x64. Attack and vulnerability on every frame, plus a DEPRESS volume so
    // a patrolling brobot can stand on and trigger buttons.
    case 'brobot':
      return {
        attack: [
          new SphereCollisionVolume(16, 32, 32, HitType.HIT),
          new AABoxCollisionVolume(16, 48, 32, 16, HitType.DEPRESS),
        ],
        vulnerability: [new SphereCollisionVolume(16, 32, 32, HitType.HIT)],
        attackOnlyWhileAttacking: false,
      };

    // 64x64, AABox(12, 5, 42, 27) in Y-up.
    case 'snailbomb':
      return {
        attack: [new AABoxCollisionVolume(12, 32, 42, 27, HitType.HIT)],
        vulnerability: [new AABoxCollisionVolume(12, 32, 42, 27, HitType.HIT)],
        attackOnlyWhileAttacking: false,
      };

    // 64x64.
    case 'shadowslime':
      return {
        attack: [new SphereCollisionVolume(16, 32, 32, HitType.HIT)],
        vulnerability: [new SphereCollisionVolume(16, 32, 32, HitType.HIT)],
        attackOnlyWhileAttacking: false,
      };

    // 64x64. Attack volume sits higher than the body - the skeleton swings.
    case 'skeleton':
      return {
        attack: [new SphereCollisionVolume(16, 48, 32, HitType.HIT)],
        vulnerability: [new SphereCollisionVolume(16, 32, 32, HitType.HIT)],
        attackOnlyWhileAttacking: true,
      };

    // 32x32.
    case 'karaguin':
      return {
        attack: [new SphereCollisionVolume(8, 16, 16, HitType.HIT)],
        vulnerability: [new SphereCollisionVolume(8, 16, 16, HitType.HIT)],
        attackOnlyWhileAttacking: false,
      };

    // 64x32.
    case 'bat':
      return {
        attack: [new SphereCollisionVolume(16, 32, 16, HitType.HIT)],
        vulnerability: [new SphereCollisionVolume(16, 32, 16, HitType.HIT)],
        attackOnlyWhileAttacking: false,
      };

    // 64x64, Sphere(16, 32, 16) in Y-up -> centerY 48 here.
    case 'sting':
      return {
        attack: [new SphereCollisionVolume(16, 32, 48, HitType.HIT)],
        vulnerability: [new SphereCollisionVolume(16, 32, 48, HitType.HIT)],
        attackOnlyWhileAttacking: false,
      };

    // 64x64.
    case 'onion':
      return {
        attack: [new SphereCollisionVolume(16, 32, 32, HitType.HIT)],
        vulnerability: [new SphereCollisionVolume(16, 32, 32, HitType.HIT)],
        attackOnlyWhileAttacking: false,
      };

    // 128x128 crusher. Invulnerable: AABox(64, 0, 64, 96) in Y-up, attack
    // frames only.
    case 'mudman':
      return {
        attack: [new AABoxCollisionVolume(64, 32, 64, 96, HitType.HIT)],
        vulnerability: null,
        attackOnlyWhileAttacking: true,
      };

    // 128x128 crusher. AABox(32, 0, 64, 32) in Y-up, attack frame only.
    case 'pink_namazu':
      return {
        attack: [new AABoxCollisionVolume(32, 96, 64, 32, HitType.HIT)],
        vulnerability: null,
        attackOnlyWhileAttacking: true,
      };

    // 64x64. Fires projectiles rather than touching the player, so it has a
    // vulnerability volume only.
    case 'turret':
      return {
        attack: null,
        vulnerability: [new SphereCollisionVolume(32, 32, 32, HitType.HIT)],
        attackOnlyWhileAttacking: false,
      };

    default:
      return null;
  }
}

/**
 * The attack volumes an enemy should present this frame.
 *
 * Enemies whose attack volume lives only on their attack frames present none
 * while patrolling, matching the original's per-frame volume data.
 */
export function selectEnemyAttackVolumes(
  profile: EnemyCollisionProfile,
  currentAction: ActionType
): CollisionVolume[] | null {
  if (!profile.attackOnlyWhileAttacking) return profile.attack;
  return currentAction === ActionType.ATTACK ? profile.attack : null;
}
