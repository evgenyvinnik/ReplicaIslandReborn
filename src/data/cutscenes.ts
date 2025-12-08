/**
 * Cutscene/Animation Definitions
 * Ported from: Original/src/com/replica/replicaisland/AnimationPlayerActivity.java
 *
 * Defines the animation sequences and layers for game cutscenes
 */

/**
 * Cutscene types matching the original game
 */
export enum CutsceneType {
  KYLE_DEATH = 0,     // Frame-by-frame death animation
  WANDA_ENDING = 1,   // Good ending (defeated The Source)
  KABOCHA_ENDING = 2, // Bad ending (Kabocha killed player)
  ROKUDOU_ENDING = 3, // Bad ending (Rokudou killed player)
}

/**
 * Animation layer for parallax cutscenes
 */
export interface AnimationLayer {
  /** Sprite image path */
  sprite: string;
  /** Starting X offset (pixels) */
  fromX: number;
  /** Ending X offset (pixels) */
  toX: number;
  /** Starting Y offset (pixels) */
  fromY: number;
  /** Ending Y offset (pixels) */
  toY: number;
  /** Duration in milliseconds */
  duration: number;
  /** Delay before animation starts (ms) */
  startOffset: number;
  /** Z-order (higher = on top) */
  zOrder: number;
}

/**
 * Frame animation for death sequence
 */
export interface FrameAnimation {
  /** Array of frame sprite paths */
  frames: string[];
  /** Duration per frame in milliseconds */
  frameDuration: number;
  /** Whether to loop the animation */
  loop: boolean;
}

/**
 * Cutscene definition
 */
export interface CutsceneDefinition {
  type: CutsceneType;
  /** Animation layers for parallax cutscenes */
  layers?: AnimationLayer[];
  /** Frame animation for death sequence */
  frameAnimation?: FrameAnimation;
  /** Background color */
  backgroundColor: string;
  /** Total duration in milliseconds (before skip is allowed) */
  totalDuration: number;
  /** Whether this is a game over (shows game over screen after) */
  isGameOver: boolean;
  /** Whether this is an ending (shows credits/stats after) */
  isEnding: boolean;
}

/**
 * Kyle death animation - 16 frames at 83ms each
 * From kyle_fall.xml
 */
const KYLE_DEATH_FRAMES: string[] = [];
for (let i = 1; i <= 16; i++) {
  KYLE_DEATH_FRAMES.push(`assets/sprites/anime_kyle_fall${i.toString().padStart(2, '0')}.png`);
}

/**
 * Cutscene definitions
 */
