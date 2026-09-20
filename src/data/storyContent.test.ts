import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDialogsForLevel, LevelDialogs } from './dialogs';
import { getString } from './strings';

const resources = join(import.meta.dir, '../../Original/res');

test.each(['level_tree', 'linear_level_tree'])('%s preserves character slots for every level dialogue', tree => {
  const xml = readFileSync(join(resources, 'xml', `${tree}.xml`), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const levels = [...xml.matchAll(/<level\b([^>]*?)(?:\/>|>([\s\S]*?)<\/level>)/g)];
  expect(levels.length).toBeGreaterThan(35);
  for (const level of levels) {
    const resource = level[1].match(/resource\s*=\s*"@raw\/([^"]+)"/)![1];
    const expected: Array<string | undefined> = [undefined, undefined];
    for (const slot of (level[2] ?? '').matchAll(/<character([12])\s+resource\s*=\s*"@xml\/([^"]+)"/g)) {
      expected[Number(slot[1]) - 1] = slot[2];
    }
    for (const extension of ['', '.bin', '.json']) {
      const actual = getDialogsForLevel(resource + extension);
      for (let index = 0; index < 2; index++) {
        const key = expected[index];
        if (key) expect(LevelDialogs[key], key).toBeDefined();
        expect(actual[index], `${resource} character ${index + 1}`).toBe(key ? LevelDialogs[key] : undefined);
      }
    }
  }
});
const dialogNames = readdirSync(join(resources, 'xml'))
  .filter(name => name.includes('dialog') && name.endsWith('.xml'))
  .map(name => name.slice(0, -4));
const originalStrings = new Map<string, string>();
for (const name of readdirSync(join(resources, 'values')).filter(name => name.endsWith('.xml'))) {
  const xml = readFileSync(join(resources, 'values', name), 'utf8');
  for (const match of xml.matchAll(/<string\s+name\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/string>/g)) {
    originalStrings.set(match[1], match[2]);
  }
}

// These six instructions deliberately describe the web input devices instead
// of Android's trackball/tilt controls. Their content is tested separately.
const webTutorialKeys = new Set([
  'Kabocha_0_2_1_3', 'Kabocha_0_2_2_1', 'Kabocha_0_2_2_2',
  'Kabocha_0_2_5_3', 'Kabocha_0_3_2_1', 'Kabocha_0_3_2_2',
]);

/** Compare words independently of XML emphasis, typography and line wrapping. */
function plainText(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\\n/g, ' ')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, '--')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

type RenderedPage = { character?: string; portrait?: string; text: string };
type OriginalPage = Omit<RenderedPage, 'text'> & { textKey: string };

function originalConversations(name: string): OriginalPage[][] {
  const xml = readFileSync(join(resources, 'xml', `${name}.xml`), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
  return [...xml.matchAll(/<conversation\b[^>]*>([\s\S]*?)<\/conversation>/g)]
    .map(conversation => [...conversation[1].matchAll(/<page\b([\s\S]*?)\/>/g)]
      .map(page => {
        const attributes = Object.fromEntries([...page[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)]
          .map(attribute => [attribute[1], attribute[2]]));
        return {
          character: attributes.title?.replace('@string/', ''),
          portrait: attributes.image?.replace('@drawable/', ''),
          textKey: attributes.text.replace('@string/', ''),
        };
      }));
}

test.each(dialogNames)('%s preserves conversation boundaries, speaker, portrait and words', name => {
  const expected = originalConversations(name);
  const actual: RenderedPage[][] = LevelDialogs[name].conversations.map(conversation => conversation.pages.map(page => ({
    character: page.character,
    portrait: page.portrait?.split('/').pop()?.replace('.png', ''),
    text: page.text,
  })));
  // Comparing the nested structure catches misplaced pages even when a
  // script's total page count is unchanged (as in the duplicated Kyle script).
  expect(actual).toEqual(expected.map(conversation => conversation.map(page => ({
    character: page.character,
    portrait: page.portrait,
    text: getString(page.textKey),
  }))));

  for (const page of expected.flat()) {
    const source = originalStrings.get(page.textKey);
    expect(source, page.textKey).toBeDefined();
    expect(getString(page.textKey), `unresolved ${page.textKey}`).not.toBe(page.textKey);
    if (webTutorialKeys.has(page.textKey)) continue;
    // Canvas currently represents this one emphasized "my" as capitals.
    const original = page.textKey === 'Kabocha_final_boss_1_1'
      ? source!.replace(/<i>my<\/i>/g, 'MY') : source!;
    expect(plainText(getString(page.textKey)), page.textKey).toBe(plainText(original));
  }
});

test('the last grass level routes each character to its own conversation', () => {
  const [wanda, kyle] = getDialogsForLevel('level_2_9_grass');
  expect(wanda).toBe(LevelDialogs.level_2_9_dialog_wanda);
  expect(kyle).toBe(LevelDialogs.level_2_9_dialog_kyle);
  expect(wanda!.conversations[0].pages.every(page => page.character === 'Wanda')).toBe(true);
  expect(kyle!.conversations[0].pages.every(page => page.character === 'Kyle')).toBe(true);
  expect(kyle!.conversations[0].pages.map(page => page.text))
    .not.toEqual(wanda!.conversations[0].pages.map(page => page.text));
});
