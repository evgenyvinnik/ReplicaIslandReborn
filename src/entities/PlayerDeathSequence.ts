/** Android stateDead's game-time delay followed by HudSystem's real-time fade. */
export class PlayerDeathSequence {
  private deathStartedAt: number | null = null;
  private fadeStartedAt: number | null = null;
  private restartSent = false;
  deathTime = 0;
  fadeTime = 0;

  get fading(): boolean { return this.fadeStartedAt !== null; }

  begin(gameTime: number): void {
    this.reset();
    this.deathStartedAt = gameTime;
    this.deathTime = 2;
  }

  /** Returns true once, when the completed fade should reload the level. */
  update(gameTime: number, realTime: number, presentationStarted: boolean): boolean {
    if (this.deathStartedAt === null || this.restartSent) return false;
    this.deathTime = Math.max(0, 2 - (gameTime - this.deathStartedAt));
    if (this.fadeStartedAt === null && presentationStarted && gameTime - this.deathStartedAt > 2) {
      this.fadeStartedAt = realTime;
    }
    if (this.fadeStartedAt !== null) {
      this.fadeTime = Math.max(0, 1.5 - (realTime - this.fadeStartedAt));
      if (this.fadeTime <= 0) {
        this.restartSent = true;
        return true;
      }
    }
    return false;
  }

  reset(): void {
    this.deathStartedAt = this.fadeStartedAt = null;
    this.restartSent = false;
    this.deathTime = this.fadeTime = 0;
  }
}
