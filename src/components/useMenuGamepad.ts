import { useEffect, useRef, type RefObject } from 'react';
import { InputSystem } from '../engine/InputSystem';
import { CanvasMenuInput } from '../engine/CanvasMenuInput';
import { DOMMenuInput, type DOMMenuHandlers } from '../engine/DOMMenuInput';

interface MenuGamepadOptions extends DOMMenuHandlers {
  menuRef: RefObject<globalThis.HTMLElement | null>;
  viewKey: string;
}

/** Poll only while a React menu owns the app; Game owns its own input lifetime. */
export function useMenuGamepad(options: MenuGamepadOptions): void {
  const latest = useRef(options);
  latest.current = options;
  const { menuRef } = options;
  useEffect(() => {
    const input = new InputSystem({ touchGestures: false, blockInitialGamepadInput: true,
      keyBindings: { left: [], right: [], up: [], down: [], jump: [], attack: [], pause: [] } });
    input.initialize();
    const target = new DOMMenuInput(() => menuRef.current, () => latest.current);
    const router = new CanvasMenuInput(input, true);
    let viewKey = latest.current.viewKey;
    let lastTime = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      const root = menuRef.current;
      const active = root && document.hasFocus() && !document.hidden
        && root.getClientRects().length > 0 && !root.closest('[inert]');
      if (!active || latest.current.viewKey !== viewKey) {
        input.blockHeldGamepadOnNextPoll();
        target.reset();
        router.update(null, 0);
        viewKey = latest.current.viewKey;
      }
      input.update();
      router.update(active ? target : null, Math.min(0.1, Math.max(0, (now - lastTime) / 1000)));
      if (active) target.refresh();
      lastTime = now;
      frame = requestAnimationFrame(tick);
    };
    const clearHighlight = (): void => target.reset();
    const root = menuRef.current;
    root?.addEventListener('pointerdown', clearHighlight);
    root?.addEventListener('keydown', clearHighlight);
    frame = requestAnimationFrame(tick);
    return (): void => {
      cancelAnimationFrame(frame);
      input.destroy();
      target.reset();
      root?.removeEventListener('pointerdown', clearHighlight);
      root?.removeEventListener('keydown', clearHighlight);
    };
  }, [menuRef]);
}
