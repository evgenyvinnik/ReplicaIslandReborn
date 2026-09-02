/**
 * Animations for the objects that just play one loop: collectibles, blocks,
 * signs, cannons, spawners, the ghost.
 *
 * These were another slice of `Game.tsx`'s render switch. None of them changes
 * animation with state, so each is a single looping definition that
 * `SpriteComponent` can play without an animation-selection component.
 *
 * Frame lists and draw offsets are transcribed from that switch.
 */

import type { AnimationDefinition, SpriteFrame } from '../types';

/** 24 FPS, matching the original's Utils.framesToTime(24, n). */
const FRAME = 1 / 24;

interface ObjectArt {
  frames: string[];
  /** Drawn size; the collectibles' art is 32x32 like their objects. */
  width: number;
  height: number;
  /**
   * Draw offset as a fraction of the object's own size. The collectibles were
   * drawn at -width/2, -height/2 so their art centres on the object's origin.
   */
  centred?: boolean;
  /** Art centred within the object's own box, as the terminals are. */
  centreOnObject?: boolean;
  /** Seconds per frame; defaults to the 24 FPS the rest of the game uses. */
  frameTime?: number;
  /**
   * Per-frame hold times in the original's 24 FPS units, one per frame. Where
   * this is absent every frame gets the same `frameTime`, which is what the
   * whole file used to do - the original almost never holds frames evenly.
   */
  frameTimes?: number[];
  /** The cannonball's single frame does not loop. */
  loop?: boolean;
}

const OBJECT_ART: Record<string, ObjectArt> = {
  // spawnPlayerGhost animates the energy ball; `ghost.png` ships with the
  // original but nothing in its code ever draws it.
  ghost: {
    frames: [
      'effect_energyball01', 'effect_energyball02',
      'effect_energyball03', 'effect_energyball04',
    ],
    width: 64, height: 64,
    frameTimes: [1, 1, 1, 1],
  },
  // The coin rests on its first frame for over a second and then glints - it
  // does not spin evenly, which is what a uniform frame time made it do.
  coin: {
    frames: ['coin01', 'coin02', 'coin03', 'coin04', 'coin05'],
    width: 32,
    height: 32,
    centred: true,
    frameTimes: [30, 2, 2, 1, 2],
  },
  // The original's ruby cycle starts at ruby02; ruby01 is not in it.
  ruby: {
    frames: ['ruby02', 'ruby03', 'ruby04', 'ruby05'],
    width: 32,
    height: 32,
    centred: true,
    frameTimes: [2, 1, 1, 2],
  },
  // The port spawns no pearls from level data, but the fallback test level does.
  pearl: {
    frames: ['ruby02', 'ruby03', 'ruby04', 'ruby05'],
    width: 32,
    height: 32,
    centred: true,
    frameTimes: [2, 1, 1, 2],
  },
  diary: {
    frames: ['diary02', 'diary01', 'diary02', 'diary03', 'diary04', 'diary05', 'diary06'],
    width: 32,
    height: 32,
    centred: true,
    frameTimes: [2, 2, 2, 2, 2, 2, 2],
  },
  breakable_block: { frames: ['debris_block'], width: 32, height: 32, frameTimes: [1] },
  hint_sign: { frames: ['object_sign'], width: 32, height: 32, frameTimes: [1] },
  cannon: { frames: ['object_cannon'], width: 64, height: 64, frameTimes: [1] },
  spawner: { frames: ['object_brobot_machine'], width: 64, height: 64, frameTimes: [1] },
};

/** Objects whose art depends on their subType, keyed `type:subType`. */
const SUBTYPE_ART: Record<string, ObjectArt> = {
  // spawnEnemyAndouDead draws the last explosion frame.
  'decoration:andou_dead': {
    frames: ['andou_dead'], width: 64, height: 64, frameTimes: [1],
  },
  'decoration:kyle_dead': {
    frames: ['kyle_dead'], width: 64, height: 64, frameTimes: [1],
  },
  // The terminals flicker rather than cycling: a nine-frame sequence that
  // revisits earlier frames.
  'terminal:kabocha': {
    frames: [
      'object_terminal_kabocha01', 'object_terminal_kabocha02',
      'object_terminal_kabocha01', 'object_terminal_kabocha03',
      'object_terminal_kabocha02', 'object_terminal_kabocha03',
      'object_terminal_kabocha02', 'object_terminal_kabocha01',
      'object_terminal_kabocha02',
    ],
    width: 64,
    height: 64,
    centreOnObject: true,
    frameTimes: [1, 2, 2, 1, 1, 1, 1, 1, 1],
  },
  'terminal:rokudou': {
    frames: [
      'object_terminal01', 'object_terminal02', 'object_terminal01',
      'object_terminal03', 'object_terminal02', 'object_terminal03',
      'object_terminal02', 'object_terminal01', 'object_terminal02',
    ],
    width: 64,
    height: 64,
    centreOnObject: true,
    frameTimes: [1, 2, 2, 1, 1, 1, 1, 1, 1],
  },
  'projectile:energy_ball': {
    frames: ['energy_ball01', 'energy_ball02', 'energy_ball03', 'energy_ball04'],
    width: 32, height: 32, centreOnObject: true, frameTimes: [1, 1, 1, 1],
  },
  'projectile:wanda_shot': {
    frames: ['energy_ball01', 'energy_ball02', 'energy_ball03', 'energy_ball04'],
    width: 32, height: 32, centreOnObject: true, frameTimes: [1, 1, 1, 1],
  },
  'projectile:cannon_ball': {
    frames: ['snail_bomb'],
    width: 32, height: 32, centreOnObject: true, frameTimes: [1], loop: false,
  },
  // spawnTurretBullet has its own art rather than the generic shot sprites.
  'projectile:turret_bullet': {
    frames: ['effect_bullet01', 'effect_bullet02'],
    width: 16, height: 16, centreOnObject: true, frameTimes: [1, 1],
  },
  // spawnBrobotBullet reuses the brobot's own walk frames.
  'projectile:brobot_bullet': {
    frames: ['brobot_walk01', 'brobot_walk02', 'brobot_walk03'],
    width: 32, height: 32, centreOnObject: true, frameTimes: [1, 1, 1],
  },
};

/**
 * The looping animation for an object type, or null when it is drawn some other
 * way (the player, enemies, NPCs, doors, buttons, terminals and projectiles all
 * pick their frames from state).
 */
export function createObjectAnimation(
  type: string,
  objectWidth: number,
  objectHeight: number,
  subType?: string
): AnimationDefinition | null {
  const art = (subType ? SUBTYPE_ART[`${type}:${subType}`] : undefined) ?? OBJECT_ART[type];
  if (!art) return null;

  let offsetX = 0;
  let offsetY = 0;
  if (art.centred) {
    offsetX = -objectWidth / 2;
    offsetY = -objectHeight / 2;
  } else if (art.centreOnObject) {
    offsetX = (objectWidth - art.width) / 2;
    offsetY = (objectHeight - art.height) / 2;
  }

  const frames: SpriteFrame[] = art.frames.map((sprite, index) => ({
    x: 0,
    y: 0,
    width: art.width,
    height: art.height,
    duration: art.frameTimes
      ? FRAME * art.frameTimes[index]
      : art.frameTime ?? FRAME * 3,
    sprite,
    offsetX,
    offsetY,
  }));

  return { name: type, frames, loop: art.loop ?? true };
}
