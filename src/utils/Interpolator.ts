/** Velocity integration from Original/src/com/replica/replicaisland/Interpolator.java. */
export class Interpolator {
  private current = 0;
  private target = 0;
  private acceleration = 0;

  set(current: number, target: number, acceleration: number): void {
    this.current = current;
    this.target = target;
    this.acceleration = acceleration;
  }

  /** Return displacement, retaining the updated velocity separately. */
  interpolate(seconds: number): number {
    const old = this.current;
    const acceleration = Math.abs(old - this.target) < 0.0001 ? 0
      : old > this.target ? -this.acceleration : this.acceleration;
    const offset = old * seconds + 0.5 * acceleration * seconds * seconds;
    const velocity = old + acceleration * seconds;
    // Android clamps the resulting velocity, not the integrated displacement.
    this.current = (old < this.target && velocity > this.target)
      || (old > this.target && velocity < this.target) ? this.target : velocity;
    return offset;
  }

  getCurrent(): number {
    return this.current;
  }
}
