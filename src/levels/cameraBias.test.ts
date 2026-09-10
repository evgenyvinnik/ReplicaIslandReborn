import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CameraSystem } from '../engine/CameraSystem';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObject } from '../entities/GameObject';
import { GameObjectManager } from '../entities/GameObjectManager';
import { CameraBiasComponent, setCameraBiasSystemRegistry } from '../entities/components/CameraBiasComponent';
import { resourceToLevelId } from '../data/levelTree';
import { Vector2 } from '../utils/Vector2';
import { LevelSystem } from './LevelSystemNew';

const originalFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const pathname = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const asset = file(join(import.meta.dir, '../../public', pathname));
    return await asset.exists()
      ? new Response(await asset.arrayBuffer())
      : new Response(null, { status: 404 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });
afterEach(() => { sSystemRegistry.reset(); });

function cameraWithVerticalSlack(moving = true, width = 480, height = 320): CameraSystem {
  const camera = new CameraSystem(width, height);
  const player = new GameObject();
  player.width = player.height = 64;
  player.setPosition(968, 918); // Centre (1000, 950), 50px above camera centre.
  player.setVelocity(moving ? 10 : 0, 0);
  camera.setTarget(player);
  camera.setPosition(1000, 1000);
  return camera;
}

function centreY(camera: CameraSystem): number {
  return camera.getPosition().y + camera.getViewportHeight() / 2;
}

describe('authored camera focus markers', () => {
  test('a point above the view centre pulls upward, independently of viewport size', () => {
    for (const [width, height] of [[480, 320], [800, 600]]) {
      const camera = cameraWithVerticalSlack(true, width, height);
      camera.addCameraBias(new Vector2(1000, 980));
      camera.update(0.1);
      expect(centreY(camera)).toBe(960); // Original BIAS_SPEED = 400 px/s.
    }
  });

  test('opposite markers cancel and a marker at the focal point contributes nothing', () => {
    const camera = cameraWithVerticalSlack();
    camera.addCameraBias(new Vector2(1000, 900));
    camera.addCameraBias(new Vector2(1000, 1100));
    camera.addCameraBias(new Vector2(1000, 1000));
    camera.update(0.1);
    expect(centreY(camera)).toBe(1000);
  });

  test('bias requires target movement and is consumed once per frame', () => {
    const stationary = cameraWithVerticalSlack(false);
    stationary.addCameraBias(new Vector2(1000, 900));
    stationary.update(0.1);
    expect(centreY(stationary)).toBe(1000);

    const moving = cameraWithVerticalSlack();
    moving.addCameraBias(new Vector2(1000, 980));
    moving.update(0.1);
    const afterBias = centreY(moving);
    moving.update(0.1);
    expect(centreY(moving)).toBe(afterBias);
  });

  test('the component submits the original bottom-left anchor without moving its marker', () => {
    const camera = cameraWithVerticalSlack();
    sSystemRegistry.cameraSystem = camera;
    setCameraBiasSystemRegistry(sSystemRegistry);
    const marker = new GameObject();
    marker.width = marker.height = 32;
    marker.setPosition(1000, 980); // Original anchor is (1000, 1012), below focus.
    new CameraBiasComponent().update(0.1, marker);
    camera.update(0.1);
    expect(centreY(camera)).toBe(1040);
    expect(marker.getPosition()).toEqual(new Vector2(1000, 980));
  });

  for (const [resource, count] of [
    ['level_2_7_grass', 3],
    ['level_3_8_sewer', 1],
    ['level_4_7_underground', 8],
  ] as const) {
    test(`${resource}: all ${count} shipped markers deactivate at distance and reactivate locally`, async () => {
      const manager = new GameObjectManager();
      const level = new LevelSystem();
      const camera = new CameraSystem(480, 320);
      manager.setCamera(camera);
      sSystemRegistry.cameraSystem = camera;
      setCameraBiasSystemRegistry(sSystemRegistry);
      level.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
      expect(await level.loadLevel(resourceToLevelId[resource])).toBe(true);
      manager.commitUpdates();
      const markers = manager.getActiveObjects().filter(object => object.type === 'camera_bias');
      expect(markers).toHaveLength(count);
      const radius = Math.hypot(240, 160) + 128; // spawnCameraBias: mTightActivationRadius.
      for (const marker of markers) expect(marker.activationRadius).toBeCloseTo(radius, 8);

      camera.setBounds(null);
      camera.setPosition(-10000, -10000);
      manager.update(0, 0);
      expect(markers.every(marker => !marker.isActive())).toBe(true);

      // Exercise real manager activation; no actor or terrain is moved.
      for (const marker of markers) {
        const anchor = new Vector2(marker.getPosition().x, marker.getPosition().y + marker.height);
        camera.setPosition(anchor.x, anchor.y);
        manager.update(0, 0);
        for (const other of markers) {
          const dx = other.getPosition().x - anchor.x;
          const dy = other.getPosition().y + other.height - anchor.y;
          expect(other.isActive()).toBe(dx * dx + dy * dy < radius * radius);
        }
      }
    });
  }
});
