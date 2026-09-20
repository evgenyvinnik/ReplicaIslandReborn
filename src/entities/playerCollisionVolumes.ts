/**
 * Andou's body volumes live on animation frames. The glow is a separate
 * attack-only collider: it must not replace body vulnerability, which receives
 * cannon LAUNCH and hazard DEATH hits. HitReaction supplies glow HIT immunity.
 *
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 * (spawnPlayer)
 */

import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import type { CollisionVolume } from '../engine/collision/CollisionVolume';
import { HitType } from '../types';

export type PlayerVolumeState = 'normal' | 'stomping';

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
      attack: [collect, press],
      // Original: SphereCollisionVolume(16, 32, 32) on a 64x64 sprite, left
      // untyped so it accepts every hit type - that is what lets a cannon's
      // LAUNCH volume fire Andou and a HIT volume hurt him. This port's player
      // object's origin is shifted right 16px; Y converts from its feet:
      // (32 - 16, 48 - 32). This is not the centre of the 32x48 body.
      vulnerability: [new SphereCollisionVolume(16, 16, 16)],
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
  };
}

/** Original PLAYER_GLOW: radius 40, centre (40, 40) in the 64px Y-up sprite. */
export function createPlayerGlowVolumes(): PlayerVolumeSet {
  return {
    // Body origin is 16px right of the original origin; Y converts from the feet.
    attack: [new SphereCollisionVolume(40, 40 - 16, 48 - 40, HitType.HIT)],
    vulnerability: null,
  };
}
