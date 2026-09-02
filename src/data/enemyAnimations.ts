/**
 * Enemy animations, as frame lists with their collision volumes attached.
 *
 * These were a 200-line switch inside `Game.tsx`'s render callback, which
 * picked a list of sprite names from the object's action and velocity every
 * frame. That is `EnemyAnimationComponent`'s job, and the frames themselves
 * belong on `SpriteComponent` — which is also where the original keeps each
 * frame's attack and vulnerability volumes.
 *
 * Building the animations here lets the volumes ride on the frames the way the
 * original ships them: a skeleton's attack volume only exists on the two frames
 * where the swing connects, and a mudman never carries a vulnerability volume
 * at all.
 *
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 */

import { EnemyAnimation } from '../entities/components/EnemyAnimationComponent';
import { createEnemyCollisionProfile } from '../entities/enemyCollisionProfiles';
import type { AnimationDefinition, SpriteFrame } from '../types';

/** 24 FPS, matching the original's Utils.framesToTime(24, n). */
const FRAME = 1 / 24;

interface EnemyArt {
  width: number;
  height: number;
  idle: string[];
  walk?: string[];
  attack?: string[];
  /**
   * Indices into `attack` whose frames carry the attack volume. The original
   * puts it on only the frames where the blow lands; omit for enemies that are
   * dangerous throughout.
   */
  attackContactFrames?: number[];
  death?: string[];
}

/** Frame lists transcribed from Game.tsx's render switch. */
const ENEMY_ART: Record<string, EnemyArt> = {
  bat: { width: 64, height: 32, idle: ['bat01', 'bat02', 'bat03', 'bat04'] },
  sting: { width: 64, height: 64, idle: ['sting01', 'sting02', 'sting03'] },
  onion: { width: 64, height: 64, idle: ['onion01', 'onion02', 'onion03'] },
  karaguin: { width: 32, height: 32, idle: ['karaguin01', 'karaguin02', 'karaguin03'] },
  brobot: {
    width: 64,
    height: 64,
    idle: ['brobot_idle01', 'brobot_idle02', 'brobot_idle03'],
    walk: ['brobot_walk01', 'brobot_walk02', 'brobot_walk03'],
  },
  skeleton: {
    width: 64,
    height: 64,
    idle: ['skeleton_stand'],
    walk: [
      'skeleton_walk01', 'skeleton_walk02', 'skeleton_walk03',
      'skeleton_walk04', 'skeleton_walk05',
    ],
    attack: ['skeleton_attack01', 'skeleton_attack03', 'skeleton_attack04'],
    // Original: only the last two attack frames carry basicAttackVolume.
    attackContactFrames: [1, 2],
  },
  snailbomb: {
    width: 64,
    height: 64,
    idle: ['snailbomb_stand'],
    walk: ['snailbomb_walk01', 'snailbomb_walk02'],
    attack: ['snailbomb_shoot01', 'snailbomb_shoot02'],
  },
  mudman: {
    width: 128,
    height: 128,
    idle: ['mudman_stand', 'mudman_idle01', 'mudman_idle02'],
    walk: [
      'mudman_walk01', 'mudman_walk02', 'mudman_walk03',
      'mudman_walk04', 'mudman_walk05', 'mudman_walk06',
    ],
    attack: [
      'mudman_attack01', 'mudman_attack02', 'mudman_attack03', 'mudman_attack04',
      'mudman_attack05', 'mudman_attack06', 'mudman_attack07',
    ],
    // Original: crushAttackVolume rides the later attack frames only.
    attackContactFrames: [4, 5, 6],
  },
  pink_namazu: {
    width: 128,
    height: 128,
    idle: ['pinknamazu_sleep01', 'pinknamazu_sleep02'],
    walk: ['pinknamazu_eyeopen', 'pinknamazu_stand'],
    attack: ['pinknamazu_jump'],
  },
  shadowslime: {
    width: 64,
    height: 64,
    idle: ['shadowslime_idle01', 'shadowslime_idle02'],
  },
  turret: {
    width: 64,
    height: 64,
    idle: ['object_gunturret01', 'object_gunturret_idle'],
    attack: ['object_gunturret02', 'object_gunturret01', 'object_gunturret03'],
  },
};

function makeFrames(
  names: string[],
  art: EnemyArt,
  options: { attackVolumes?: unknown; vulnerabilityVolumes?: unknown; contactFrames?: number[] }
): SpriteFrame[] {
  return names.map((sprite, index) => {
    const carriesAttack = options.contactFrames
      ? options.contactFrames.includes(index)
      : options.attackVolumes !== undefined;

    return {
      x: 0,
      y: 0,
      width: art.width,
      height: art.height,
      duration: FRAME * 3,
      sprite,
      // `null` clears the volumes on frames that should not have them, which is
      // what makes an enemy harmless between swings.
      attackVolumes: (carriesAttack ? options.attackVolumes : null) as SpriteFrame['attackVolumes'],
      vulnerabilityVolumes: options.vulnerabilityVolumes as SpriteFrame['vulnerabilityVolumes'],
    };
  });
}

/**
 * Build the animation set for an enemy, with each frame carrying the collision
 * volumes it should. Returns null for subTypes with no art here (bosses and
 * scripted characters own their own animations).
 */
export function createEnemyAnimations(
  subType: string
): Map<EnemyAnimation, AnimationDefinition> | null {
  const art = ENEMY_ART[subType];
  if (!art) return null;

  const profile = createEnemyCollisionProfile(subType);
  const vulnerability = profile?.vulnerability ?? null;
  const attack = profile?.attack ?? null;
  // Enemies that are dangerous on every frame carry their attack volume on the
  // idle and walk animations too; the rest only carry it while attacking.
  const alwaysHostile = profile ? !profile.attackOnlyWhileAttacking : false;

  const animations = new Map<EnemyAnimation, AnimationDefinition>();

  animations.set(EnemyAnimation.IDLE, {
    name: 'idle',
    frames: makeFrames(art.idle, art, {
      attackVolumes: alwaysHostile ? attack : null,
      vulnerabilityVolumes: vulnerability,
    }),
    loop: true,
  });

  if (art.walk) {
    animations.set(EnemyAnimation.MOVE, {
      name: 'walk',
      frames: makeFrames(art.walk, art, {
        attackVolumes: alwaysHostile ? attack : null,
        vulnerabilityVolumes: vulnerability,
      }),
      loop: true,
    });
  }

  if (art.attack) {
    animations.set(EnemyAnimation.ATTACK, {
      name: 'attack',
      frames: makeFrames(art.attack, art, {
        attackVolumes: attack,
        vulnerabilityVolumes: vulnerability,
        contactFrames: art.attackContactFrames,
      }),
      loop: !art.attackContactFrames,
    });
  }

  return animations;
}

/** Sprite dimensions for an enemy, or null when it has no art here. */
export function getEnemyArtSize(subType: string): { width: number; height: number } | null {
  const art = ENEMY_ART[subType];
  return art ? { width: art.width, height: art.height } : null;
}
