type Schedule = (callback: () => void, delay: number) => () => void;

/** One accepted choice owns its animation and launch until the menu unmounts. */
export class MenuSelectionTransition {
  private accepted = false;
  private generation = 0;
  private cancellations: Array<() => void> = [];

  constructor(private schedule: Schedule = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    return (): void => clearTimeout(timer);
  }) {}

  start(onComplete: () => void, onFade?: () => void): boolean {
    if (this.accepted) return false;
    this.accepted = true;
    const generation = this.generation;
    const queue = (callback: () => void, delay: number): void => {
      this.cancellations.push(this.schedule(() => {
        if (this.accepted && generation === this.generation) callback();
      }, delay));
    };
    if (onFade) queue(onFade, 300);
    queue(onComplete, 800);
    return true;
  }

  cancel(): void {
    this.accepted = false;
    this.generation++;
    this.cancellations.forEach(cancel => cancel());
    this.cancellations = [];
  }
}
