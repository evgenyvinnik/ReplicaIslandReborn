import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DiaryEntries } from './diaries';

const original = readFileSync(new URL('../../Original/res/values/strings.xml', import.meta.url), 'utf8');

function normalizeDiaryText(text: string): string {
  return text
    .replace(/\\n/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

test('all 15 playable log entries preserve the complete original Android text', () => {
  const sourceEntries = new Map(
    [...original.matchAll(/<string name="Diary(\d+)">([\s\S]*?)<\/string>/g)]
      .map((match) => [Number(match[1]), normalizeDiaryText(match[2])] as const),
  );
  expect(sourceEntries.size).toBe(15);
  expect(DiaryEntries.map((entry) => entry.id)).toEqual([...sourceEntries.keys()]);

  for (const entry of DiaryEntries) {
    // Three source entries start with prose rather than a "Log Entry" heading.
    const visibleText = entry.title === '???' ? entry.text : `${entry.title} ${entry.text}`;
    const sourceText = sourceEntries.get(entry.id);
    expect(sourceText).toBeDefined();
    expect(normalizeDiaryText(visibleText), `Diary${entry.id}`).toBe(sourceText!);
  }
});
