/**
 * Dialog coverage, against Original/res/xml.
 *
 * The story is the dialogs, and a missing one is invisible: the level plays
 * fine, a character just never speaks. `level_2_9_dialog_wanda` had been in
 * that state - its strings were ported into strings.ts, but no Dialog
 * referenced them and the level's mapping listed only Kyle, with a comment
 * noting it "has both wanda and kyle".
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LevelDialogs } from './dialogs';

const root = join(import.meta.dir, '../..');

/** Dialog scripts the original ships, by their resource name. */
function originalDialogs(): string[] {
  return readdirSync(join(root, 'Original/res/xml'))
    .filter((f) => f.includes('dialog') && f.endsWith('.xml'))
    .map((f) => f.replace(/\.xml$/, ''))
    .sort();
}

describe('dialog coverage', () => {
  test('every dialog script the original ships is ported', () => {
    const ported = new Set(Object.keys(LevelDialogs));
    const missing = originalDialogs().filter((name) => !ported.has(name));
    expect(missing, 'characters that would never speak').toEqual([]);
  });

  test('the original really does ship this many', () => {
    // Guards against the check passing because the glob found nothing.
    expect(originalDialogs().length).toBeGreaterThan(30);
  });

  test('every ported dialog has at least one page of text', () => {
    const empty: string[] = [];
    for (const [name, dialog] of Object.entries(LevelDialogs)) {
      const pages = dialog.conversations.flatMap((c) => c.pages);
      if (pages.length === 0) empty.push(name);
      for (const page of pages) {
        // A missing string key resolves to something falsy or the key itself;
        // either way the player sees nothing useful.
        if (!page.text || page.text.length < 2) empty.push(`${name} (blank page)`);
      }
    }
    expect(empty, 'dialogs that would show nothing').toEqual([]);
  });

  test('each dialog page count matches its script', () => {
    // A conversation that lost a page still plays, just truncated.
    const wrong: string[] = [];
    for (const name of originalDialogs()) {
      const dialog = LevelDialogs[name];
      if (!dialog) continue;
      const xml = readFileSync(join(root, `Original/res/xml/${name}.xml`), 'utf8');
      const xmlPages = (xml.match(/<page/g) ?? []).length;
      const portPages = dialog.conversations.reduce((n, c) => n + c.pages.length, 0);
      if (xmlPages !== portPages) {
        wrong.push(`${name}: script has ${xmlPages} pages, port has ${portPages}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
