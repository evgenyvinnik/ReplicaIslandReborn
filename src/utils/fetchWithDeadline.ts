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

/** Bound browser processing after a response arrives (for example audio decoding).
 * The browser operation itself may not be cancellable, but late results are ignored.
 */
export async function awaitWithDeadline<T>(
  work: Promise<T>,
  signal?: globalThis.AbortSignal,
  timeoutMs = 20_000
): Promise<T> {
  if (signal?.aborted) throw new globalThis.DOMException('Processing aborted', 'AbortError');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let rejectOnAbort = (): void => {};
  const deadline = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = (): void => reject(new globalThis.DOMException('Processing aborted', 'AbortError'));
    signal?.addEventListener('abort', rejectOnAbort, { once: true });
    timeout = setTimeout(() => reject(new Error('Processing timed out')), timeoutMs);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    signal?.removeEventListener('abort', rejectOnAbort);
  }
}
