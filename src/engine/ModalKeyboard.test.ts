import { expect, test } from 'bun:test';
import { attachModalKeyboard, detachModalKeyboard, ModalPriority } from './ModalKeyboard';

test('overlay render priority wins over attachment order and teardown restores keyboard handling', () => {
  const oldWindow = globalThis.window;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof window;
  const priorities = Object.values(ModalPriority);
  const owners = priorities.map(() => ({}));
  const seen: number[] = [];
  let leaked = 0;
  const key = (): void => { keys.dispatchEvent(new globalThis.Event('keydown', { cancelable: true })); };
  try {
    // Attach high to low: an insertion-order listener system would pick wrong.
    for (let i = owners.length - 1; i >= 0; i--) attachModalKeyboard(owners[i], priorities[i], event => {
      seen.push(priorities[i]); event.preventDefault();
    });
    keys.addEventListener('keydown', () => { leaked++; });
    for (let i = owners.length - 1; i >= 0; i--) {
      key(); expect(seen[seen.length - 1]).toBe(priorities[i]);
      expect(leaked).toBe(0);
      detachModalKeyboard(owners[i]);
    }
    expect(seen).toHaveLength(owners.length);
    key(); expect(leaked).toBe(1);
  } finally { owners.forEach(detachModalKeyboard); globalThis.window = oldWindow; }
});

test('a synchronous overlay replacement does not receive the closing event', () => {
  const oldWindow = globalThis.window;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof window;
  const first = {}, replacement = {};
  let closes = 0, advances = 0;
  try {
    attachModalKeyboard(first, ModalPriority.cutscene, event => {
      event.preventDefault(); closes++;
      detachModalKeyboard(first);
      attachModalKeyboard(replacement, ModalPriority.endingStats, next => { next.preventDefault(); advances++; });
    });
    keys.dispatchEvent(new globalThis.Event('keydown', { cancelable: true }));
    expect(closes).toBe(1); expect(advances).toBe(0);
    keys.dispatchEvent(new globalThis.Event('keydown', { cancelable: true }));
    expect(closes).toBe(1); expect(advances).toBe(1);
  } finally { detachModalKeyboard(first); detachModalKeyboard(replacement); globalThis.window = oldWindow; }
});
