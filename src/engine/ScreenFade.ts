/** Original HudSystem's real-time fade and event-on-completion contract. */
export class ScreenFade {
  private elapsed = 0;
  private duration = 0;
  private active = false;
  private onComplete: (() => void) | null = null;
  private startedAt = 0;

  constructor(private readonly readRealTime: () => number) {}

  /** Keep repeated end-level hotspot contacts from restarting the same fade. */
  fadeOut(duration: number, onComplete: () => void): void {
    if (this.active) return;
    this.active = true;
    this.elapsed = 0;
    this.startedAt = this.readRealTime();
    this.duration = Math.max(0, duration);
    this.onComplete = onComplete;
  }

  getOpacity(): number {
    return !this.active ? 0 : this.duration === 0 ? 1 : Math.min(1, this.elapsed / this.duration);
  }

  update(): void {
    if (!this.active) return;
    // HudSystem measures from fade start, not from the number of render calls.
    // The unscaled TimeSystem clock stops during pause/dialogue, but not hit-stop.
    this.elapsed = Math.max(0, this.readRealTime() - this.startedAt);
    if (this.getOpacity() >= 1) {
      const callback = this.onComplete;
      this.onComplete = null;
      callback?.();
    }
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.active) return;
    ctx.save();
    ctx.globalAlpha = this.getOpacity();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  clear(): void {
    this.active = false;
    this.onComplete = null;
    this.elapsed = 0;
    this.startedAt = 0;
  }
}
