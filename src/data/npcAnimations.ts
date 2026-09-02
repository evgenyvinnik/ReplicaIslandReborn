/**
 * NPC animations — Wanda, Kyle and Kabocha.
 *
 * The last state-driven slice of `Game.tsx`'s render switch. Selection by
 * action, speed and whether the NPC is airborne is `NPCAnimationComponent`'s
 * job; these are the frames it plays.
 *
 * Frame lists are transcribed from that switch, including Kyle's walk cycle,
 * which runs forward and back through its frames to match the Android original.
 *
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 * (spawnEnemyWanda, spawnEnemyKyle, spawnEnemyKabocha)
 */

import { NPCAnimation } from '../entities/components/NPCAnimationComponent';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { HitType } from '../types';
import type { AnimationDefinition, SpriteFrame } from '../types';

/** 24 FPS, matching the original's Utils.framesToTime(24, n). */
const FRAME = 1 / 24;

/** All the NPC sprites are 64x128. */
const NPC_WIDTH = 64;
const NPC_HEIGHT = 128;

interface NpcArt {
  idle: string[];
  walk?: string[];
  runStart?: string[];
  run?: string[];
  jumpStart?: string[];
  jump?: string[];
  shoot?: string[];
  hit?: string[];
  surprised?: string[];
  death?: string[];
  /** Per-frame durations in the Android source's 24 FPS timing units. */
  durations?: Partial<Record<
    'idle' | 'walk' | 'runStart' | 'run' | 'jumpStart' | 'jump' |
    'shoot' | 'hit' | 'surprised' | 'death',
    number[]
  >>;
  shootLoop?: boolean;
  /** Art size, when it is not the usual 64x128. */
  width?: number;
  height?: number;
}

