/** Android stateWin: two unscaled seconds, then a 1.5-second HUD fade. */
export class PlayerWinSequence {
  private startedAt: number | null = null;
  private fadeStartedAt: number | null = null;
  private completionSent = false;
  opacity = 0;

  begin(realTime: number): void {
    this.reset();
    this.startedAt = realTime;
  }

  /** Use TimeSystem's real clock, which is unscaled but suspended by pause. */
  update(realTime: number): boolean {
    if (this.startedAt === null || this.completionSent) return false;
    if (this.fadeStartedAt === null && realTime - this.startedAt > 2) {
      this.fadeStartedAt = realTime;
    }
    if (this.fadeStartedAt !== null) {
      this.opacity = Math.min(1, Math.max(0, (realTime - this.fadeStartedAt) / 1.5));
      if (this.opacity === 1) {
        this.completionSent = true;
        return true;
      }
    }
    return false;
  }

  reset(): void {
    this.startedAt = this.fadeStartedAt = null;
    this.completionSent = false;
    this.opacity = 0;
  }
}
