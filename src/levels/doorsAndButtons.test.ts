/**
 * Do buttons actually open doors, in a real level?
 *
 * `levelReachable.test.ts` floods the collision *tiles*, so it treats a door
 * as open ground - doors are objects, not tiles. That is the right call for
 * reachability, but it means a broken door mechanism would leave a level
 * genuinely impassable while every geometry check still passed.
 *
 * The chain is: Andou's DEPRESS attack volume reaches the button's DEPRESS
 * vulnerability volume, HitReactionComponent stamps the hit,
 * ButtonAnimationComponent writes its channel, and DoorAnimationComponent
 * reads that channel and retracts the door's solid surface.
 *
 * `buttonsAndDoors.test.ts` covers the pieces against hand-built objects.
 * This runs the whole thing against the doors and buttons the campaign
 * actually ships.
 */

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem } from '../engine/SoundSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { GameFlowEvent } from '../engine/GameFlowEvent';
import { ChannelSystem } from '../engine/ChannelSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import { PlayerComponent } from '../entities/components/PlayerComponent';
import { SolidSurfaceComponent, setSolidSurfaceSystemRegistry } from '../entities/components/SolidSurfaceComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { DoorAnimation, DoorAnimationComponent } from '../entities/components/DoorAnimationComponent';
import { HitType } from '../types';
import type { GameObject } from '../entities/GameObject';

const pub = join(import.meta.dir, '../../public');
const originalFetch = globalThis.fetch;
const FRAME = 1 / 60;

test('all campaign gate variants display each opening and closing frame', async () => {
  const variants = new Set<string>();
  for (const resource of new Set(linearLevelTree.flatMap(group => group.levels.map(entry => entry.resource)))) {
    const rig = await load(resource);
    if (!rig) continue;
    for (const door of allOfType(rig, object => object.type === 'door')) {
      variants.add(door.subType);
      const color = door.subType.replace('_nonblocking', '');
      const sprite = door.getComponent(SpriteComponent)!;
      for (const [animation, frames] of [
        [DoorAnimation.CLOSED, ['01']], [DoorAnimation.OPEN, ['04']],
        [DoorAnimation.OPENING, ['02', '03']], [DoorAnimation.CLOSING, ['03', '02']],
      ] as const) {
        sprite.playAnimation(animation);
        let elapsed = 0;
        for (const [index, image] of frames.entries()) {
          sprite.setCurrentAnimationTime(elapsed);
          expect(sprite.getCurrentDraw()?.sprite, `${resource}: ${door.subType}`)
            .toBe(`object_door_${color}${image}`);
          sprite.update(0, door);
          const collision = door.getComponent(DynamicCollisionComponent);
          expect(collision, door.subType).not.toBeNull();
          const attacks = collision!.getAttackVolumes();
          if (animation === DoorAnimation.CLOSING && index === 1) {
            expect(attacks).toHaveLength(1);
            expect(attacks![0].getHitType()).toBe(HitType.DEATH);
            expect([attacks![0].getMinXPosition(null), attacks![0].getMinYPosition(null),
              attacks![0].getMaxXPosition(null), attacks![0].getMaxYPosition(null)])
              .toEqual([12, 0, 20, 56]);
          } else {
            expect(attacks).toBeNull();
          }
          elapsed += sprite.findAnimation(animation)!.frames[index].duration;
        }
      }
      expect(door.getComponents().some(component => component instanceof SolidSurfaceComponent))
        .toBe(!door.subType.endsWith('_nonblocking'));
      // A button can reverse the deadly closing frame: no stale crush box.
      sprite.playAnimation(DoorAnimation.OPENING);
      sprite.update(0, door);
      expect(door.getComponent(DynamicCollisionComponent)!.getAttackVolumes()).toBeNull();
    }
  }
  expect([...variants].sort()).toEqual(['blue', 'blue_nonblocking', 'green', 'green_nonblocking', 'red', 'red_nonblocking']);
}, 180_000);

