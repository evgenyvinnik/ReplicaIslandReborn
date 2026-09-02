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
import type { AnimationDefinition, SpriteFrame } from '../types';

/** 24 FPS, matching the original's Utils.framesToTime(24, n). */
const FRAME = 1 / 24;

/** All the NPC sprites are 64x128. */
const NPC_WIDTH = 64;
const NPC_HEIGHT = 128;

interface NpcArt {
  idle: string[];
  walk?: string[];
  run?: string[];
  jump?: string[];
  shoot?: string[];
}

const NPC_ART: Record<string, NpcArt> = {
  wanda: {
    idle: ['enemy_wanda_stand'],
    walk: [
      'enemy_wanda_walk01', 'enemy_wanda_walk02', 'enemy_wanda_walk03',
      'enemy_wanda_walk04', 'enemy_wanda_walk05',
    ],
    run: [
      'enemy_wanda_run01', 'enemy_wanda_run02', 'enemy_wanda_run03', 'enemy_wanda_run04',
      'enemy_wanda_run05', 'enemy_wanda_run06', 'enemy_wanda_run07', 'enemy_wanda_run08',
    ],
    jump: ['enemy_wanda_jump01', 'enemy_wanda_jump02'],
    shoot: [
      'enemy_wanda_shoot01', 'enemy_wanda_shoot02', 'enemy_wanda_shoot03',
      'enemy_wanda_shoot04', 'enemy_wanda_shoot05', 'enemy_wanda_shoot06',
      'enemy_wanda_shoot07', 'enemy_wanda_shoot08', 'enemy_wanda_shoot09',
      'enemy_wanda_shoot02', 'enemy_wanda_shoot01',
    ],
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
    run: ['enemy_kyle_dash01', 'enemy_kyle_dash02'],
    jump: ['enemy_kyle_jump01', 'enemy_kyle_jump02'],
  },
  kabocha: {
    idle: ['kabocha_stand'],
    walk: [
      'kabocha_walk01', 'kabocha_walk02', 'kabocha_walk03',
      'kabocha_walk04', 'kabocha_walk05', 'kabocha_walk06',
    ],
  },
};

function makeFrames(names: string[], objectWidth: number, objectHeight: number): SpriteFrame[] {
  // The art is centred on the object's own box.
  const offsetX = (objectWidth - NPC_WIDTH) / 2;
  const offsetY = (objectHeight - NPC_HEIGHT) / 2;
  return names.map((sprite) => ({
    x: 0,
    y: 0,
    width: NPC_WIDTH,
    height: NPC_HEIGHT,
    duration: FRAME * 3,
    sprite,
    offsetX,
    offsetY,
  }));
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

  const build = (names: string[], loop: boolean): AnimationDefinition =>
    ({ frames: makeFrames(names, objectWidth, objectHeight), loop });

  const walk = art.walk ?? art.idle;
  const run = art.run ?? walk;
  const jump = art.jump ?? art.idle;

  const animations = new Map<NPCAnimation, AnimationDefinition>();
  animations.set(NPCAnimation.IDLE, build(art.idle, true));
  animations.set(NPCAnimation.WALK, build(walk, true));
  animations.set(NPCAnimation.RUN_START, build(run, false));
  animations.set(NPCAnimation.RUN, build(run, true));
  animations.set(NPCAnimation.JUMP_START, build(jump, false));
  animations.set(NPCAnimation.JUMP_AIR, build(jump, true));
  animations.set(NPCAnimation.TAKE_HIT, build(art.idle, false));
  animations.set(NPCAnimation.SURPRISED, build(art.idle, false));
  animations.set(NPCAnimation.DEATH, build(art.idle, false));
  if (art.shoot) {
    animations.set(NPCAnimation.SHOOT, build(art.shoot, false));
  }

  return animations;
}
