import { expect, test } from 'bun:test';
import { InputSystem } from './InputSystem';
import { CanvasMenuInput, type CanvasMenuTarget } from './CanvasMenuInput';
import { CanvasDialog } from './CanvasDialog';
import { CanvasDiaryOverlay } from './CanvasDiaryOverlay';
import { CanvasPauseMenu } from './CanvasPauseMenu';
import { CanvasCutscene } from './CanvasCutscene';
import { CanvasLevelCompleteScreen } from './CanvasLevelCompleteScreen';
import { CanvasGameOverScreen } from './CanvasGameOverScreen';
import { CanvasEndingStatsScreen } from './CanvasEndingStatsScreen';
import { DiaryEntries } from '../data/diaries';
import { CutsceneType } from '../data/cutscenes';

test('real canvas overlays accept controller input while preserving their lifecycle guards', async () => {
  const oldWindow = globalThis.window, oldImage = globalThis.Image;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  globalThis.window = new globalThis.EventTarget() as unknown as typeof window;
  globalThis.Image = class {
    width = 480; height = 320; onload: (() => void) | null = null;
    set src(_value: string) { globalThis.queueMicrotask(() => this.onload?.()); }
  } as unknown as typeof Image;
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  Object.defineProperty(globalThis, 'navigator', { configurable: true,
    value: { getGamepads: () => [{ connected: true, index: 0, axes: [0, 0], buttons }] } });
  const canvas = new globalThis.EventTarget() as HTMLCanvasElement;
  const labels: string[] = [];
  const labelY = new Map<string, number>();
  const ctx = new Proxy({ font: '',
    measureText: (text: string): { width: number } => ({ width: text.length * 8 }),
    fillText: (text: string, _x: number, y: number): void => { labels.push(text); labelY.set(text, y); },
  }, { get: (target, name): unknown => Reflect.get(target, name) ?? ((): void => {}) }) as unknown as CanvasRenderingContext2D;
  const dialog = new CanvasDialog(ctx, canvas, 480, 320);
  const diary = new CanvasDiaryOverlay(ctx, canvas, 480, 320);
  const pause = new CanvasPauseMenu(ctx, canvas, 480, 320);
  const cutscene = new CanvasCutscene(ctx, canvas, 480, 320);
  const complete = new CanvasLevelCompleteScreen(ctx, canvas, 480, 320);
  const gameOver = new CanvasGameOverScreen(ctx, canvas, 480, 320);
  const ending = new CanvasEndingStatsScreen(ctx, canvas, 480, 320);
  const input = new InputSystem({ touchGestures: false }), menu = new CanvasMenuInput(input);
  const tick = (target: CanvasMenuTarget | null): void => { input.update(); menu.update(target, 1 / 60); };
  const press = (target: CanvasMenuTarget, button = 0): void => {
    buttons.forEach(value => { value.pressed = false; }); tick(target);
    buttons[button].pressed = true; tick(target);
  };
  let completed = 0, skipped = 0, closed = 0, resumed = 0, continued = 0, mainMenu = 0, retried = 0, ended = 0;
  try {
    dialog.show({ conversations: [{ pages: [{ text: 'First' }, { text: 'Last' }] }] },
      () => { completed++; }, () => { skipped++; });
    press(dialog);
    for (let i = 0; i < 60; i++) tick(dialog);
    expect(completed).toBe(0);
    labels.length = 0; dialog.render(); expect(labels).toContain('Last');
    press(dialog); expect(completed).toBe(1);
    tick(null); expect(input.getInputState().jump).toBe(false);
    dialog.show({ conversations: [{ pages: [{ text: 'Skip me' }] }] }, () => {}, () => { skipped++; });
    press(dialog, 1); expect(skipped).toBe(1);

    diary.show(DiaryEntries[0], () => { closed++; }); diary.update(1);
    labels.length = 0; diary.render(); const initialY = labelY.get('wholly unnatural beauty.')!;
    press(diary, 13);
    for (let i = 0; i < 240; i++) tick(diary);
    labels.length = 0; diary.render();
    expect(labelY.get('wholly unnatural beauty.')!).toBeLessThan(initialY);
    expect(labelY.get('wholly unnatural beauty.')!).toBeLessThanOrEqual(280);
    expect(labels.some(text => text.includes('beauty.'))).toBe(true);
    expect(closed).toBe(0);
    press(diary, 1); expect(closed).toBe(1);
    for (let i = 0; i < 60; i++) tick(diary);
    expect(closed).toBe(1);
    diary.update(1); expect(diary.isVisible()).toBe(false);
    tick(null); expect(input.getInputState().attack).toBe(false);

    pause.show(() => { resumed++; }); press(pause, 9);
    expect(resumed).toBe(1); expect(pause.isShowing()).toBe(false);
    for (let i = 0; i < 60; i++) tick(pause);
    expect(resumed).toBe(1);

    complete.show('Lab', () => { continued++; }, () => { mainMenu++; });
    press(complete); complete.update(0.5);
    expect(continued).toBe(1); expect(complete.isShowing()).toBe(false);
    complete.show('Lab', () => { continued++; }, () => { mainMenu++; });
    press(complete, 13); press(complete); complete.update(0.5);
    expect(mainMenu).toBe(1); expect(continued).toBe(1);
    gameOver.show(() => { retried++; }, () => { mainMenu++; });
    press(gameOver); gameOver.update(0.5); expect(retried).toBe(1);
    gameOver.show(() => { retried++; }, () => { mainMenu++; });
    press(gameOver, 12); press(gameOver); gameOver.update(0.5); expect(mainMenu).toBe(2);

    ending.show({ totalPlayTime: 1, totalScore: 0, totalCoinsCollected: 0, totalRubiesCollected: 0,
      totalEnemiesDefeated: 0, totalDeaths: 0, diariesCollected: 0, ending: 'good' }, () => { ended++; });
    press(ending); expect(ended).toBe(0);
    ending.update(3); tick(ending); expect(ended).toBe(0); // held through reveal cannot auto-dismiss
    press(ending); expect(ended).toBe(1); expect(ending.isShowing()).toBe(false);

    await cutscene.play(CutsceneType.WANDA_ENDING, () => { ended++; });
    press(cutscene, 1); expect(ended).toBe(1);
    cutscene.update(6); tick(cutscene); expect(ended).toBe(1);
    press(cutscene, 1); expect(ended).toBe(2); expect(cutscene.isActive()).toBe(false);
  } finally {
    dialog.hide(); diary.hide(); pause.hide(); cutscene.stop(); complete.hide(); gameOver.hide(); ending.hide();
    globalThis.window = oldWindow; globalThis.Image = oldImage;
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