test.each([[true, false], [false, false], [true, true]])('lab gate closing around Andou (crush frame: %s, glow: %s)', async (crushEnabled, glowing) => {
  const rig = (await load('level_0_2_lab'))!;
  const door = rig.manager.getActiveObjects().find(object => object.type === 'door')!;
  const player = rig.manager.getPlayer()!;
  const sprite = door.getComponent(SpriteComponent)!;
  if (!crushEnabled) {
    // Negative control recreates the missing port behavior without changing
    // the live implementation: the same body remains alive inside the gate.
    sprite.findAnimation(DoorAnimation.CLOSING)!.frames[1].attackVolumes = null;
  }
  const channel = rig.channels.registerChannel(`${door.subType.toUpperCase()} BUTTON`)!;
  channel.value = { value: rig.time.getGameTime() };
  const playerComponent = player.getComponent(PlayerComponent)!;
  playerComponent.setSystems(sSystemRegistry.inputSystem!, rig.collision,
    sSystemRegistry.soundSystem!, rig.levelSystem);
  if (glowing) playerComponent.activateGlow(15);
  playerComponent.update(0, player); // Select the real normal-player animation.
  player.setPosition(door.getPosition().x, door.getPosition().y + door.height - player.height);
  player.life = 3;
  // Keep the actor inside the gate to isolate the authored closing collision,
  // using the real player volumes/reaction, not direct receivedHit() calls.
  player.getComponent(SpriteComponent)!.update(0, player);
  expect(player.getComponent(DynamicCollisionComponent)!.getVulnerabilityVolumes()?.length)
    .toBeGreaterThan(0);
  let sawHarmlessClosing = false;
  let deathFrame: string | undefined;
  for (let i = 0; i < 330; i++) {
    rig.time.update(FRAME);
    door.update(FRAME, rig.time.getGameTime());
    player.getComponent(DynamicCollisionComponent)!.update(FRAME, player);
    rig.oc.update(FRAME);
    if (sprite.getCurrentAnimationIndex() === DoorAnimation.CLOSING &&
        sprite.getCurrentDraw()?.sprite.endsWith('03')) {
      sawHarmlessClosing = true;
      expect(player.life).toBe(3);
    }
    if (player.life === 0) {
      deathFrame = sprite.getCurrentDraw()?.sprite;
      break;
    }
  }
  expect(sawHarmlessClosing).toBe(true);
  expect(player.life).toBe(crushEnabled ? 0 : 3);
  if (crushEnabled) {
    expect(player.lastReceivedHitType).toBe(HitType.DEATH);
    expect(deathFrame).toBe(`object_door_${door.subType}02`);
  } else {
    expect(sprite.getCurrentAnimationIndex()).toBe(DoorAnimation.CLOSED);
    expect(door.getComponents().some(component => component instanceof SolidSurfaceComponent)).toBe(true);
  }
});

test('a real gate reverses smoothly when its button is pressed during closing', async () => {
  const rig = (await load('level_0_2_lab'))!;
  expect(rig).not.toBeNull();
  const door = allOfType(rig, object => object.type === 'door')[0];
  expect(door).toBeDefined();
  const sprite = door.getComponent(SpriteComponent)!;
  const animation = door.getComponents().find(
    (component): component is DoorAnimationComponent => component instanceof DoorAnimationComponent
  )!;
  const channel = rig.channels.registerChannel(`${door.subType.toUpperCase()} BUTTON`)!;
  channel.value = { value: rig.time.getGameTime() };
  animation.update(0, door);
  sprite.update(0.2, door);
  animation.update(0, door);
  expect(sprite.getCurrentAnimationIndex()).toBe(DoorAnimation.OPEN);
  rig.time.update(5.001);
  animation.update(0, door);
  sprite.update(0.119, door);
  expect(sprite.getCurrentDraw()?.sprite).toBe(`object_door_${door.subType}02`);
  channel.value = { value: rig.time.getGameTime() };
  animation.update(0, door);
  const length = sprite.findAnimation(DoorAnimation.OPENING)!.frames.reduce((sum, frame) => sum + frame.duration, 0);
  expect(sprite.getCurrentAnimationTime()).toBeCloseTo(length - 0.12);
  expect(sprite.getCurrentDraw()?.sprite).toBe(`object_door_${door.subType}02`);
  expect(animation.isSolidSurfaceEnabled()).toBe(false);
  sprite.update(0.11, door);
  expect(sprite.animationFinished()).toBe(false);
  sprite.update(0.01, door);
  animation.update(0, door);
  expect(sprite.getCurrentAnimationIndex()).toBe(DoorAnimation.OPEN);
});

