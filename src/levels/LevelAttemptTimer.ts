import type { TimeSystem } from '../engine/TimeSystem';

/** Per-attempt simulation time, matching Android Game.getGameTime(). */
export class LevelAttemptTimer {
  private clock: TimeSystem | null = null;
  private startedAt = 0;

  start(clock: TimeSystem | null | undefined): void {
    this.clock = clock ?? null;
    this.startedAt = this.clock?.getGameTime() ?? 0;
  }

  elapsed(): number {
    return Math.max(0, (this.clock?.getGameTime() ?? 0) - this.startedAt);
  }
}
