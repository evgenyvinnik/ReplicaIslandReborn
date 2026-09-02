/**
 * Draw order for everything on screen.
 * Ported from: Original/src/com/replica/replicaisland/SortConstants.java
 *
 * `RenderSystem` sorts its queue by these, low to high, so a larger number
 * draws on top. The gaps between them are deliberate: the original offsets by
 * one or two from a base to layer a sprite just in front of or behind its
 * owner (the player's jet fire at PLAYER - 1, his glow halo at PLAYER + 1,
 * The Source's five layers at THE_SOURCE_START + 0..4).
 *
 * Objects that do not set a priority all land on 0 (FOREGROUND) and then draw
 * in whatever order the object manager happens to hold them, which is how this
 * port used to render everything. Prefer a constant from this table.
 */
export const SortConstants = {
  /** Parallax background layers, each successive layer +10 from here. */
  BACKGROUND_START: -100,
  /** The Source's five stacked layers occupy -5..-1. */
  THE_SOURCE_START: -5,
  FOREGROUND: 0,
  EFFECT: 5,
  GENERAL_OBJECT: 10,
  GENERAL_ENEMY: 15,
  /** The same value as GENERAL_ENEMY in the original; NPCs are enemies there. */
  NPC: 15,
  PLAYER: 20,
  FOREGROUND_EFFECT: 30,
  PROJECTILE: 40,
  FOREGROUND_OBJECT: 50,
  OVERLAY: 70,
  HUD: 100,
  FADE: 200,
} as const;