beforeAll(() => {
  globalThis.fetch = (async (i: Parameters<typeof fetch>[0]): Promise<Response> => {
    const raw = typeof i === 'string' ? i : i instanceof URL ? i.pathname : new URL(i.url).pathname;
    const p = raw.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const f = file(join(pub, p));
    if (!(await f.exists())) return new Response(null, { status: 404 });
    return new Response(await f.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });

interface Rig {
  manager: GameObjectManager; time: TimeSystem; camera: CameraSystem;
  oc: GameObjectCollisionSystem; collision: CollisionSystem;
  levelSystem: LevelSystem; channels: ChannelSystem;
}

async function load(resource: string): Promise<Rig | null> {
  sSystemRegistry.reset();
  const collision = new CollisionSystem(), manager = new GameObjectManager();
  const hotSpots = new HotSpotSystem(), camera = new CameraSystem(480, 320);
  const time = new TimeSystem(), oc = new GameObjectCollisionSystem();
  const channels = new ChannelSystem();
  const levelSystem = new LevelSystem();
  levelSystem.setSystems(collision, manager, hotSpots);
  manager.setCamera(camera);
  sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(hotSpots, 'hotSpot');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(new InputSystem(), 'input');
  sSystemRegistry.register(new SoundSystem(), 'sound');
  sSystemRegistry.register(oc, 'gameObjectCollision');
  sSystemRegistry.register(new GameFlowEvent(), 'gameFlowEvent');
  sSystemRegistry.register(channels, 'channel');
  sSystemRegistry.register(time, 'time');
  if (!(await collision.loadCollisionData('/assets/collision.json'))) return null;
  const levelId = resourceToLevelId[resource];
  if (levelId === undefined || !(await levelSystem.loadLevel(levelId))) return null;
  manager.commitUpdates();
  return { manager, time, camera, oc, collision, levelSystem, channels };
}

/** Everything of a type in the level, including objects culled by distance. */
function allOfType(rig: Rig, predicate: (o: GameObject) => boolean): GameObject[] {
  const found: GameObject[] = [];
  const { width, height } = rig.levelSystem.getLevelSize();
  for (let x = 0; x < width; x += 240) {
    for (let y = 0; y < height; y += 240) {
      rig.camera.setPosition(x, y);
      rig.manager.update(FRAME, rig.time.getGameTime());
      rig.oc.update(FRAME);
      for (const o of rig.manager.getActiveObjects() as GameObject[]) {
        if (predicate(o) && !found.includes(o)) found.push(o);
      }
    }
  }
  return found;
}

test('every button the campaign ships can be pressed by standing on it', async () => {
  const failures: string[] = [];
  let checked = 0;

  const seen = new Set<string>();
  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      if (seen.has(entry.resource)) continue;
      seen.add(entry.resource);

      const rig = await load(entry.resource);
      if (!rig) continue;
      const player = rig.manager.getPlayer();
      if (!player) continue;
      // Andou's collision volumes come off his animation frames, so
      // PlayerComponent has to be able to run - Game.tsx injects these.
      const component = player.getComponent(PlayerComponent) as PlayerComponent;
      component.setSystems(
        sSystemRegistry.inputSystem!, rig.collision,
        sSystemRegistry.soundSystem!, rig.levelSystem
      );

      const buttons = allOfType(rig, (o) => o.type === 'button');
      if (buttons.length === 0) continue;

      for (const button of buttons) {
        const target = button.getPosition();
        rig.camera.setPosition(target.x, target.y);
        let pressed = false;
        for (let i = 0; i < 60 && !pressed; i++) {
          // Stand on it: Andou's DEPRESS volume is the bottom 16px of his body.
          player.setPosition(
            target.x + button.width / 2 - player.width / 2,
            target.y + button.height - player.height
          );
          player.setGameTime(rig.time.getGameTime());
          button.setGameTime(rig.time.getGameTime());
          rig.time.update(FRAME);
          rig.manager.update(FRAME, rig.time.getGameTime());
          rig.oc.update(FRAME);
          if (button.lastReceivedHitType === HitType.DEPRESS) pressed = true;
        }
        checked++;
        if (!pressed) {
          failures.push(`${entry.resource}: a ${button.subType || 'button'} never registered DEPRESS`);
        }
      }
    }
  }

  expect(checked, 'no buttons were found in the campaign').toBeGreaterThan(3);
  expect(failures, 'these buttons could not be pressed').toEqual([]);
}, 180_000);

test('pressing a button opens the door on its channel', async () => {
  // The second half of the chain. A button that registers DEPRESS but never
  // moves its door leaves the level exactly as impassable as one that ignores
  // the player: ButtonAnimationComponent writes the channel,
  // DoorAnimationComponent reads it, retracts a blocking door's solid surface,
  // and animates a nonblocking door through the same colour channel.
  const failures: string[] = [];
  let checked = 0;
  let nonblockingChecked = 0;

  const seen = new Set<string>();
  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      if (seen.has(entry.resource)) continue;
      seen.add(entry.resource);

      const rig = await load(entry.resource);
      if (!rig) continue;
      const player = rig.manager.getPlayer();
      if (!player) continue;
      const component = player.getComponent(PlayerComponent) as PlayerComponent;
      component.setSystems(
        sSystemRegistry.inputSystem!, rig.collision,
        sSystemRegistry.soundSystem!, rig.levelSystem
      );

      const buttons = allOfType(rig, (o) => o.type === 'button');
      const doors = allOfType(rig, (o) => o.type === 'door');
      if (buttons.length === 0 || doors.length === 0) continue;

      // Test each door once, pressing any button on its colour. Iterating
      // buttons instead re-tests the same door in levels that field two of a
      // colour, which reads as a failure that is really a duplicate.
      for (const door of doors) {
        const nonblocking = door.subType.endsWith('_nonblocking');
        const button = buttons.find((b) => b.subType === door.subType.replace('_nonblocking', ''));
        if (!button) continue;
        if (!nonblocking && !door.getComponents().some((c) => c instanceof SolidSurfaceComponent)) continue;

        // Press the button with the camera on it, then walk the camera over to
        // the door - which is how it happens in play, and the only way both
        // objects are ever inside their activation radius. GameObject.update()
        // no-ops on a deactivated object, so a door across the level simply
        // does not run until the player approaches it.
        const buttonPos = button.getPosition();
        rig.camera.setPosition(buttonPos.x, buttonPos.y);
        for (let i = 0; i < 30; i++) {
          player.setPosition(
            buttonPos.x + button.width / 2 - player.width / 2,
            buttonPos.y + button.height - player.height
          );
          player.setGameTime(rig.time.getGameTime());
          button.setGameTime(rig.time.getGameTime());
          rig.time.update(FRAME);
          rig.manager.update(FRAME, rig.time.getGameTime());
          rig.oc.update(FRAME);
        }

        const doorPos = door.getPosition();
        rig.camera.setPosition(doorPos.x, doorPos.y);
        const animation = door.getComponents().find(
          (component): component is DoorAnimationComponent => component instanceof DoorAnimationComponent
        )!;
        let opened = false;
        for (let i = 0; i < 120 && !opened; i++) {
          rig.time.update(FRAME);
          rig.manager.update(FRAME, rig.time.getGameTime());
          rig.oc.update(FRAME);
          opened = [DoorAnimation.OPEN, DoorAnimation.OPENING].includes(animation.getCurrentState()) &&
            (nonblocking || !door.getComponents().some((c) => c instanceof SolidSurfaceComponent));
        }

        checked++;
        if (nonblocking) nonblockingChecked++;
        if (!opened) {
          failures.push(`${entry.resource}: the ${door.subType} door never opened`);
          continue;
        }
        // Stop holding the plate: a standing player should renew its channel
        // indefinitely, so closure only follows after the contact ends.
        player.setPosition(-1000, -1000);
        rig.time.update(FRAME);
        rig.manager.update(FRAME, rig.time.getGameTime());
        rig.oc.update(FRAME);
        rig.time.update(6);
        // Advance the door alone: another actor may be holding a different
        // plate on the same channel in this authored level.
        door.update(0, rig.time.getGameTime());
        expect(animation.getCurrentState(), `${entry.resource}: ${door.subType} did not close`)
          .toBe(DoorAnimation.CLOSED);
        expect(door.getComponents().some((c) => c instanceof SolidSurfaceComponent),
          `${entry.resource}: ${door.subType} has the wrong closed solidity`).toBe(!nonblocking);
      }
    }
  }

  expect(checked, 'no button/door pairs were found').toBeGreaterThan(2);
  expect(nonblockingChecked, 'the nine authored nonblocking gates were not all exercised').toBe(9);
  expect(failures, 'these doors stayed shut').toEqual([]);
}, 180_000);

