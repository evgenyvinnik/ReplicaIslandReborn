/** Fit the fixed-resolution game into the space the browser actually shows. */
export function fitPhoneFrame(
  availableWidth: number,
  availableHeight: number,
  frameWidth: number,
  frameHeight: number,
): number {
  if (![availableWidth, availableHeight, frameWidth, frameHeight].every(Number.isFinite) ||
      availableWidth <= 0 || availableHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return 1;
  }
  return Math.min(1, availableWidth / frameWidth, availableHeight / frameHeight);
}
