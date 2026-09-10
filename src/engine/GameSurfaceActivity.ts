import type { InputSystem } from './InputSystem';
import type { SoundSystem } from './SoundSystem';

/** The virtual phone OS uses inert; real background tabs use document.hidden. */
export function isSurfaceActive(surface?: globalThis.HTMLElement | null): boolean {
  return !surface?.closest?.('[inert]') && !surface?.ownerDocument?.hidden;
}

/** Suspend the entire surface, including display-clock cutscenes and UI.
 * Unlike gameplay Pause this must not accept a key or advance an overlay. */
export class GameSurfaceActivity {
  private suspended = false;
  constructor(private surface: globalThis.HTMLElement,
    private input: Pick<InputSystem, 'releaseAllKeys' | 'blockHeldGamepadOnNextPoll'>,
    private sound: Pick<SoundSystem, 'pauseAll' | 'resumeAll'>,
    private releaseControls: () => void) {}

  allowFrame(): boolean {
    if (!isSurfaceActive(this.surface)) {
      this.suspend();
      return false;
    }
    if (this.suspended) this.sound.resumeAll();
    this.suspended = false;
    return true;
  }

  /** Visibility events can arrive before rAF is throttled to zero. */
  suspend(): void {
    this.input.releaseAllKeys();
    this.input.blockHeldGamepadOnNextPoll();
    this.releaseControls();
    if (!this.suspended) this.sound.pauseAll();
    this.suspended = true;
  }
}
