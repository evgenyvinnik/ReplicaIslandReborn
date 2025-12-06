/**
 * Animation System - Manages sprite animations
 * Ported from: Original/src/com/replica/replicaisland/SpriteAnimation.java
 *              Original/src/com/replica/replicaisland/AnimationFrame.java
 *              Original/src/com/replica/replicaisland/AnimationComponent.java
 */

/**
 * Animation frame data
 */
export interface AnimationFrame {
  /** Sprite name for this frame */
  sprite: string;
  /** Frame index within the sprite sheet */
  frameIndex: number;
  /** Duration this frame is displayed (in seconds) */
  holdTime: number;
  /** X offset for rendering */
  offsetX: number;
  /** Y offset for rendering */
  offsetY: number;
  /** Width of the frame */
  width: number;
  /** Height of the frame */
  height: number;
}

/**
 * Animation definition - a sequence of frames
 */
export interface SpriteAnimation {
  /** Animation ID */
  id: number;
  /** Name of this animation */
  name: string;
  /** Frames in this animation */
  frames: AnimationFrame[];
  /** Whether the animation loops */
  loop: boolean;
  /** Total duration of the animation */
  length: number;
  /** Frame start times for fast lookup */
  frameStartTimes: number[];
}

/**
 * Player animation types
 */
export const PlayerAnimations = {
  IDLE: 0,
  MOVE: 1,
  MOVE_FAST: 2,
  BOOST_UP: 3,
  BOOST_MOVE: 4,
  BOOST_MOVE_FAST: 5,
  STOMP: 6,
  HIT_REACT: 7,
  DEATH: 8,
  FROZEN: 9,
} as const;

/**
 * Enemy animation types
 */
export const EnemyAnimations = {
  IDLE: 0,
  MOVE: 1,
  ATTACK: 2,
  HIT_REACT: 3,
  DEATH: 4,
  HIDDEN: 5,
} as const;

/**
 * Create an animation frame
 */
export function createAnimationFrame(
  sprite: string,
  frameIndex: number,
  holdTime: number,
  offsetX: number = 0,
  offsetY: number = 0,
  width: number = 64,
  height: number = 64
): AnimationFrame {
  return {
    sprite,
    frameIndex,
    holdTime,
    offsetX,
    offsetY,
    width,
    height,
  };
}

/**
 * Create a sprite animation
 */
export function createSpriteAnimation(
  id: number,
  name: string,
  frames: AnimationFrame[],
  loop: boolean = true
): SpriteAnimation {
  let length = 0;
  const frameStartTimes: number[] = [];

  for (const frame of frames) {
    frameStartTimes.push(length);
    length += frame.holdTime;
  }

  return {
    id,
    name,
    frames,
    loop,
    length,
    frameStartTimes,
  };
}

/**
 * Animation System
 * Manages animation playback and frame selection
 */
export class AnimationSystem {
  // Registered animations by name
  private animations: Map<string, SpriteAnimation> = new Map();
  
  // Animation sets by entity type
  private animationSets: Map<string, Map<number, SpriteAnimation>> = new Map();

  // Cutoff for using binary search vs linear search
  private static readonly LINEAR_SEARCH_CUTOFF = 16;

  /**
   * Register an animation
   */
  registerAnimation(animation: SpriteAnimation): void {
    this.animations.set(animation.name, animation);
  }

  /**
   * Register an animation set for an entity type
   */
  registerAnimationSet(entityType: string, animationId: number, animation: SpriteAnimation): void {
    if (!this.animationSets.has(entityType)) {
      this.animationSets.set(entityType, new Map());
    }
    this.animationSets.get(entityType)!.set(animationId, animation);
  }

  /**
   * Get an animation by name
   */
  getAnimation(name: string): SpriteAnimation | undefined {
    return this.animations.get(name);
  }

  /**
   * Get an animation from an entity's animation set
   */
  getAnimationFromSet(entityType: string, animationId: number): SpriteAnimation | undefined {
    const set = this.animationSets.get(entityType);
    if (!set) return undefined;
    return set.get(animationId);
  }

