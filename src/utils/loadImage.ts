/** Keep a stalled mobile image request from blocking game startup forever. */
export const IMAGE_LOAD_TIMEOUT_MS = 20_000;

export function loadImage(
  url: string,
  signal?: globalThis.AbortSignal,
  timeoutMs = IMAGE_LOAD_TIMEOUT_MS
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new globalThis.DOMException('Image load aborted', 'AbortError'));
      return;
    }

    const image = new Image();
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      image.onload = null;
      image.onerror = null;
      if (error) {
        // Clearing the attribute cancels the request without treating an empty
        // URL as a request for the current page on some mobile browsers.
        if (typeof image.removeAttribute === 'function') image.removeAttribute('src');
        else image.src = '';
        reject(error);
      } else {
        resolve(image);
      }
    };
    const abort = (): void => finish(new globalThis.DOMException('Image load aborted', 'AbortError'));
    image.onload = (): void => finish();
    image.onerror = (): void => finish(new Error(`Failed to load image: ${url}`));
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => finish(new Error(`Image load timed out: ${url}`)), timeoutMs);
    try {
      image.src = url;
    } catch (error) {
      finish(error instanceof Error ? error : new Error(`Failed to load image: ${url}`));
    }
  });
}
