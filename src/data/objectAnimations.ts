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
}

const OBJECT_ART: Record<string, ObjectArt> = {
  ghost: { frames: ['ghost'], width: 64, height: 64 },
  coin: {
    frames: ['coin01', 'coin02', 'coin03', 'coin04', 'coin05'],
    width: 32,
    height: 32,
    centred: true,
  },
  ruby: {
    frames: ['ruby01', 'ruby02', 'ruby03', 'ruby04', 'ruby05'],
    width: 32,
    height: 32,
    centred: true,
  },
  // The port spawns no pearls from level data, but the fallback test level does.
  pearl: {
    frames: ['ruby01', 'ruby02', 'ruby03', 'ruby04', 'ruby05'],
    width: 32,
    height: 32,
    centred: true,
  },
  diary: { frames: ['diary01'], width: 32, height: 32, centred: true },
  breakable_block: { frames: ['debris_block'], width: 32, height: 32 },
  hint_sign: { frames: ['object_sign'], width: 32, height: 32 },
  cannon: { frames: ['object_cannon'], width: 64, height: 64 },
  spawner: { frames: ['object_brobot_machine'], width: 64, height: 64 },
};

/** Objects whose art depends on their subType, keyed `type:subType`. */
const SUBTYPE_ART: Record<string, ObjectArt> = {
  'decoration:andou_dead': { frames: ['andou_dead'], width: 64, height: 64 },
  'decoration:kyle_dead': { frames: ['kyle_dead'], width: 64, height: 64 },
  'terminal:kabocha': {
    frames: ['object_terminal_kabocha01', 'object_terminal_kabocha02', 'object_terminal_kabocha03'],
    width: 64,
    height: 64,
    centreOnObject: true,
  },
  'terminal:rokudou': {
    frames: ['object_terminal01', 'object_terminal02', 'object_terminal03'],
    width: 64,
    height: 64,
    centreOnObject: true,
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

  const frames: SpriteFrame[] = art.frames.map((sprite) => ({
    x: 0,
    y: 0,
    width: art.width,
    height: art.height,
    duration: FRAME * 3,
    sprite,
    offsetX,
    offsetY,
  }));

  return { name: type, frames, loop: true };
}