const NPC_ART: Record<string, NpcArt> = {
  wanda: {
    idle: ['enemy_wanda_stand'],
    walk: [
      'enemy_wanda_walk01', 'enemy_wanda_walk02', 'enemy_wanda_walk03',
      'enemy_wanda_walk04', 'enemy_wanda_walk05', 'enemy_wanda_walk04',
      'enemy_wanda_walk03', 'enemy_wanda_walk02',
    ],
    run: [
      'enemy_wanda_run01', 'enemy_wanda_run02', 'enemy_wanda_run03',
      'enemy_wanda_run04', 'enemy_wanda_run05', 'enemy_wanda_run06',
      'enemy_wanda_run07', 'enemy_wanda_run04', 'enemy_wanda_run08',
    ],
    jumpStart: [
      'enemy_wanda_run04', 'enemy_wanda_crouch',
      'enemy_wanda_jump01', 'enemy_wanda_jump01',
    ],
    // The Android factory intentionally reuses jump01 for both airborne frames.
    jump: ['enemy_wanda_jump01', 'enemy_wanda_jump01'],
    shoot: [
      'enemy_wanda_shoot01', 'enemy_wanda_shoot02', 'enemy_wanda_shoot03',
      'enemy_wanda_shoot04', 'enemy_wanda_shoot05', 'enemy_wanda_shoot06',
      'enemy_wanda_shoot07', 'enemy_wanda_shoot08', 'enemy_wanda_shoot09',
      'enemy_wanda_shoot02', 'enemy_wanda_shoot01',
    ],
    durations: {
      idle: [1],
      walk: [2, 2, 2, 2, 2, 2, 2, 2],
      run: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      jumpStart: [2, 1, 1, 1],
      jump: [1, 1],
      shoot: [2, 8, 1, 1, 1, 1, 1, 1, 2, 3, 3],
    },
  },
  kyle: {
    idle: ['enemy_kyle_stand'],
    // The Android walk cycle runs forward and back through its frames.
    walk: [
      'enemy_kyle_walk01', 'enemy_kyle_walk02', 'enemy_kyle_walk03', 'enemy_kyle_walk04',
      'enemy_kyle_walk03', 'enemy_kyle_walk02', 'enemy_kyle_walk01',
      'enemy_kyle_walk05', 'enemy_kyle_walk06', 'enemy_kyle_walk07',
      'enemy_kyle_walk06', 'enemy_kyle_walk05',
    ],
    runStart: ['enemy_kyle_crouch01', 'enemy_kyle_crouch02'],
    run: ['enemy_kyle_dash01', 'enemy_kyle_dash02'],
    jumpStart: ['enemy_kyle_crouch01', 'enemy_kyle_crouch02'],
    // Matches spawnEnemyKyle(), which uses jump01 for both animation frames.
    jump: ['enemy_kyle_jump01', 'enemy_kyle_jump01'],
    durations: {
      idle: [1],
      walk: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      runStart: [1, 3],
      run: [1, 1],
      jumpStart: [1, 3],
      jump: [1, 1],
    },
  },
  kabocha: {
    idle: ['kabocha_stand'],
    walk: [
      'kabocha_walk01', 'kabocha_walk02', 'kabocha_walk03',
      'kabocha_walk04', 'kabocha_walk05', 'kabocha_walk06',
    ],
    durations: {
      idle: [1],
      walk: [3, 3, 3, 3, 3, 3],
    },
  },
  // The bosses are NPCs in the original too, animated by the same component
  // and watching the same SURPRISED channel. Their art is 128x128.
  evil_kabocha: {
    idle: ['evil_kabocha_stand'],
    walk: [
      'evil_kabocha_walk01', 'evil_kabocha_walk02', 'evil_kabocha_walk03',
      'evil_kabocha_walk04', 'evil_kabocha_walk05', 'evil_kabocha_walk06',
    ],
    hit: ['evil_kabocha_hit01', 'evil_kabocha_hit02'],
    surprised: ['evil_kabocha_surprised'],
    death: [
      'evil_kabocha_die01', 'evil_kabocha_stand',
      'evil_kabocha_die02', 'evil_kabocha_die03', 'evil_kabocha_die04',
    ],
    durations: {
      idle: [1],
      walk: [3, 3, 3, 3, 3, 3],
      hit: [1, 10],
      surprised: [96],
      death: [6, 2, 2, 2, 6],
    },
    width: 128,
    height: 128,
  },
  rokudou: {
    idle: ['rokudou_stand'],
    // Rokudou flies rather than walks.
    walk: ['rokudou_fly01', 'rokudou_fly02'],
    run: ['rokudou_fly01', 'rokudou_fly02'],
    jump: ['rokudou_fly01', 'rokudou_fly02'],
    shoot: ['rokudou_shoot01', 'rokudou_shoot02'],
    hit: [
      'rokudou_hit01', 'rokudou_hit02', 'rokudou_hit03', 'rokudou_hit02',
      'rokudou_hit03', 'rokudou_hit02', 'rokudou_hit03',
    ],
    surprised: ['rokudou_surprise'],
    death: [
      'rokudou_stand', 'rokudou_die01', 'rokudou_die02',
      'rokudou_die03', 'rokudou_die04',
    ],
    durations: {
      idle: [1],
      // Original fly frames each last one full second.
      walk: [24, 24],
      run: [24, 24],
      jump: [24, 24],
      shoot: [2, 2],
      hit: [2, 1, 1, 1, 1, 1, 1],
      surprised: [96],
      death: [6, 2, 4, 6, 6],
    },
    shootLoop: true,
    width: 128,
    height: 128,
  },
};

