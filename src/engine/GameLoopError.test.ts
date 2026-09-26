import { expect, spyOn, test } from 'bun:test';
import { GameLoop } from './GameLoop';

function withAnimationFrames(run: (advance: (frame: number) => void, hasPendingFrame: () => boolean) => void): void {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const now = spyOn(performance, 'now').mockReturnValue(0);
  let pending: Parameters<typeof requestAnimationFrame>[0] | undefined;
  globalThis.requestAnimationFrame = (callback): number => { pending = callback; return 1; };
  globalThis.cancelAnimationFrame = (): void => { pending = undefined; };
  try {
    run((frame) => {
      const callback = pending;
      pending = undefined;
      callback?.(frame * 1000 / 60);
    }, () => pending !== undefined);
  } finally {
    now.mockRestore();
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
}

test('a persistent update error stops play and reports a recovery path once', () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  try {
    withAnimationFrames((advance, hasPendingFrame) => {
      const loop = new GameLoop();
      const error = new Error('broken level update');
      const reported: Array<{ phase: string; error: unknown }> = [];
      let renders = 0;
      loop.setUpdateCallback(() => { throw error; });
      loop.setRenderCallback(() => { renders++; });
      loop.setFrameErrorCallback((phase, failure) => { reported.push({ phase, error: failure }); });
      loop.start();
      for (let frame = 1; frame <= 5; frame++) advance(frame);
      expect(reported).toEqual([{ phase: 'update', error }]);
      expect(loop.isRunning()).toBe(false);
      expect(hasPendingFrame()).toBe(false);
      expect(renders).toBeLessThanOrEqual(3);
    });
  } finally {
    log.mockRestore();
  }
});

test('an isolated update error does not stop the game', () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  try {
    withAnimationFrames((advance, hasPendingFrame) => {
      const loop = new GameLoop();
      let updates = 0;
      let reports = 0;
      loop.setUpdateCallback(() => {
        updates++;
        if (updates === 1 || updates === 3) throw new Error('transient');
      });
      loop.setFrameErrorCallback(() => { reports++; });
      loop.start();
      for (let frame = 1; frame <= 6; frame++) advance(frame);
      expect(updates).toBeGreaterThanOrEqual(5);
      expect(reports).toBe(0);
      expect(loop.isRunning()).toBe(true);
      expect(hasPendingFrame()).toBe(true);
      loop.stop();
    });
  } finally {
    log.mockRestore();
  }
});

test('repeated render errors are reported even when updates succeed', () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  try {
    withAnimationFrames((advance, hasPendingFrame) => {
      const loop = new GameLoop();
      const error = new Error('broken level render');
      const reported: string[] = [];
      let updates = 0;
      loop.setUpdateCallback(() => { updates++; });
      loop.setRenderCallback(() => { throw error; });
      loop.setFrameErrorCallback((phase, failure) => {
        expect(failure).toBe(error);
        reported.push(phase);
      });
      loop.start();
      for (let frame = 1; frame <= 5; frame++) advance(frame);
      expect(reported).toEqual(['render']);
      expect(updates).toBeGreaterThan(0);
      expect(loop.isRunning()).toBe(false);
      expect(hasPendingFrame()).toBe(false);
    });
  } finally {
    log.mockRestore();
  }
});