export const CUTSCENES: Record<CutsceneType, CutsceneDefinition> = {
  [CutsceneType.KYLE_DEATH]: {
    // NOTE: This is for the ENEMY Kyle's death animation, NOT player death!
    // Player death in the original is handled in-game with fade-to-black and level restart
    type: CutsceneType.KYLE_DEATH,
    frameAnimation: {
      frames: KYLE_DEATH_FRAMES,
      frameDuration: 83, // From kyle_fall.xml: duration="1328" / 16 frames
      loop: false,
    },
    backgroundColor: '#000000',
    totalDuration: 1500, // 16 frames * 83ms + buffer
    isGameOver: false, // Not a game over - this is enemy Kyle death
    isEnding: false,
  },

  [CutsceneType.WANDA_ENDING]: {
    type: CutsceneType.WANDA_ENDING,
    layers: [
      {
        // Background layer - slides left slowly
        sprite: 'assets/sprites/ui_good_ending_background.png',
        fromX: 0,
        toX: -170, // From horizontal_layer1_slide.xml
        fromY: 0,
        toY: 0,
        duration: 6000,
        startOffset: 2000,
        zOrder: 0,
      },
      {
        // Foreground layer - slides left faster (parallax)
        sprite: 'assets/sprites/ui_good_ending_foreground.png',
        fromX: 0,
        toX: -280, // From horizontal_layer2_slide.xml
        fromY: 0,
        toY: 0,
        duration: 6000,
        startOffset: 2000,
        zOrder: 1,
      },
    ],
    backgroundColor: '#000000',
    totalDuration: 10000,
    isGameOver: false,
    isEnding: true,
  },

  [CutsceneType.KABOCHA_ENDING]: {
    type: CutsceneType.KABOCHA_ENDING,
    layers: [
      {
        // Background layer - slides left
        sprite: 'assets/sprites/ui_ending_bad_kabocha_background.png',
        fromX: 0,
        toX: -170, // From horizontal_layer1_slide.xml
        fromY: 0,
        toY: 0,
        duration: 6000,
        startOffset: 2000,
        zOrder: 0,
      },
      {
        // Foreground layer - slides left faster
        sprite: 'assets/sprites/ui_ending_bad_kabocha_foreground.png',
        fromX: 0,
        toX: -280, // From horizontal_layer2_slide.xml
        fromY: 0,
        toY: 0,
        duration: 6000,
        startOffset: 2000,
        zOrder: 1,
      },
      {
        // Game over text - slides in from left
        sprite: 'assets/sprites/ui_ending_bad_kabocha_foreground.png', // Reuse for game over overlay
        fromX: -200,
        toX: 0, // From kabocha_game_over.xml
        fromY: 0,
        toY: 0,
        duration: 6000,
        startOffset: 8000,
        zOrder: 2,
      },
    ],
    backgroundColor: '#000000',
    totalDuration: 15000,
    isGameOver: false,
    isEnding: true,
  },

  [CutsceneType.ROKUDOU_ENDING]: {
    type: CutsceneType.ROKUDOU_ENDING,
    layers: [
      {
        // Background - scrolls down
        sprite: 'assets/sprites/ui_bad_ending_rokudou_bg.png',
        fromX: 0,
        toX: 0,
        fromY: -130,
        toY: -50, // From rokudou_slide_bg.xml
        duration: 6000,
        startOffset: 2000,
        zOrder: 0,
      },
      {
        // Sphere - scrolls down
        sprite: 'assets/sprites/ui_bad_ending_rokudou_sphere.png',
        fromX: 0,
        toX: 0,
        fromY: -110,
        toY: -10, // From rokudou_slide_sphere.xml
        duration: 6000,
        startOffset: 2000,
        zOrder: 1,
      },
      {
        // Cliffs - scrolls down faster
        sprite: 'assets/sprites/ui_bad_ending_rokudou_cliffs.png',
        fromX: 0,
        toX: 0,
        fromY: -158,
        toY: 2, // From rokudou_slide_cliffs.xml
        duration: 6000,
        startOffset: 2000,
        zOrder: 2,
      },
      {
        // Rokudou - scrolls up from bottom
        sprite: 'assets/sprites/ui_bad_ending_rokudou_rokudou.png',
        fromX: 0,
        toX: 0,
        fromY: 278,
        toY: -11, // From rokudou_slide_rokudou.xml
        duration: 6000,
        startOffset: 2000,
        zOrder: 3,
      },
    ],
    backgroundColor: '#000000',
    totalDuration: 10000,
    isGameOver: false,
    isEnding: true,
  },
};

/**
 * Get cutscene definition by type
 */
export function getCutscene(type: CutsceneType): CutsceneDefinition {
  return CUTSCENES[type];
}

/**
 * Get cutscene name for display
 */
export function getCutsceneName(type: CutsceneType): string {
  switch (type) {
    case CutsceneType.KYLE_DEATH:
      return 'Death';
    case CutsceneType.WANDA_ENDING:
      return 'Good Ending';
    case CutsceneType.KABOCHA_ENDING:
      return 'Bad Ending (Kabocha)';
    case CutsceneType.ROKUDOU_ENDING:
      return 'Bad Ending (Rokudou)';
    default:
      return 'Unknown';
  }
}