function makeFrames(
  names: string[],
  objectWidth: number,
  objectHeight: number,
  art: NpcArt,
  durationFrames?: number[],
  attackVolumes?: SpriteFrame['attackVolumes'],
  vulnerabilityVolumes?: SpriteFrame['vulnerabilityVolumes']
): SpriteFrame[] {
  const spriteWidth = art.width ?? NPC_WIDTH;
  const spriteHeight = art.height ?? NPC_HEIGHT;
  // The art is centred on the object's own box.
  const offsetX = (objectWidth - spriteWidth) / 2;
  const offsetY = (objectHeight - spriteHeight) / 2;
  return names.map((sprite, index) => {
    const frame: SpriteFrame = {
      x: 0,
      y: 0,
      width: spriteWidth,
      height: spriteHeight,
      duration: FRAME * (durationFrames?.[index] ?? 3),
      sprite,
      offsetX,
      offsetY,
    };
    // Bosses configure their collision outside their animations, so omitted
    // values must stay undefined. Story NPC frames own their collision exactly
    // as the Android AnimationFrames do; null explicitly clears a dash attack.
    if (attackVolumes !== undefined) frame.attackVolumes = attackVolumes;
    if (vulnerabilityVolumes !== undefined) {
      frame.vulnerabilityVolumes = vulnerabilityVolumes;
    }
    return frame;
  });
}

/**
 * Animations for an NPC subType, or null when there is no art for it. NPCs with
 * no run or jump art fall back to their walk and idle frames, so
 * NPCAnimationComponent always has something to play.
 */
export function createNpcAnimations(
  subType: string,
  objectWidth: number,
  objectHeight: number
): Map<NPCAnimation, AnimationDefinition> | null {
  const art = NPC_ART[subType];
  if (!art) return null;

  const storyNpc = subType === 'wanda' || subType === 'kyle' || subType === 'kabocha';
  const vulnerability = storyNpc
    // Original Y-up AABox(20, 5, 26, 80), converted for a 128px Y-down object.
    ? [new AABoxCollisionVolume(20, 43, 26, 80, HitType.COLLECT)]
    : undefined;
  const kyleDashAttack = subType === 'kyle'
    // Original Y-up AABox(32, 32, 50, 32), converted to Y-down.
    ? [
      new AABoxCollisionVolume(32, 64, 50, 32, HitType.HIT),
      new AABoxCollisionVolume(32, 64, 50, 32, HitType.COLLECT),
    ]
    : undefined;

  const build = (
    names: string[],
    loop: boolean,
    attack: SpriteFrame['attackVolumes'] | undefined = storyNpc ? null : undefined,
    durations?: number[]
  ): AnimationDefinition => ({
    frames: makeFrames(names, objectWidth, objectHeight, art, durations, attack, vulnerability),
    loop,
  });

  const walk = art.walk ?? art.idle;
  const runStart = art.runStart ?? art.run ?? walk;
  const run = art.run ?? walk;
  const jumpStart = art.jumpStart ?? art.jump ?? art.idle;
  const jump = art.jump ?? art.idle;

  const animations = new Map<NPCAnimation, AnimationDefinition>();
  animations.set(NPCAnimation.IDLE, build(art.idle, true, undefined, art.durations?.idle));
  animations.set(NPCAnimation.WALK, build(walk, true, undefined, art.durations?.walk));
  animations.set(NPCAnimation.RUN_START, build(
    runStart, false, undefined, art.durations?.runStart ?? art.durations?.run ?? art.durations?.walk
  ));
  animations.set(NPCAnimation.RUN, build(run, true, kyleDashAttack, art.durations?.run ?? art.durations?.walk));
  animations.set(NPCAnimation.JUMP_START, build(
    jumpStart, false, undefined, art.durations?.jumpStart ?? art.durations?.jump ?? art.durations?.idle
  ));
  animations.set(NPCAnimation.JUMP_AIR, build(
    jump, true, undefined, art.durations?.jump ?? art.durations?.idle
  ));
  animations.set(NPCAnimation.TAKE_HIT, build(
    art.hit ?? art.idle, false, undefined, art.durations?.hit ?? art.durations?.idle
  ));
  animations.set(NPCAnimation.SURPRISED, build(
    art.surprised ?? art.idle, false, undefined, art.durations?.surprised ?? art.durations?.idle
  ));
  animations.set(NPCAnimation.DEATH, build(
    art.death ?? art.idle, false, undefined, art.durations?.death ?? art.durations?.idle
  ));
  if (art.shoot) {
    animations.set(NPCAnimation.SHOOT, build(
      art.shoot, art.shootLoop ?? false, undefined, art.durations?.shoot
    ));
  }

  return animations;
}
