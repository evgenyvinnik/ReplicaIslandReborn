import type { CanvasMenuTarget, MenuCommand } from './CanvasMenuInput';

export interface DOMMenuHandlers {
  onBack?: () => void;
  /** Menus with their own selection model can handle navigation directly. */
  onCommand?: (command: MenuCommand) => boolean;
}

/** Operates actual controls, never synthesizes gameplay/key-binding keys. */
export class DOMMenuInput implements CanvasMenuTarget {
  private index = -1;
  private scope: globalThis.HTMLElement | null = null;
  private control: globalThis.HTMLElement | null = null;

  constructor(private root: () => globalThis.HTMLElement | null, private handlers: () => DOMMenuHandlers) {}

  reset(): void {
    this.root()?.querySelectorAll('[data-controller-focused]').forEach(element => element.removeAttribute('data-controller-focused'));
    this.index = -1;
    this.scope = null;
    this.control = null;
  }

  private controls(scope: globalThis.HTMLElement): globalThis.HTMLElement[] {
    return Array.from(scope.querySelectorAll<globalThis.HTMLElement>('button:not(:disabled), input[type="range"]:not(:disabled), a[href]'))
      .filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
  }

  private focus(root: globalThis.HTMLElement, control: globalThis.HTMLElement): void {
    root.querySelectorAll('[data-controller-focused]').forEach(element => element.removeAttribute('data-controller-focused'));
    control.setAttribute('data-controller-focused', 'true');
    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.control = control;
  }

  /** Preferences replace their child components on state changes. Keep the
      controller's selected row visible without waiting for another direction. */
  refresh(): void {
    const root = this.root();
    if (!root || this.index < 0 || root.closest('[inert]')) return;
    const dialogs = root.querySelectorAll<globalThis.HTMLElement>('[data-menu-controller-dialog]');
    const scope = dialogs[dialogs.length - 1] ?? root;
    if (scope !== this.scope) { this.reset(); return; }
    const controls = this.controls(scope);
    this.index = Math.min(this.index, controls.length - 1);
    const control = controls[this.index];
    if (control && control !== this.control) this.focus(root, control);
  }

  handleMenuCommand(command: MenuCommand): void {
    const root = this.root();
    if (!root || root.closest('[inert]')) return;
    const handlers = this.handlers();
    if (command === 'back') {
      handlers.onBack?.();
      return;
    }
    if (handlers.onCommand?.(command)) return;

    const dialogs = root.querySelectorAll<globalThis.HTMLElement>('[data-menu-controller-dialog]');
    const scope = dialogs[dialogs.length - 1] ?? root;
    if (scope !== this.scope) {
      this.reset();
      this.scope = scope;
    }
    const controls = this.controls(scope);
    if (!controls.length) return;
    const focused = controls.indexOf(root.ownerDocument.activeElement as globalThis.HTMLElement);
    if (focused >= 0) this.index = focused;
    const hadSelection = this.index >= 0;
    this.index = Math.max(0, Math.min(this.index, controls.length - 1));
    let control = controls[this.index];
    const horizontal = command === 'left' || command === 'right';
    if (horizontal && control.tagName === 'INPUT') {
      const slider = control as globalThis.HTMLInputElement;
      slider.stepUp(command === 'right' ? 1 : -1);
      slider.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
    } else if (command !== 'confirm' && hadSelection) {
      const direction = command === 'up' || command === 'left' ? -1 : 1;
      this.index = (this.index + direction + controls.length) % controls.length;
      control = controls[this.index];
    }
    this.focus(root, control);
    if (command === 'confirm') control.click();
  }
}
