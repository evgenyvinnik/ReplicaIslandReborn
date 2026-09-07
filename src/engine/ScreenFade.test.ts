import { afterEach, expect, test } from 'bun:test';
import { ScreenFade } from './ScreenFade';
import { sSystemRegistry } from './SystemRegistry';
import { GameFlowEvent, GameFlowEventType } from './GameFlowEvent';
import { HotSpotSystem, HotSpotType } from './HotSpotSystem';
import { GameObject } from '../entities/GameObject';
import { NPCComponent } from '../entities/components/NPCComponent';

afterEach(() => sSystemRegistry.reset());

test('fade renders intermediate opacity, delivers once at black, and cancels on clear', () => {
  const fade = new ScreenFade();
  let events = 0;
  fade.fadeOut(1.5, () => { events++; });
  fade.update(0.75);
  expect(events).toBe(0);
  let opacity = -1;
  const ctx = {
    globalAlpha: 0, fillStyle: '', save: (): void => {}, restore: (): void => {},
    fillRect: (): void => { opacity = ctx.globalAlpha; },
  };
  fade.render(ctx as unknown as CanvasRenderingContext2D, 480, 320);
  expect(opacity).toBe(0.5);
  fade.fadeOut(1.5, () => { events += 100; }); // Repeated contact must not reset it.
  fade.update(0.75);
  expect(fade.getOpacity()).toBe(1);
  expect(events).toBe(1);
  fade.update(10);
  expect(events).toBe(1);
  fade.clear();
  expect(fade.getOpacity()).toBe(0);
  fade.fadeOut(1.5, () => { events++; });
  fade.clear();
  fade.update(10);
  expect(events).toBe(1);
});

test('an NPC end-level hotspot waits for the full fade before dispatching its transition', () => {
  const fade = new ScreenFade();
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
  fade.update(1.49);
  flow.update();
  expect(events).toEqual([]);
  expect(fade.getOpacity()).toBeGreaterThan(0.9);
  fade.update(0.02);
  flow.update();
  expect(events).toEqual([GameFlowEventType.GO_TO_NEXT_LEVEL]);
  fade.update(2);
  flow.update();
  expect(events).toHaveLength(1);
});