test('walking over the real lab button animates its gate and allows passage, then it closes again', async () => {
  const rig = (await load('level_0_2_lab'))!;
  const player = rig.manager.getPlayer()!;
  const objects = rig.manager.getActiveObjects();
  const button = objects.find((object) => object.type === 'button')!;
  const door = objects.find((object) => object.type === 'door' && object.subType === button?.subType)!;
  expect(button).toBeTruthy();
  expect(door).toBeTruthy();
  // Keep the shipped actors/components, but put the mechanism on a flat test
  // floor so the test measures walking/contact, not route-finding/teleport hits.
  const collision = new CollisionSystem();
  expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  // Cover the actual world's width: otherwise walking through the gate can
  // leave this synthetic floor before the return trip and fall into a pit.
  const columns = Math.ceil(rig.levelSystem.getLevelSize().width / 32);
  collision.setTileCollision(Array.from({ length: columns * 12 }, (_, i) => i >= columns * 10 ? 1 : -1), columns, 12, 32, 32);
  sSystemRegistry.register(collision, 'collision');
  setSolidSurfaceSystemRegistry(sSystemRegistry);
  const input = sSystemRegistry.inputSystem!;
  player.getComponent(PlayerComponent)!.setSystems(input, collision, sSystemRegistry.soundSystem!, rig.levelSystem);
  door.setPosition(320, 256);
  button.setPosition(128, 288);
  player.setPosition(280, 272);
  const doorFrames = new Set<string>();
  const buttonFrames = new Set<string>();
  const frame = (): void => {
    rig.time.update(FRAME);
    const now = rig.time.getGameTime();
    player.update(FRAME, now);
    button.update(FRAME, now);
    door.update(FRAME, now);
    rig.oc.update(FRAME);
    collision.updateTemporarySurfaces();
    doorFrames.add(door.getComponent(SpriteComponent)!.getCurrentDraw()!.sprite);
    buttonFrames.add(button.getComponent(SpriteComponent)!.getCurrentDraw()!.sprite);
  };
  input.setVirtualAxis('horizontal', 1);
  for (let i = 0; i < 30; i++) frame();
  expect(player.getPosition().x).toBe(288); // Closed gate blocks the player.

  player.setPosition(32, 272);
  player.getVelocity().zero();
  for (let i = 0; i < 110; i++) frame();
  expect(player.getPosition().x).toBeGreaterThan(352);
  expect(buttonFrames.has(`object_button_pressed_${button.subType}`)).toBe(true);
  expect(doorFrames).toEqual(new Set(['01', '02', '03', '04'].map((n) => `object_door_${door.subType}${n}`)));
  input.setVirtualAxis('horizontal', 0);
  for (let i = 0; i < 6 * 60; i++) frame();
  expect(door.getComponent(SpriteComponent)!.getCurrentDraw()!.sprite)
    .toBe(`object_door_${door.subType}01`);
  expect(door.getComponents().some((component) => component instanceof SolidSurfaceComponent)).toBe(true);
  input.setVirtualAxis('horizontal', -1);
  // The complete floor permits the full coast after passage; allow enough
  // time to return from that stopping point, then keep pushing on the gate.
  for (let i = 0; i < 120; i++) frame();
  expect(player.getPosition().x).toBe(352); // Reclosed gate blocks from the other side too.
  expect(player.life).toBeGreaterThan(0); // Standing beside the gate is not a crush.
});

