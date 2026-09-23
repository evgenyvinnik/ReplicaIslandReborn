import { afterEach, expect, test } from 'bun:test';
import { LevelParser } from './LevelParser';
import { LevelSystem } from './LevelSystemNew';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function holdFetch(): () => globalThis.AbortSignal | undefined {
  let requestSignal: globalThis.AbortSignal | undefined;
  globalThis.fetch = ((_url: string | URL | globalThis.Request, init?: globalThis.RequestInit) => {
    requestSignal = init?.signal ?? undefined;
    return new Promise<Response>((_resolve, reject) => {
      requestSignal?.addEventListener('abort', () => reject(new globalThis.DOMException('Aborted', 'AbortError')), { once: true });
    });
  }) as typeof fetch;
  return () => requestSignal;
}

async function beforeHang<T>(pending: Promise<T>): Promise<T | 'hung'> {
  let guard: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<'hung'>(resolve => { guard = setTimeout(() => resolve('hung'), 100); }),
    ]);
  } finally {
    if (guard) clearTimeout(guard);
  }
}

test('a stalled level response aborts instead of leaving loading pending forever', async () => {
  const signal = holdFetch();
  const parsed = await beforeHang(new LevelParser().parseJsonLevel('/assets/levels/stalled.json', undefined, 20));
  expect(parsed).toBeNull();
  expect(signal()?.aborted).toBe(true);
});

test('disposing a loading game aborts its in-flight level request', async () => {
  const signal = holdFetch();
  const controller = new globalThis.AbortController();
  const loading = new LevelSystem().loadLevel(1, controller.signal);
  controller.abort();
  expect(await beforeHang(loading)).toBe(false);
  expect(signal()?.aborted).toBe(true);
});
