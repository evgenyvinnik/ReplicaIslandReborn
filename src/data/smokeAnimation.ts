/** Five alternative animations in original spawnEffectSmokeBig, not one concatenated sequence. */
export const BIG_SMOKE_HOLDS = [10, 13, 8, 5, 15] as const;
export const BIG_SMOKE_FRAMES = [1, 2, 3, 4, 5].map((n) => `effect_smoke_big0${n}.png`);

export function bigSmokeFrameTimes(): number[] {
  return [BIG_SMOKE_HOLDS[Math.floor(Math.random() * BIG_SMOKE_HOLDS.length)], 1, 1, 1, 1];
}
