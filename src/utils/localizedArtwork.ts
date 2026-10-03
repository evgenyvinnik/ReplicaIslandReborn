/** Android's drawable-ja qualifier has two artwork overrides, not a dialogue translation. */
export function isJapaneseArtworkLocale(locale: string): boolean {
  return /^ja(?:[-_]|$)/i.test(locale);
}

export function localizedTitleArtwork(name: 'title' | 'titletileset', locale?: string): string {
  const selectedLocale = locale ?? globalThis.navigator?.language ?? 'en';
  const suffix = isJapaneseArtworkLocale(selectedLocale) ? '_ja' : '';
  return `/assets/sprites/${name}${suffix}.png`;
}
