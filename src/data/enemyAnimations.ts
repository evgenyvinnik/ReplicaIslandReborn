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
  /** Only the turret's firing animation loops in the original. */
  attackLoop?: boolean;
  hidden?: string[];
  appear?: string[];
  /**
   * Per-frame hold times in the original's 24 FPS units, one per frame of the
   * matching list. Omitted lists fall back to 3, which is what every animation
   * in this port used to use; almost nothing in the original actually does.
   */
  idleFrameTimes?: number[];
  walkFrameTimes?: number[];
  attackFrameTimes?: number[];
  hiddenFrameTimes?: number[];
  appearFrameTimes?: number[];
  /** The skeleton's and snailbomb's idles do not loop in the original. */
  idleLoop?: boolean;
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
  bat: {
    width: 64, height: 32,
    idle: ['bat01', 'bat02', 'bat03', 'bat04'],
    idleFrameTimes: [1, 1, 1, 1],
  },
  sting: {
    width: 64, height: 64,
    idle: ['sting01', 'sting02', 'sting03'],
    idleFrameTimes: [1, 1, 1],
  },
  onion: {
    width: 64, height: 64,
    // The original's idle is a single frame; only the walk cycles.
    idle: ['onion01'],
    idleFrameTimes: [3],
    walk: ['onion01', 'onion02', 'onion03'],
    walkFrameTimes: [1, 1, 1],
  },
  karaguin: {
    width: 32, height: 32,
    idle: ['karaguin01', 'karaguin02', 'karaguin03'],
    idleFrameTimes: [1, 1, 1],
  },
  brobot: {
    width: 64,
    height: 64,
    // The idle returns to idle02 rather than looping straight back.
    idle: ['brobot_idle01', 'brobot_idle02', 'brobot_idle03', 'brobot_idle02'],
    idleFrameTimes: [3, 1, 3, 3],
    walk: ['brobot_walk01', 'brobot_walk02', 'brobot_walk03'],
    walkFrameTimes: [1, 1, 1],
  },
  skeleton: {
    width: 64,
    height: 64,
    idle: ['skeleton_stand'],
    idleFrameTimes: [1],
    idleLoop: false,
    walk: [
      'skeleton_walk01', 'skeleton_walk02', 'skeleton_walk03',
      'skeleton_walk04', 'skeleton_walk05', 'skeleton_walk03',
    ],
    walkFrameTimes: [3, 4, 3, 3, 4, 3],
    attack: ['skeleton_attack01', 'skeleton_attack03', 'skeleton_attack04'],
    attackFrameTimes: [5, 1, 1],
    // Original: only the last two attack frames carry basicAttackVolume.
    attackContactFrames: [1, 2],
  },
  snailbomb: {
    width: 64,
    height: 64,
    idle: ['snailbomb_stand'],
    idleFrameTimes: [3],
    idleLoop: false,
    // The walk leans out and back rather than cycling one direction.
    walk: [
      'snailbomb_stand', 'snailbomb_walk01', 'snailbomb_walk02',
      'snailbomb_walk01', 'snailbomb_stand',
    ],
    walkFrameTimes: [2, 2, 6, 2, 2],
    attack: ['snailbomb_shoot01', 'snailbomb_shoot02'],
    attackFrameTimes: [3, 2],
  },
  mudman: {
    width: 128,
    height: 128,
    // The original idles on a single held frame; the port had invented two more.
    idle: ['mudman_stand'],
    idleFrameTimes: [12],
    walk: [
      'mudman_walk01', 'mudman_walk02', 'mudman_walk03',
      'mudman_walk04', 'mudman_walk05', 'mudman_walk06',
    ],
    walkFrameTimes: [4, 4, 5, 4, 4, 5],
    // The wind-up starts from the standing frame, which the port was missing -
    // without it attackContactFrames pointed one frame too late, so the blow
    // landed on the recovery frame instead of the slam.
    attack: [
      'mudman_stand',
      'mudman_attack01', 'mudman_attack02', 'mudman_attack03', 'mudman_attack04',
      'mudman_attack05', 'mudman_attack06', 'mudman_attack07',
    ],
    attackFrameTimes: [2, 2, 2, 2, 1, 1, 8, 5],
    // Original: crushAttackVolume rides attack04, attack05 and attack06.
    attackContactFrames: [4, 5, 6],
  },
  pink_namazu: {
    width: 128,
    height: 128,
    // Asleep: breathing, with a long hold on each end.
    idle: [
      'pinknamazu_stand', 'pinknamazu_sleep01',
      'pinknamazu_sleep02', 'pinknamazu_sleep01',
    ],
    idleFrameTimes: [8, 3, 8, 3],
    // The original calls this "wake" - the eye-open blink before the slam.
    walk: [
      'pinknamazu_eyeopen', 'pinknamazu_stand',
      'pinknamazu_eyeopen', 'pinknamazu_stand',
    ],
    walkFrameTimes: [3, 3, 3, 3],
    attack: ['pinknamazu_jump'],
    attackFrameTimes: [2],
  },
  shadowslime: {
    width: 64,
    height: 64,
    idle: ['shadowslime_idle01', 'shadowslime_idle02'],
    idleFrameTimes: [3, 3],
    appear: [
      'shadowslime_activate01', 'shadowslime_activate02', 'shadowslime_activate03',
      'shadowslime_activate04', 'shadowslime_activate05', 'shadowslime_activate06',
    ],
    appearFrameTimes: [2, 2, 1, 1, 2, 1],
    hidden: [
      'shadowslime_activate06', 'shadowslime_activate05', 'shadowslime_activate04',
      'shadowslime_activate03', 'shadowslime_activate02', 'shadowslime_activate01',
    ],
    hiddenFrameTimes: [1, 2, 1, 1, 2, 2],
    attack: [
      'shadowslime_attack01', 'shadowslime_attack02', 'shadowslime_attack03',
      'shadowslime_attack04', 'shadowslime_flash', 'shadowslime_attack04',
      'shadowslime_flash', 'shadowslime_attack03', 'shadowslime_attack02',
      'shadowslime_attack01',
    ],
    attackFrameTimes: [2, 2, 2, 6, 1, 1, 1, 3, 3, 2],
  },
  turret: {
    width: 64,
    height: 64,
    // The original idles on the closed barrel alone.
    idle: ['object_gunturret_idle'],
    idleFrameTimes: [1],
    attack: [
      'object_gunturret02', 'object_gunturret01',
      'object_gunturret03', 'object_gunturret01',
    ],
    attackFrameTimes: [1, 1, 2, 1],
    attackLoop: true,
  },
};

