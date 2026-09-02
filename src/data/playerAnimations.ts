/**
 * Andou's animations, with his collision volumes on the frames.
 *
 * This is where the rendering rewrite pays off for the player. The original
 * keeps Andou's volumes on his `AnimationFrame`s: the STOMP frames carry a HIT
 * attack volume and *no* vulnerability volume (which is what makes a stomp beat
 * an enemy's contact damage), the glow frames carry a larger HIT sphere, and
 * every other frame carries only DEPRESS/COLLECT plus a vulnerability sphere.
 *
 * The port previously approximated that by swapping volume sets from
 * PlayerComponent's state each frame. Now the frames carry them, so
 * SpriteComponent hands them over as the animation plays — the same path every
 * other object uses.
 *
 * Frame lists are transcribed from Game.tsx's render branch; the volumes come
 * from playerCollisionVolumes.ts, which holds the geometry from the original's
 * spawnPlayer().
 *
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 * (spawnPlayer) and AnimationComponent.java
 */

import { createPlayerVolumeSets, type PlayerVolumeState } from '../entities/playerCollisionVolumes';
import type { AnimationDefinition, SpriteFrame } from '../types';

/** The port's player art is 64x64 over a 32x48 collision box. */
const SPRITE_SIZE = 64;
/**
 * Centre the 64x64 art on the 32x48 box: -16 horizontally, and -16 vertically
 * so the sprite's feet line up with the box's.
 */
const OFFSET = -16;

/**
 * The original's frame hold times. Most of Andou's frames run at 24 FPS
 * (`Utils.framesToTime(24, 1)`), but three animations are given explicit
 * seconds instead: the idle holds a full second, the hit reaction a tenth, and
 * the tail of the death explosion runs at half speed.
 */
const FRAME = 1 / 24;
const IDLE_HOLD = 1.0;
const HIT_HOLD = 0.1;

/** Every animation Andou can be in, named as PlayerComponent selects them. */
export type PlayerAnimationName =
  | 'idle' | 'move' | 'move_fast'
  | 'boost_up' | 'boost_move' | 'boost_move_fast'
  | 'fall' | 'fall_move' | 'fall_fast'
  | 'stomp' | 'hit' | 'dead' | 'charge';

interface PlayerArt {
  frames: string[];
  loop: boolean;
  /** Which volume set these frames carry. */
  volumes: PlayerVolumeState;
  /** Hold time per frame, in seconds. One entry per frame. */
  durations: number[];
}

const PLAYER_ART: Record<PlayerAnimationName, PlayerArt> = {
  // A full second per frame: Andou stands very still.
  idle: { frames: ['andou_stand'], loop: false, volumes: 'normal', durations: [IDLE_HOLD] },
  move: { frames: ['andou_diag01'], loop: false, volumes: 'normal', durations: [FRAME] },
  move_fast: { frames: ['andou_diagmore01'], loop: false, volumes: 'normal', durations: [FRAME] },
  boost_up: {
    frames: ['andou_flyup02', 'andou_flyup03'],
    loop: true, volumes: 'normal', durations: [FRAME, FRAME],
  },
  boost_move: {
    frames: ['andou_diag02', 'andou_diag03'],
    loop: true, volumes: 'normal', durations: [FRAME, FRAME],
  },
  boost_move_fast: {
    frames: ['andou_diagmore02', 'andou_diagmore03'],
    loop: true, volumes: 'normal', durations: [FRAME, FRAME],
  },
  // The original has no separate falling animations; these reuse the moving
  // art, and PlayerComponent selects them from vertical velocity.
  fall: { frames: ['andou_flyup01'], loop: false, volumes: 'normal', durations: [FRAME] },
  fall_move: { frames: ['andou_diag01'], loop: false, volumes: 'normal', durations: [FRAME] },
  fall_fast: { frames: ['andou_diagmore01'], loop: false, volumes: 'normal', durations: [FRAME] },
  charge: { frames: ['andou_flyup01'], loop: false, volumes: 'normal', durations: [FRAME] },
  // The stomp is the attack: HIT volume on, vulnerability off.
  stomp: {
    frames: ['andou_stomp01', 'andou_stomp02', 'andou_stomp03', 'andou_stomp04'],
    loop: false,
    volumes: 'stomping',
    durations: [FRAME, FRAME, FRAME, FRAME],
  },
  hit: { frames: ['andou_hit'], loop: false, volumes: 'normal', durations: [HIT_HOLD] },
  // Andou flickers between his two dying frames and then blows up. The port
  // used to stop after those two frames and never load the explosion at all,
  // though all twelve of its sprites ship with the game.
  dead: {
    frames: [
      'andou_die01', 'andou_die02', 'andou_die01', 'andou_die02',
      'andou_explode01', 'andou_explode02', 'andou_explode03', 'andou_explode04',
      'andou_explode05', 'andou_explode06', 'andou_explode07', 'andou_explode08',
      'andou_explode09', 'andou_explode10', 'andou_explode11', 'andou_explode12',
    ],
    loop: false,
    volumes: 'normal',
    durations: [
      FRAME, FRAME, FRAME, FRAME,
      FRAME, FRAME, FRAME, FRAME,
      FRAME * 2, FRAME * 2, FRAME * 2, FRAME * 2,
      FRAME * 2, FRAME * 2, FRAME * 2, FRAME * 2,
    ],
  },
};

