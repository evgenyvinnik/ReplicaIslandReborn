/**
 * The player's collision volumes, selected by state.
 *
 * In the original these come from the current animation frame: Andou's STOMP
 * frames carry a HIT attack volume and *no* vulnerability volume (so stomping
 * is briefly invincible), the glow/invincible frames carry a larger HIT sphere,
 * and every other frame carries only the DEPRESS/COLLECT volumes plus a
 * vulnerability sphere.
 *
 * This port's SpriteComponent does not carry per-frame collision volumes, so a
 * fixed set assigned at spawn would leave the player permanently able to damage
 * anything it touched. Selecting the set from PlayerComponent's state
 * reproduces the original's behaviour without the per-frame animation data.
 *
 * The vulnerability volume is present only in the normal state. The original's
 * STOMP and glow frames pass null for vulnerability volumes, which is exactly
 * what makes a stomp beat an enemy's contact damage and what makes the glow
 * powerup invincible.
 *
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 * (spawnPlayer)
 */

import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import type { CollisionVolume } from '../engine/collision/CollisionVolume';
import { HitType } from '../types';

export type PlayerVolumeState = 'normal' | 'stomping' | 'glowing';

/**
 * Pick the volume set for the player's current state. Stomping wins over
 * glowing: the original's STOMP animation replaces the glow animation while it
 * is playing.
 */
export function selectPlayerVolumeState(stomping: boolean, glowing: boolean): PlayerVolumeState {
  if (stomping) return 'stomping';
  if (glowing) return 'glowing';
  return 'normal';
}

export interface PlayerVolumeSet {
  attack: CollisionVolume[];
  vulnerability: CollisionVolume[] | null;
}

/**
 * Stable volume sets for the player.
 *
 * The arrays are allocated once and reused: DynamicCollisionComponent only
 * recomputes its bounding volume when the array identity changes, so handing it
 * a fresh array every frame would throw away that optimisation.
 */
export function createPlayerVolumeSets(): Record<PlayerVolumeState, PlayerVolumeSet> {
  // Shared between states, matching the original's pressCollisionVolume and
  // collectionVolume which appear in every frame's attack list.
  //
  // The original's volumes are laid out on a 64x64 sprite in Y-up space with
  // the origin at the object's *bottom*; this port's player object is the
  // 32x48 body. X was rescaled when these were first written but Y was not,
  // which put the two volumes that belong at Andou's feet up at his head.
  // The conversion is  offsetY_down = 48 - (offsetY_up + height).
  //
  //   pressCollisionVolume  AABox(16, 0, 32, 16)  -> y 0..16 up   = 32..48 down
  //   collectionVolume      AABox(16, 0, 32, 48)  -> y 0..48 up   =  0..48 down
  const press = new AABoxCollisionVolume(0, 32, 32, 16, HitType.DEPRESS);
  const collect = new AABoxCollisionVolume(0, 0, 32, 48, HitType.COLLECT);

  return {
    normal: {
      attack: [press, collect],
      // Original: SphereCollisionVolume(16, 32, 32) on a 64x64 sprite, left
      // untyped so it accepts every hit type - that is what lets a cannon's
      // LAUNCH volume fire Andou and a HIT volume hurt him. This port's player
      // object is 32x48, so the sphere is centred on that body.
      vulnerability: [new SphereCollisionVolume(16, 16, 24)],
    },
    stomping: {
      // Original: AABoxCollisionVolume(16, -5, 32, 37, HIT). In its Y-up space
      // that spans y -5..32 - starting five pixels *below* the feet and
      // reaching up to mid-body, which is what makes a stomp land on whatever
      // Andou comes down on. Carried over unconverted it sat at -5..32 in
      // Y-down, i.e. above his head, so the stomp reached over an enemy
      // instead of into it: 48 - (-5 + 37) = 16.
      attack: [new AABoxCollisionVolume(0, 16, 32, 37, HitType.HIT), press, collect],
      vulnerability: null,
    },
    glowing: {
      attack: [new SphereCollisionVolume(40, 16, 24, HitType.HIT), press, collect],
      vulnerability: null,
    },
  };
}
