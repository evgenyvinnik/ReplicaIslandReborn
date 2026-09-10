import { expect, test } from 'bun:test';
import { DiaryEntries } from '../data/diaries';
import { CanvasEndingStatsScreen } from './CanvasEndingStatsScreen';

test('ending diary completion uses the shipped catalogue rather than an invented total', () => {
  const originalWindow = globalThis.window;
  globalThis.window = new globalThis.EventTarget() as unknown as typeof window;
  const canvas = new globalThis.EventTarget();
  const labels: string[] = [];
  const textY = new Map<string, number>();
  let separatorY = 0;
  const context = new Proxy({
    fillText: (text: string, _x: number, y: number): void => { labels.push(text); textY.set(text, y); },
    moveTo: (_x: number, y: number): void => { separatorY = y; },
  }, { get: (target, key): unknown => Reflect.get(target, key) ?? ((): void => {}) });
  const screen = new CanvasEndingStatsScreen(
    context as unknown as CanvasRenderingContext2D, canvas as HTMLCanvasElement, 480, 320
  );
  try {
    // Keep the former caller's erroneous field here: catalogue ownership must
    // prevent it from making a fully collected game look incomplete.
    const stats = {
      totalPlayTime: 123, totalScore: 50, totalCoinsCollected: 70,
      totalRubiesCollected: 3, totalEnemiesDefeated: 2, totalDeaths: 1,
      diariesCollected: DiaryEntries.length, totalDiaries: 20, ending: 'good' as const,
    };
    screen.show(stats, () => {});
    screen.update(3);
    screen.render();
    expect(DiaryEntries).toHaveLength(15);
    expect(labels).toContain('15/15');
    expect(labels).not.toContain('15/20');
    expect(separatorY).toBeGreaterThan(textY.get('Diaries')!);
    expect(separatorY).toBeLessThan(textY.get('Press any key to continue')!);
    expect(labels).toContain('Thanks for playing!');
    screen.hide();
    labels.length = 0;
    screen.show({ ...stats, partialHistory: true }, () => {});
    screen.update(3);
    screen.render();
    expect(labels).toContain('Stats since save upgrade');
    expect(labels).not.toContain('Thanks for playing!');
  } finally {
    screen.hide();
    globalThis.window = originalWindow;
  }
});

test('ending Continue calls its callback once for a click or confirmation key', () => {
  const originalWindow = globalThis.window;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof window;
  const canvas = new globalThis.EventTarget();
  const screen = new CanvasEndingStatsScreen({} as CanvasRenderingContext2D, canvas as HTMLCanvasElement, 480, 320);
  const stats = {
    totalPlayTime: 123, totalScore: 50, totalCoinsCollected: 70,
    totalRubiesCollected: 3, totalEnemiesDefeated: 2, totalDeaths: 1,
    diariesCollected: 15, ending: 'good' as const,
  };
  let continues = 0;
  const click = (): void => { canvas.dispatchEvent(new globalThis.Event('click', { cancelable: true })); };
  const enter = (): void => {
    const event = new globalThis.Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: 'Enter' });
    keys.dispatchEvent(event);
  };
  try {
    screen.show(stats, () => { continues++; });
    click();
    expect(continues).toBe(0); // reveal delay still protects the screen
    screen.update(3);
    click();
    expect(continues).toBe(1);
    expect(screen.isShowing()).toBe(false);
    click();
    enter();
    expect(continues).toBe(1); // listeners detached
    screen.show(stats, () => { continues++; });
    screen.update(3);
    enter();
    expect(continues).toBe(2);
    expect(screen.isShowing()).toBe(false);
  } finally {
    screen.hide();
    globalThis.window = originalWindow;
  }
});
