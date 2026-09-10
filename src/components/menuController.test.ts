import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('every React menu mounts controller navigation, while Game guards the initial held-button handoff', () => {
  for (const name of ['MainMenu', 'DifficultyMenu', 'LevelSelect', 'OptionsMenu', 'ExtrasMenu']) {
    const source = readFileSync(new URL(`./${name}.tsx`, import.meta.url), 'utf8');
    expect(source).toContain('useMenuGamepad(');
    expect(source).toContain('ref={menuRef}');
  }
  const game = readFileSync(new URL('./Game.tsx', import.meta.url), 'utf8');
  expect(game).toContain('blockInitialGamepadInput: true');
});
