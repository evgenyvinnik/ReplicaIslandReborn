/**
 * Objects must not end up in the active list twice.
 *
 * `GameObjectManager.updateActivation()` moves objects between an active and
 * an inactive list as the camera moves. Every component that registers work
 * per update - `DynamicCollisionComponent` submitting attack and vulnerability
 * volumes above all - does so once per appearance in that list, so a duplicate
 * silently doubles everything: an enemy takes two hits per stomp, and a ghost's
 * POSSESS lands twice, which is worse than useless because the possession swap
 * ping-pongs and the second hit undoes the first.
 */

import { beforeEach, expect, test } from 'bun:test';
import { GameObjectManager } from './GameObjectManager';
import { GameObject } from './GameObject';
import { GameComponent } from './GameComponent';
import { CameraSystem } from '../engine/CameraSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';

let manager: GameObjectManager;
let camera: CameraSystem;

beforeEach(() => {
  sSystemRegistry.reset();
  manager = new GameObjectManager();
  camera = new CameraSystem(480, 320);
  manager.setCamera(camera);
});

function place(x: number, y: number, radius: number): GameObject {
  const o = new GameObject();
  o.width = 32;
  o.height = 32;
  o.setPosition(x, y);
  o.activationRadius = radius;
  manager.add(o);
  return o;
}

function countIn(list: GameObject[], object: GameObject): number {
  return list.filter((o) => o === object).length;
}

test('activation matches the original bottom-left position after Y-down conversion', () => {
  const worldHeight = 4096;
  const originalFocus = { x: 1000, y: 2000 };
  camera.setPosition(originalFocus.x, worldHeight - originalFocus.y);
  const samples: Array<{ object: GameObject; expected: boolean; label: string }> = [];
  const offsets = [-101, -100, -99, -80, 0, 80, 99, 100, 101];
  for (const height of [16, 32, 64, 128]) {
    for (const dx of offsets) {
      for (const dy of offsets) {
        const originalX = originalFocus.x + dx;
        const originalY = originalFocus.y + dy;
        // Android stores the bottom-left; Canvas stores the top-left.
        const object = place(originalX, worldHeight - originalY - height, 100);
        object.width = 128;
        object.height = height;
        samples.push({ object, expected: dx * dx + dy * dy < 100 * 100,
          label: `height=${height}, original offset=${dx},${dy}` });
      }
    }
  }
  manager.update(1 / 60, 1 / 60);
  for (const { object, expected, label } of samples) {
    expect(object.isActive(), label).toBe(expected);
    expect(countIn(manager.getActiveObjects(), object), label).toBe(expected ? 1 : 0);
  }
});

test('a tall object reactivates and deactivates by its converted feet, not its head', () => {
  const object = place(1000, 1000, 100);
  object.height = 128;
  // Head is close, feet are outside the radius.
  camera.setPosition(1000, 1000);
  manager.update(1 / 60, 1 / 60);
  expect(object.isActive()).toBe(false);
  expect(manager.getInactiveObjectCount()).toBe(1);
  for (let pass = 0; pass < 3; pass++) {
    // Feet are close, head is outside the radius.
    camera.setPosition(1000, 1200);
    manager.update(1 / 60, pass + 1);
    expect(object.isActive()).toBe(true);
    expect(countIn(manager.getActiveObjects(), object)).toBe(1);
    expect(manager.getInactiveObjectCount()).toBe(0);
    camera.setPosition(1000, 1000);
    manager.update(1 / 60, pass + 1.5);
    expect(object.isActive()).toBe(false);
    expect(manager.getInactiveObjectCount()).toBe(1);
  }
});

test('one activation pass stops every out-of-range object before its components run', () => {
  class UpdateCounter extends GameComponent {
    updates = 0;
    override update(): void { this.updates++; }
    override reset(): void { this.updates = 0; }
  }
  camera.setPosition(1000, 1000);
  const counters: UpdateCounter[] = [];
  const objects: GameObject[] = [];
  for (let i = 0; i < 8; i++) {
    const object = manager.createObject();
    object.width = object.height = 32;
    object.setPosition(i === 3 ? 1000 : 2000, 968);
    object.activationRadius = 100;
    object.destroyOnDeactivation = i % 2 === 0;
    const counter = new UpdateCounter();
    object.addComponent(counter);
    counters.push(counter);
    objects.push(object);
    manager.add(object);
  }
  const released: GameObject[] = [];
  manager.setComponentReleaseHandler(object => { released.push(object); });
  manager.update(1 / 60, 1);
  expect(counters.map(counter => counter.updates)).toEqual([0, 0, 0, 1, 0, 0, 0, 0]);
  expect(objects.map(object => object.isActive())).toEqual([false, false, false, true, false, false, false, false]);
  manager.update(1 / 60, 2);
  expect(counters.map(counter => counter.updates)).toEqual([0, 0, 0, 2, 0, 0, 0, 0]);
  expect(released).toHaveLength(4);
  expect(new Set(released).size).toBe(4);
  expect(manager.getActiveObjects()).toEqual([objects[3]!]);
  expect(manager.getInactiveObjectCount()).toBe(3);
});

test('an object driven in and out of range appears once', () => {
  const object = place(1000, 1000, 400);
  manager.commitUpdates();

  // Walk the camera past it and back, several times, as play does.
  for (let pass = 0; pass < 5; pass++) {
    for (const x of [1000, 3000, 1000, 3000]) {
      camera.setPosition(x, 1000);
      manager.update(1 / 60, pass / 60);
    }
  }

  camera.setPosition(1000, 1000);
  manager.update(1 / 60, 1);
  expect(countIn(manager.getActiveObjects(), object), 'duplicated in the active list').toBe(1);
});

test('an always-active object is never duplicated either', () => {
  // ALWAYS_ACTIVE objects skip the deactivation pass but still match the
  // reactivation test, so anything that ever reached the inactive list would
  // be re-added to the active one on every single frame.
  const object = place(1000, 1000, -1);
  manager.commitUpdates();

  for (let i = 0; i < 20; i++) {
    camera.setPosition(i % 2 === 0 ? 1000 : 9000, 1000);
    manager.update(1 / 60, i / 60);
  }

  expect(countIn(manager.getActiveObjects(), object)).toBe(1);
});

test('a mix of objects keeps the active list free of duplicates', () => {
  const near = place(1000, 1000, 400);
  const far = place(5000, 1000, 400);
  const always = place(2000, 1000, -1);
  manager.commitUpdates();

  for (let i = 0; i < 40; i++) {
    camera.setPosition(1000 + (i % 6) * 900, 1000);
    manager.update(1 / 60, i / 60);
  }

  const active = manager.getActiveObjects();
  for (const [name, object] of [['near', near], ['far', far], ['always', always]] as const) {
    expect(countIn(active, object), `${name} appears more than once`).toBeLessThanOrEqual(1);
  }
  // And nothing is in the list twice at all.
  expect(new Set(active).size).toBe(active.length);
});
