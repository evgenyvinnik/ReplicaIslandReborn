import { isSurfaceActive } from './GameSurfaceActivity';

/** Keyboard ownership follows Game's canvas render order, not listener age. */
export const ModalPriority = {
  dialog: 10, cutscene: 20, pause: 30, gameOver: 40,
  levelComplete: 50, diary: 60, endingStats: 70,
} as const;

type Handler = (event: KeyboardEvent) => void;
interface Binding { priority: number; handler: Handler; surface?: globalThis.HTMLElement }
interface Host {
  window: typeof window;
  bindings: Map<object, Binding>;
  dispatch: Handler;
}
const hosts = new WeakMap<typeof window, Host>();
const owners = new WeakMap<object, Host>();

export function isTopModal(owner: object): boolean {
  const host = owners.get(owner);
  if (!host) return false;
  let top: object | undefined, priority = -Infinity;
  for (const [candidate, binding] of host.bindings) {
    if (isSurfaceActive(binding.surface) && binding.priority >= priority) { top = candidate; priority = binding.priority; }
  }
  return top === owner;
}

/** Pointer listeners share the keyboard stack and own their dismissal event. */
export function claimModalPointer(owner: object, event: globalThis.Event): boolean {
  if (!isTopModal(owner)) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}

export function attachModalKeyboard(owner: object, priority: number, handler: Handler, surface?: globalThis.HTMLElement): void {
  detachModalKeyboard(owner);
  let host = hosts.get(window);
  if (!host) {
    const bindings = new Map<object, Binding>();
    const dispatch = (event: KeyboardEvent): void => {
      let selected: Binding | undefined;
      for (const binding of bindings.values()) {
        if (isSurfaceActive(binding.surface) && (!selected || binding.priority >= selected.priority)) selected = binding;
      }
      // Choose once: a callback may close this overlay and open another.
      selected?.handler(event);
      if (event.defaultPrevented) event.stopImmediatePropagation();
    };
    host = { window, bindings, dispatch };
    hosts.set(window, host);
    window.addEventListener('keydown', dispatch, true);
  }
  host.bindings.set(owner, { priority, handler, surface });
  owners.set(owner, host);
}

export function detachModalKeyboard(owner: object): void {
  const host = owners.get(owner);
  if (!host) return;
  owners.delete(owner);
  host.bindings.delete(owner);
  if (host.bindings.size === 0) {
    host.window.removeEventListener('keydown', host.dispatch, true);
    hosts.delete(host.window);
  }
}
