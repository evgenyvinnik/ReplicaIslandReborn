import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('the phone Back handler includes every top-level menu destination', () => {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('const handleBack ='), source.indexOf('const handleHome ='));
  for (const menu of ['LEVEL_SELECT', 'DIFFICULTY_SELECT', 'OPTIONS', 'EXTRAS']) {
    expect(handler).toContain(`case GameState.${menu}:`);
  }
});
