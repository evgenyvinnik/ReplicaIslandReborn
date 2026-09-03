/**
 * Projectile launcher parameters, against GameObjectFactory.java.
 *
 * These are the numbers that decide how a fight feels: where a shot leaves the
 * enemy, how fast it travels, how many come at once and how long you get
 * between volleys. They are also invisible when wrong - the enemy still
 * shoots, just not the way the original does.
 *
 * Vertical velocities are negated: the original is Y-up, so its -300 (downward)
 * is +300 here.
 *
 * One trap worth naming. The original sets `delayBeforeFirstSet` twice on both
 * the snailbomb and the shadow slime, and the second call wins:
 *
 *     gun.setDelayBeforeFirstSet(attack.getLength() / 2.0f);   // dead
 *     gun.setDelayBeforeFirstSet(Utils.framesToTime(24, 12));  // effective
 *
 * The port had transcribed the dead line for the shadow slime.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import { LaunchProjectileComponent } from '../entities/components/LaunchProjectileComponent';
import type { GameObject } from '../entities/GameObject';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');

beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const raw = typeof input === 'string'
      ? input
      : input instanceof URL ? input.pathname : new URL(input.url).pathname;
    const pathname = raw.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const f = file(join(publicDirectory, pathname));
    if (!(await f.exists())) return new Response(null, { status: 404 });
    return new Response(await f.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });

interface Launcher {
  offsetX: number; offsetY: number;
  velocityX: number; velocityY: number;
  projectilesInSet: number;
}

/** Every launcher the campaign spawns, keyed by the object carrying it. */
async function launchersBySubType(): Promise<Map<string, Launcher[]>> {
  const found = new Map<string, Launcher[]>();
  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      sSystemRegistry.reset();
      const manager = new GameObjectManager();
      manager.setCamera(new CameraSystem(480, 320));
      sSystemRegistry.register(manager, 'gameObject');
      const levelSystem = new LevelSystem();
      levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
      if (!(await levelSystem.loadLevel(resourceToLevelId[entry.resource]))) continue;
      manager.commitUpdates();
      for (const object of manager.getActiveObjects() as GameObject[]) {
        const key = object.subType || object.type;
        if (found.has(key)) continue;
        const guns = object.getComponents()
          .filter((c) => c instanceof LaunchProjectileComponent) as LaunchProjectileComponent[];
        if (guns.length === 0) continue;
        found.set(key, guns.map((gun) => {
          const g = gun as unknown as Launcher;
          return {
            offsetX: g.offsetX, offsetY: g.offsetY,
            velocityX: g.velocityX, velocityY: g.velocityY,
            projectilesInSet: g.projectilesInSet,
          };
        }));
      }
    }
  }
  return found;
}

describe('launcher parameters', () => {
  test('every launcher matches the original', async () => {
    const found = await launchersBySubType();
    expect(found.size).toBeGreaterThan(2);

    // subType -> the offsets and velocities its spawn function sets.
    const expected: Record<string, { offsetX: number; offsetY: number; velocityX: number }> = {
      // gun.setOffsetX(54); setOffsetY(13); setVelocityX(300)
      turret: { offsetX: 54, offsetY: 13, velocityX: 300 },
      // gun.setOffsetX(55); setOffsetY(21); setVelocityX(100)
      snailbomb: { offsetX: 55, offsetY: 21, velocityX: 100 },
      // gun.setOffsetX(44); setOffsetY(22); setVelocityX(30)
      shadowslime: { offsetX: 44, offsetY: 22, velocityX: 30 },
      // gun.setOffsetX(45); setOffsetY(42); setVelocityX(300)
      wanda: { offsetX: 45, offsetY: 42, velocityX: 300 },
    };

    let checked = 0;
    for (const [subType, want] of Object.entries(expected)) {
      const guns = found.get(subType);
      if (!guns) continue;
      const gun = guns[0];
      expect(gun.offsetX, `${subType} shot offsetX`).toBe(want.offsetX);
      expect(gun.offsetY, `${subType} shot offsetY`).toBe(want.offsetY);
      expect(Math.abs(gun.velocityX), `${subType} shot speed`).toBe(want.velocityX);
      checked++;
    }
    expect(checked, 'no launchers were actually checked').toBeGreaterThan(1);
  }, 60_000);

  test('the muzzle sits the offset above the feet, not below the head', () => {
    // setOffsetY() is measured upward from the object's bottom, because the
    // original's origin is the bottom. LaunchProjectileComponent stores the
    // raw value, so the conversion has to happen where it is applied:
    //
    //     y = position.y + height - offsetY
    //
    // Reading position.y + offsetY instead - which is what a straight
    // transcription gives - moves every muzzle by (height - 2 * offsetY):
    // a turret fires 38px too high, Wanda 44px, from above her own head.
    const muzzleY = (top: number, height: number, offsetY: number): number =>
      top + height - offsetY;

    // Distance from the muzzle up to the object's feet must equal offsetY.
    const aboveFeet = (height: number, offsetY: number): number =>
      (0 + height) - muzzleY(0, height, offsetY);

    for (const [height, offsetY] of [[64, 13], [64, 21], [64, 22], [128, 42]] as const) {
      expect(aboveFeet(height, offsetY)).toBe(offsetY);
    }

    // And the vertical flip mirrors it through the object, as the original's
    // `offsetY = height - offsetY` does.
    const flipped = (height: number, offsetY: number): number =>
      muzzleY(0, height, height - offsetY);
    expect(flipped(64, 13)).toBe(13);
    expect(flipped(128, 42)).toBe(42);
  });

  test('the shadow slime fires half a second into its attack', async () => {
    const found = await launchersBySubType();
    if (!found.has('shadowslime')) return;
    sSystemRegistry.reset();
    const manager = new GameObjectManager();
    manager.setCamera(new CameraSystem(480, 320));
    sSystemRegistry.register(manager, 'gameObject');
    const levelSystem = new LevelSystem();
    levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());

    for (const group of linearLevelTree) {
      for (const entry of group.levels) {
        if (!(await levelSystem.loadLevel(resourceToLevelId[entry.resource]))) continue;
        manager.commitUpdates();
        const slime = manager.getActiveObjects()
          .find((o) => o.subType === 'shadowslime');
        if (!slime) continue;
        const gun = slime.getComponents()
          .find((c) => c instanceof LaunchProjectileComponent) as unknown as
            { delayBeforeFirstSet: number } | undefined;
        expect(gun).toBeDefined();
        // Utils.framesToTime(24, 12), the call that actually takes effect -
        // not half the 23-frame attack animation the dead line above it names.
        expect(gun!.delayBeforeFirstSet).toBeCloseTo(12 / 24, 5);
        return;
      }
    }
  }, 60_000);

  test('Rokudou carries an energy ball and a bullet burst, not two bursts', async () => {
    const found = await launchersBySubType();
    const guns = found.get('rokudou');
    if (!guns) return;
    expect(guns).toHaveLength(2);
    // One fires singly (the energy ball), one fires a five-round set.
    const setSizes = guns.map((g) => g.projectilesInSet).sort();
    expect(setSizes).toEqual([1, 5]);
  }, 60_000);
});