test('the authored sewer red plate opens its blocking and nonblocking gate corridor for passage', async () => {
  const rig = (await load('level_3_6_sewer'))!;
  const player = rig.manager.getPlayer()!;
  const objects = allOfType(rig, object => object.type === 'button' || object.type === 'door');
  const plate = objects.find(object => object.type === 'button' && object.subType === 'red' &&
    object.getPosition().x === 19 * 32 && object.getPosition().y === 45 * 32)!;
  const gates = objects.filter(object => object.type === 'door' && object.subType.startsWith('red') &&
    object.getPosition().y === 46 * 32 - object.height &&
    object.getPosition().x >= 20 * 32 && object.getPosition().x <= 23 * 32);
  expect(plate).toBeDefined();
  expect(gates.map(gate => gate.getPosition().x).sort((a, b) => a - b)).toEqual([640, 672, 704, 736]);
  expect(gates.filter(gate => gate.subType.endsWith('_nonblocking'))).toHaveLength(2);

  player.getComponent(PlayerComponent)!.setSystems(sSystemRegistry.inputSystem!, rig.collision,
    sSystemRegistry.soundSystem!, rig.levelSystem);
  player.setPosition(plate.getPosition().x, 46 * 32 - player.height);
  player.getVelocity().zero();
  rig.camera.setPosition(player.getCenteredPositionX(), player.getCenteredPositionY());
  rig.manager.update(0, rig.time.getGameTime());
  const frames = new Map(gates.map(gate => [gate, new Set<string>()]));
  const frame = (): void => {
    rig.time.update(FRAME);
    const now = rig.time.getGameTime();
    player.update(FRAME, now);
    plate.update(FRAME, now);
    for (const gate of gates) gate.update(FRAME, now);
    rig.oc.update(FRAME);
    rig.collision.updateTemporarySurfaces();
    for (const gate of gates) frames.get(gate)!.add(gate.getComponent(SpriteComponent)!.getCurrentDraw()!.sprite);
  };
  for (let i = 0; i < 16; i++) frame();
  expect(plate.getComponent(SpriteComponent)!.getCurrentDraw()?.sprite,
    `player=${player.getPosition().x},${player.getPosition().y}; plate=${plate.getPosition().x},${plate.getPosition().y}; hit=${plate.lastReceivedHitType}`)
    .toBe('object_button_pressed_red');
  sSystemRegistry.inputSystem!.setVirtualAxis('horizontal', 1);
  for (let i = 0; i < 45; i++) frame();
  sSystemRegistry.inputSystem!.setVirtualAxis('horizontal', 0);
  expect(player.getPosition().x).toBeGreaterThan(768);
  expect(player.life).toBe(3);
  for (const gate of gates) {
    expect(frames.get(gate), `red gate at x${gate.getPosition().x}`)
      .toEqual(new Set(['01', '02', '03', '04'].map(n => `object_door_red${n}`)));
  }
});
