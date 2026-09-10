import { afterEach, expect, test } from 'bun:test';
import { ScreenFade } from './ScreenFade';
import { sSystemRegistry } from './SystemRegistry';
import { GameFlowEvent, GameFlowEventType } from './GameFlowEvent';
import { HotSpotSystem, HotSpotType } from './HotSpotSystem';
import { GameObject } from '../entities/GameObject';
import { NPCComponent } from '../entities/components/NPCComponent';
import { readFileSync } from 'node:fs';
import { TimeSystem } from './TimeSystem';

test('App transition fades use the paused unscaled clock rather than display-frame deltas', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(source.includes('screenFade.update(displayDelta)')).toBe(false);
  expect(source.includes('new ScreenFade(() => timeSystem.getRealTime())')).toBe(true);
});

afterEach(() => sSystemRegistry.reset());

test('fade renders intermediate opacity, delivers once at black, and cancels on clear', () => {
  const clock = new TimeSystem();
  const fade = new ScreenFade(() => clock.getRealTime());
  const advance = (dt: number): void => { clock.update(dt); fade.update(); };
  let events = 0;
  fade.fadeOut(1.5, () => { events++; });
  advance(0.75);
  expect(events).toBe(0);
  let opacity = -1;
  const ctx = {
    globalAlpha: 0, fillStyle: '', save: (): void => {}, restore: (): void => {},
    fillRect: (): void => { opacity = ctx.globalAlpha; },
  };
  fade.render(ctx as unknown as CanvasRenderingContext2D, 480, 320);
  expect(opacity).toBe(0.5);
  fade.fadeOut(1.5, () => { events += 100; }); // Repeated contact must not reset it.
  advance(0.75);
  expect(fade.getOpacity()).toBe(1);
  expect(events).toBe(1);
  advance(10);
  expect(events).toBe(1);
  fade.clear();
  expect(fade.getOpacity()).toBe(0);
  fade.fadeOut(1.5, () => { events++; });
  fade.clear();
  advance(10);
  expect(events).toBe(1);
});

test('an NPC end-level hotspot waits for the full fade before dispatching its transition', () => {
  const clock = new TimeSystem();
  const fade = new ScreenFade(() => clock.getRealTime());
  const advance = (dt: number): void => { clock.update(dt); fade.update(); };
  const flow = new GameFlowEvent();
  sSystemRegistry.screenFade = fade;
  sSystemRegistry.register(flow, 'gameFlowEvent');
  const hotSpots = new HotSpotSystem();
  hotSpots.setWorld({ width: 3, height: 1,
    tiles: [[0], [HotSpotType.END_LEVEL], [HotSpotType.NPC_RUN_QUEUED_COMMANDS]] });
  hotSpots.setLevelDimensions(96, 32);
  sSystemRegistry.register(hotSpots, 'hotSpot');
  const object = new GameObject();
  object.width = object.height = 32;
  object.setPosition(32, 0);
  const npc = new NPCComponent();
  const events: number[] = [];
  flow.addListener((event) => events.push(event));
  npc.update(1 / 60, object);
  object.setPosition(64, 0); // Authored routes execute END_LEVEL from the command queue.
  npc.update(1 / 60, object);
  flow.update();
  expect(events).toEqual([]);
  advance(1.49);
  flow.update();
  expect(events).toEqual([]);
  expect(fade.getOpacity()).toBeGreaterThan(0.9);
  advance(0.02);
  flow.update();
  expect(events).toEqual([GameFlowEventType.GO_TO_NEXT_LEVEL]);
  advance(2);
  flow.update();
  expect(events).toHaveLength(1);
});

test('extra display frames and paused clocks cannot advance a fade, but hit-stop and scaling do not stretch it', () => {
  const clock = new TimeSystem();
  const fade = new ScreenFade(() => clock.getRealTime());
  let events = 0;
  clock.applyScale(0.1, 100, false); clock.freeze(10);
  fade.fadeOut(1.5, () => { events++; });
  fade.update();
  expect(fade.getOpacity()).toBe(0); // no time spent on the initiating frame
  clock.update(0.75); fade.update();
  expect(clock.getGameTime()).toBe(0);
  expect(fade.getOpacity()).toBe(0.5);
  for (let i = 0; i < 1000; i++) fade.update();
  expect(fade.getOpacity()).toBe(0.5);
  expect(events).toBe(0);
  clock.update(0.75); fade.update();
  expect(fade.getOpacity()).toBe(1);
  expect(events).toBe(1);
  for (let i = 0; i < 1000; i++) fade.update();
  expect(events).toBe(1);
  fade.clear(); clock.update(100);
  fade.fadeOut(1.5, () => { events++; });
  fade.update();
  expect(fade.getOpacity()).toBe(0);
  clock.update(1.5); fade.update();
  expect(events).toBe(2);
});