function makeFrames(
  names: string[],
  art: EnemyArt,
  options: {
    attackVolumes?: unknown;
    vulnerabilityVolumes?: unknown;
    contactFrames?: number[];
    frameTimes?: number[];
  }
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
      duration: FRAME * (options.frameTimes?.[index] ?? 3),
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
      frameTimes: art.idleFrameTimes,
    }),
    loop: art.idleLoop ?? true,
  });

  if (art.walk) {
    animations.set(EnemyAnimation.MOVE, {
      name: 'walk',
      frames: makeFrames(art.walk, art, {
        attackVolumes: alwaysHostile ? attack : null,
        vulnerabilityVolumes: vulnerability,
        frameTimes: art.walkFrameTimes,
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
        frameTimes: art.attackFrameTimes,
      }),
      loop: art.attackLoop ?? false,
    });
  }

  if (art.hidden) {
    animations.set(EnemyAnimation.HIDDEN, {
      name: 'hidden',
      frames: makeFrames(art.hidden, art, {
        attackVolumes: alwaysHostile ? attack : null,
        vulnerabilityVolumes: vulnerability,
        frameTimes: art.hiddenFrameTimes,
      }),
      loop: false,
    });
  }

  if (art.appear) {
    animations.set(EnemyAnimation.APPEAR, {
      name: 'appear',
      frames: makeFrames(art.appear, art, {
        attackVolumes: alwaysHostile ? attack : null,
        vulnerabilityVolumes: vulnerability,
        frameTimes: art.appearFrameTimes,
      }),
      loop: false,
    });
  }

  return animations;
}

/** Sprite dimensions for an enemy, or null when it has no art here. */
export function getEnemyArtSize(subType: string): { width: number; height: number } | null {
  const art = ENEMY_ART[subType];
  return art ? { width: art.width, height: art.height } : null;
}
