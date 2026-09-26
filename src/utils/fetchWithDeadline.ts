/** Bounds both the response headers and body of a mobile asset request. */
export async function fetchWithDeadline<T>(
  url: string,
  read: (response: Response) => Promise<T>,
  signal?: globalThis.AbortSignal,
  timeoutMs = 20_000
): Promise<T> {
  if (signal?.aborted) throw new globalThis.DOMException('Fetch aborted', 'AbortError');
  const controller = new globalThis.AbortController();
  const abort = (): void => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return await read(response);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
