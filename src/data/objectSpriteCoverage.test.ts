import { expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { createDoorAnimations } from './doorAnimations';
import { createPlayerAnimations } from './playerAnimations';

/** A frame name must resolve to an image loaded by Game, not just a mock renderer. */
test('every gameplay animation frame has a loaded sprite key and a shipped PNG', async () => {
  const gameSource = await file(join(import.meta.dir, '../components/Game.tsx')).text();

  const assets = new Map<string, string>();
  for (const match of gameSource.matchAll(/\{\s*name:\s*'([^']+)',\s*file:\s*'([^']+)'/g)) {
    assets.set(match[1], match[2]);
  }
  const frames = new Set<string>();
  for (const sourceFile of ['objectAnimations.ts', 'enemyAnimations.ts', 'npcAnimations.ts']) {
    const animationSource = await file(join(import.meta.dir, sourceFile)).text();
    const frameLists = sourceFile === 'objectAnimations.ts'
      ? /frames:\s*\[([^\]]*)\]/gs
      : /(?:idle|walk|attack|hidden|appear|death|runStart|run|jumpStart|jump|shoot|hit|surprised):\s*\[([^\]]*)\]/gs;
    for (const list of animationSource.matchAll(frameLists)) {
      for (const frame of list[1].matchAll(/'([^']+)'/g)) frames.add(frame[1]);
    }
  }
  for (const color of ['red', 'blue', 'green']) {
    for (const animation of createDoorAnimations(color).values()) {
      for (const frame of animation.frames) if (frame.sprite) frames.add(frame.sprite);
    }
    frames.add(`object_button_${color}`);
    frames.add(`object_button_pressed_${color}`);
  }
  for (const animation of createPlayerAnimations().values()) {
    for (const frame of animation.frames) if (frame.sprite) frames.add(frame.sprite);
  }

  const missingKeys = [...frames].filter(name => !assets.has(name));
  expect(missingKeys).toEqual([]);
  const missingFiles: string[] = [];
  for (const name of frames) {
    const image = assets.get(name);
    if (image && !(await file(join(import.meta.dir, `../../public/assets/sprites/${image}.png`)).exists())) {
      missingFiles.push(`${name}: ${image}.png`);
    }
  }
  expect(missingFiles).toEqual([]);
  expect(frames.size).toBeGreaterThan(100);
});