  /**
   * Get the current frame for an animation at a given time
   */
  getFrame(animation: SpriteAnimation, animationTime: number): AnimationFrame | null {
    if (animation.length <= 0 || animation.frames.length === 0) {
      return null;
    }

    const frameCount = animation.frames.length;
    let result = animation.frames[frameCount - 1];

    if (frameCount > 1) {
      let cycleTime = animationTime;
      
      if (animation.loop) {
        cycleTime = animationTime % animation.length;
      }

      if (cycleTime < animation.length) {
        // Use binary search for large animations, linear for small
        if (animation.frameStartTimes.length > AnimationSystem.LINEAR_SEARCH_CUTOFF) {
          let index = this.binarySearchFrames(animation.frameStartTimes, cycleTime);
          if (index < 0) {
            index = -(index + 1) - 1;
          }
          result = animation.frames[Math.max(0, index)];
        } else {
          let currentTime = 0;
          for (let i = 0; i < frameCount; i++) {
            const frame = animation.frames[i];
            currentTime += frame.holdTime;
            if (currentTime > cycleTime) {
              result = frame;
              break;
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Binary search for frame index
   */
  private binarySearchFrames(times: number[], target: number): number {
    let low = 0;
    let high = times.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midVal = times[mid];

      if (midVal < target) {
        low = mid + 1;
      } else if (midVal > target) {
        high = mid - 1;
      } else {
        return mid;
      }
    }

    return -(low + 1);
  }

  /**
   * Check if an animation has finished (for non-looping animations)
   */
  isAnimationFinished(animation: SpriteAnimation, animationTime: number): boolean {
    if (animation.loop) {
      return false;
    }
    return animationTime >= animation.length;
  }

  /**
   * Get the normalized progress of an animation (0.0 to 1.0)
   */
  getAnimationProgress(animation: SpriteAnimation, animationTime: number): number {
    if (animation.length <= 0) {
      return 0;
    }

    if (animation.loop) {
      return (animationTime % animation.length) / animation.length;
    }

    return Math.min(animationTime / animation.length, 1);
  }

  /**
   * Clear all registered animations
   */
  clear(): void {
    this.animations.clear();
    this.animationSets.clear();
  }

  /**
   * Register all player animations
   */
  registerPlayerAnimations(): void {
    const frameTime = 0.1; // 100ms per frame default

    // Idle animation
    this.registerAnimationSet('player', PlayerAnimations.IDLE, createSpriteAnimation(
      PlayerAnimations.IDLE,
      'player_idle',
      [createAnimationFrame('andou_stand', 0, 1.0, 0, 0, 64, 64)],
      true
    ));

    // Move animation
    this.registerAnimationSet('player', PlayerAnimations.MOVE, createSpriteAnimation(
      PlayerAnimations.MOVE,
      'player_move',
      [
        createAnimationFrame('andou_diag01', 0, frameTime, 0, 0, 64, 64),
        createAnimationFrame('andou_diag02', 0, frameTime, 0, 0, 64, 64),
        createAnimationFrame('andou_diag03', 0, frameTime, 0, 0, 64, 64),
      ],
      true
    ));

    // Fast move animation
    this.registerAnimationSet('player', PlayerAnimations.MOVE_FAST, createSpriteAnimation(
      PlayerAnimations.MOVE_FAST,
      'player_move_fast',
      [
        createAnimationFrame('andou_diagmore01', 0, frameTime * 0.7, 0, 0, 64, 64),
        createAnimationFrame('andou_diagmore02', 0, frameTime * 0.7, 0, 0, 64, 64),
        createAnimationFrame('andou_diagmore03', 0, frameTime * 0.7, 0, 0, 64, 64),
      ],
      true
    ));

    // Boost up (flying) animation
    this.registerAnimationSet('player', PlayerAnimations.BOOST_UP, createSpriteAnimation(
      PlayerAnimations.BOOST_UP,
      'player_boost_up',
      [
        createAnimationFrame('andou_flyup01', 0, frameTime, 0, 0, 64, 64),
        createAnimationFrame('andou_flyup02', 0, frameTime, 0, 0, 64, 64),
        createAnimationFrame('andou_flyup03', 0, frameTime, 0, 0, 64, 64),
      ],
      true
    ));

    // Falling animation (used for boost_move when falling)
    this.registerAnimationSet('player', PlayerAnimations.BOOST_MOVE, createSpriteAnimation(
      PlayerAnimations.BOOST_MOVE,
      'player_fall',
      [
        createAnimationFrame('andou_fall01', 0, frameTime, 0, 0, 64, 64),
        createAnimationFrame('andou_fall02', 0, frameTime, 0, 0, 64, 64),
        createAnimationFrame('andou_fall03', 0, frameTime, 0, 0, 64, 64),
        createAnimationFrame('andou_fall04', 0, frameTime, 0, 0, 64, 64),
      ],
      true
    ));

    // Stomp animation
    this.registerAnimationSet('player', PlayerAnimations.STOMP, createSpriteAnimation(
      PlayerAnimations.STOMP,
      'player_stomp',
      [
        createAnimationFrame('andou_stomp01', 0, frameTime * 0.5, 0, 0, 64, 64),
        createAnimationFrame('andou_stomp02', 0, frameTime * 0.5, 0, 0, 64, 64),
        createAnimationFrame('andou_stomp03', 0, frameTime * 0.5, 0, 0, 64, 64),
        createAnimationFrame('andou_stomp04', 0, frameTime * 0.5, 0, 0, 64, 64),
      ],
      false
    ));

    // Hit react animation
    this.registerAnimationSet('player', PlayerAnimations.HIT_REACT, createSpriteAnimation(
      PlayerAnimations.HIT_REACT,
      'player_hit',
      [createAnimationFrame('andou_hit', 0, 0.3, 0, 0, 64, 64)],
      false
    ));

    // Death animation
    this.registerAnimationSet('player', PlayerAnimations.DEATH, createSpriteAnimation(
      PlayerAnimations.DEATH,
      'player_death',
      [
        createAnimationFrame('andou_die01', 0, 0.1, 0, 0, 64, 64),
        createAnimationFrame('andou_die02', 0, 0.5, 0, 0, 64, 64),
      ],
      false
    ));
  }

  /**
   * Register enemy animations (generic)
   */
  registerEnemyAnimations(enemyType: string, sprites: {
    idle: string[],
    move: string[],
    attack?: string[],
    death?: string[],
  }): void {
    const frameTime = 0.15;

    // Idle
    this.registerAnimationSet(enemyType, EnemyAnimations.IDLE, createSpriteAnimation(
      EnemyAnimations.IDLE,
      `${enemyType}_idle`,
      sprites.idle.map(s => createAnimationFrame(s, 0, frameTime)),
      true
    ));

    // Move
    this.registerAnimationSet(enemyType, EnemyAnimations.MOVE, createSpriteAnimation(
      EnemyAnimations.MOVE,
      `${enemyType}_move`,
      sprites.move.map(s => createAnimationFrame(s, 0, frameTime)),
      true
    ));

    // Attack (if provided)
    if (sprites.attack && sprites.attack.length > 0) {
      this.registerAnimationSet(enemyType, EnemyAnimations.ATTACK, createSpriteAnimation(
        EnemyAnimations.ATTACK,
        `${enemyType}_attack`,
        sprites.attack.map(s => createAnimationFrame(s, 0, frameTime)),
        false
      ));
    }

    // Death (if provided)
    if (sprites.death && sprites.death.length > 0) {
      this.registerAnimationSet(enemyType, EnemyAnimations.DEATH, createSpriteAnimation(
        EnemyAnimations.DEATH,
        `${enemyType}_death`,
        sprites.death.map(s => createAnimationFrame(s, 0, frameTime)),
        false
      ));
    }
  }
}

// Export singleton instance
export const animationSystem = new AnimationSystem();
