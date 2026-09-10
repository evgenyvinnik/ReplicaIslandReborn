import type { InputSystem } from './InputSystem';

export type MenuCommand = 'confirm' | 'back' | 'up' | 'down' | 'left' | 'right';
export interface CanvasMenuTarget { handleMenuCommand(command: MenuCommand): void }

/** Controller navigation for the foremost canvas overlay, before simulation gates. */
export class CanvasMenuInput {
  private target: CanvasMenuTarget | null = null;
  private direction: 'up' | 'down' | 'left' | 'right' | null = null;
  private repeatTime = 0;

  constructor(private input: InputSystem, private horizontalNavigation = false) {}

  update(target: CanvasMenuTarget | null, deltaTime: number): boolean {
    if (this.target !== target) {
      this.target = target;
      this.direction = null;
      this.repeatTime = 0;
    }
    if (!target) return false;

    const confirm = this.input.isGamepadActionPressed('jump');
    const back = this.input.isGamepadActionPressed('attack') || this.input.isGamepadPausePressed();
    const up = this.input.isGamepadActionActive('up');
    const down = this.input.isGamepadActionActive('down');
    const left = this.horizontalNavigation && this.input.isGamepadActionActive('left');
    const right = this.horizontalNavigation && this.input.isGamepadActionActive('right');
    const direction = up !== down ? up ? 'up' : 'down'
      : left !== right ? left ? 'left' : 'right' : null;
    // Keep raw polling for UI edges, but hide held UI input from gameplay until
    // physical release. Clearing keys here would create a new press every tick.
    this.input.consumeGamepadForMenu();
    if (confirm || back) {
      target.handleMenuCommand(confirm ? 'confirm' : 'back');
    } else if (direction !== this.direction) {
      this.direction = direction;
      this.repeatTime = 0.35;
      if (direction) target.handleMenuCommand(direction);
    } else if (direction) {
      this.repeatTime -= deltaTime;
      if (this.repeatTime <= 0) {
        this.repeatTime = 0.1;
        target.handleMenuCommand(direction);
      }
    }
    // Even if the command dismissed the overlay, this frame still belongs to it.
    return true;
  }
}