/**
 * Build Andou's animations. The glow powerup swaps the whole set for one whose
 * frames carry the larger HIT sphere, which is how the original expresses it:
 * a separate set of glowing frames rather than a flag.
 */
export function createPlayerAnimations(
  glowing: boolean = false
): Map<PlayerAnimationName, AnimationDefinition> {
  const volumeSets = createPlayerVolumeSets();
  const animations = new Map<PlayerAnimationName, AnimationDefinition>();

  for (const [name, art] of Object.entries(PLAYER_ART) as Array<[PlayerAnimationName, PlayerArt]>) {
    // Stomping keeps its own volumes even while glowing - it is the attack.
    const state: PlayerVolumeState = art.volumes === 'stomping'
      ? 'stomping'
      : glowing ? 'glowing' : 'normal';
    const set = volumeSets[state];

    const frames: SpriteFrame[] = art.frames.map((sprite, index) => ({
      x: 0,
      y: 0,
      width: SPRITE_SIZE,
      height: SPRITE_SIZE,
      duration: art.durations[index] ?? FRAME,
      sprite,
      offsetX: OFFSET,
      offsetY: OFFSET,
      attackVolumes: set.attack as SpriteFrame['attackVolumes'],
      vulnerabilityVolumes: set.vulnerability as SpriteFrame['vulnerabilityVolumes'],
    }));

    animations.set(name, { name, frames, loop: art.loop });
  }

  return animations;
}

/**
 * Pick Andou's animation from his state, exactly as the render branch did.
 *
 * Ported from the original's AnimationComponent, which reads the same
 * combination of state, ground contact, jets and speed.
 */
export function selectPlayerAnimation(state: {
  hitReacting: boolean;
  dying: boolean;
  stomping: boolean;
  charging: boolean;
  touchingGround: boolean;
  rocketsOn: boolean;
  velocityX: number;
  velocityY: number;
}): PlayerAnimationName {
  if (state.hitReacting) return 'hit';
  if (state.dying) return 'dead';
  if (state.stomping) return 'stomp';
  if (state.charging) return 'charge';

  const speed = Math.abs(state.velocityX);

  if (state.touchingGround) {
    if (speed < 30) return 'idle';
    return speed > 200 ? 'move_fast' : 'move';
  }

  if (state.rocketsOn) {
    if (speed < 50 && state.velocityY < -50) return 'boost_up';
    return speed > 100 ? 'boost_move_fast' : 'boost_move';
  }

  if (speed < 10) return 'fall';
  return speed > 100 ? 'fall_fast' : 'fall_move';
}
