import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { levelTree, linearLevelTree, resourceToLevelId, type LevelGroup } from './levelTree';
import { LevelSystem } from '../levels/LevelSystemNew';

const resources = join(import.meta.dir, '../../Original/res');
const strings = new Map<string, string>();
for (const name of readdirSync(join(resources, 'values')).filter(name => name.endsWith('.xml'))) {
  for (const match of readFileSync(join(resources, 'values', name), 'utf8')
    .matchAll(/<string\s+name\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/string>/g)) {
    strings.set(match[1], match[2].trim());
  }
}

function originalTree(linear: boolean): LevelGroup[] {
  const xml = readFileSync(join(resources, 'xml', linear ? 'linear_level_tree.xml' : 'level_tree.xml'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
  return [...xml.matchAll(/<group>([\s\S]*?)<\/group>/g)].map((group, row) => ({
    levels: [...group[1].matchAll(/<level\s+([^>]+)>/g)].map((level, index) => {
      const attributes = Object.fromEntries([...level[1].matchAll(/(\w+)\s*=\s*"([^"]+)"/g)]
        .map(attribute => [attribute[1], attribute[2]]));
      const name = strings.get(attributes.title.replace('@string/', ''));
      const timeStamp = strings.get(attributes.time.replace('@string/', ''));
      expect(name).toBeDefined();
      expect(timeStamp).toBeDefined();
      return {
        resource: attributes.resource.replace('@raw/', ''), name: name!, timeStamp: timeStamp!,
        inThePast: attributes.past === 'true', restartable: attributes.restartable !== 'false',
        showWaitMessage: attributes.waitmessage === 'true', completed: false, row, index,
      };
    }),
  }));
}

test.each([false, true])('campaign metadata matches every original group and level (linear: %s)', linear => {
  const expected = originalTree(linear);
  expect(expected).toHaveLength(linear ? 40 : 32);
  expect(linear ? linearLevelTree : levelTree).toEqual(expected);
});

test('runtime mode switches use the selected tree, including flashback flags and group indices', () => {
  const system = new LevelSystem();
  for (const linear of [false, true, false]) {
    system.setLinearMode(linear);
    const expected = originalTree(linear);
    expect(system.getAllLevels().map(level => level.file)).toEqual(expected.flatMap(group => group.levels.map(level => level.resource)));
    for (const [row, group] of expected.entries()) {
      for (const level of group.levels) {
        const actual = system.getLevelInfo(resourceToLevelId[level.resource])!;
        expect(actual.inThePast, `${linear}: ${level.resource}`).toBe(level.inThePast);
        expect(actual.restartable).toBe(level.restartable);
        expect(actual.groupIndex).toBe(row);
        expect(actual.name).toBe(level.name);
        if (linear) {
          (system as unknown as { currentLevelId: number }).currentLevelId = actual.id;
          expect(system.getUnlockedLevelsInCurrentGroup()).toEqual([actual.id]);
          const next = expected[row + 1]?.levels[0];
          expect(system.getNextLevelId()).toBe(next ? resourceToLevelId[next.resource] : null);
        }
      }
    }
    system.loadLevelProgress();
    if (linear) expect(system.getAllLevels().every(level => level.unlocked)).toBe(true);
  }
});
