import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { isJapaneseArtworkLocale, localizedTitleArtwork } from './localizedArtwork';

test('the two Japanese title resources are shipped unchanged from Android', () => {
  for (const name of ['title', 'titletileset']) {
    const source = readFileSync(new URL(`../../Original/res/drawable-ja/${name}.png`, import.meta.url));
    const shipped = readFileSync(new URL(`../../public/assets/sprites/${name}_ja.png`, import.meta.url));
    expect(shipped, name).toEqual(source);
  }
});

test('Japanese browser locales select only the source-provided art variants', () => {
  for (const locale of ['ja', 'ja-JP', 'ja_JP']) {
    expect(isJapaneseArtworkLocale(locale)).toBe(true);
    expect(localizedTitleArtwork('title', locale)).toBe('/assets/sprites/title_ja.png');
    expect(localizedTitleArtwork('titletileset', locale)).toBe('/assets/sprites/titletileset_ja.png');
  }
  for (const locale of ['en', 'en-US', 'fr-FR', 'javanese']) {
    expect(isJapaneseArtworkLocale(locale)).toBe(false);
    expect(localizedTitleArtwork('title', locale)).toBe('/assets/sprites/title.png');
    expect(localizedTitleArtwork('titletileset', locale)).toBe('/assets/sprites/titletileset.png');
  }
});

test('the menu and opening-scene loader both select localized artwork', () => {
  const menu = readFileSync(new URL('../components/MainMenu.tsx', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../engine/RenderSystem.ts', import.meta.url), 'utf8');
  expect(menu).toContain("localizedTitleArtwork('title')");
  expect(renderer).toContain("localizedTitleArtwork('titletileset')");
});
