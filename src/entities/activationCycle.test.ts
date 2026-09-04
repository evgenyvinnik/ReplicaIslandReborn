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
