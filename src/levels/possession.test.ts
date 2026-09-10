/**
 * Can the player actually take over an enemy?
 *
 * This is not a nicety. A turret's vulnerability volume is typed POSSESS, so
 * it cannot be stomped or shot at all - taking it over is the only thing that
 * can be done to one. If any link in the chain is broken, every turret in the
 * game is an invulnerable gun emplacement.
 *
 * The original calls `hitReact.setPossessionComponent()` in exactly two places,
 * spawnEnemyBrobot and spawnObjectTurret, so those two are the whole of what
 * can be taken over.
 *
 * The chain is: hold attack on the ground for GHOST_CHARGE_TIME -> the player
 * goes FROZEN and ghostActive -> Game.tsx spawns a ghost object -> the ghost's
 * POSSESS attack volume reaches the target's POSSESS vulnerability volume ->
 * HitReactionComponent activates the target's ChangeComponentsComponent, which
 * swaps the AI out and a GhostComponent in.
 *
 * Game.tsx owns the spawn and the camera handoff, so this mirrors that wiring
 * the way campaignGameplay.test.ts mirrors the collision pipeline.
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
import { TimeSystem } from '../engine/TimeSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory } from '../entities/GameObjectFactory';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import { PlayerComponent, PlayerState } from '../entities/components/PlayerComponent';
import { GhostComponent } from '../entities/components/GhostComponent';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { ChangeComponentsComponent } from '../entities/components/ChangeComponentsComponent';
import { HitType, ActionType } from '../types';
import type { GameObject } from '../entities/GameObject';
import type { RenderSystem } from '../engine/RenderSystem';

const pub = join(import.meta.dir, '../../public');
const originalFetch = globalThis.fetch;
const FRAME = 1 / 60;
const GhostClass = GhostComponent as unknown as new (...args: unknown[]) => GhostComponent;
const SwapClass = ChangeComponentsComponent as unknown as new (...args: unknown[]) => ChangeComponentsComponent;

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
  manager: GameObjectManager; input: InputSystem; time: TimeSystem;
  camera: CameraSystem; oc: GameObjectCollisionSystem;
  collision: CollisionSystem; levelSystem: LevelSystem; sound: SoundSystem;
  factory: GameObjectFactory;
}

async function loadLevel(resource: string): Promise<Rig> {
  sSystemRegistry.reset();
  const collision = new CollisionSystem(), manager = new GameObjectManager();
  const hotSpots = new HotSpotSystem(), camera = new CameraSystem(480, 320);
  const time = new TimeSystem(), oc = new GameObjectCollisionSystem();
  const input = new InputSystem(), sound = new SoundSystem();
  const levelSystem = new LevelSystem();
  const factory = new GameObjectFactory(manager);
  levelSystem.setSystems(collision, manager, hotSpots);
  manager.setCamera(camera);
  sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(hotSpots, 'hotSpot');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(input, 'input');
  sSystemRegistry.register(sound, 'sound');
  sSystemRegistry.register(oc, 'gameObjectCollision');
  sSystemRegistry.register(new GameFlowEvent(), 'gameFlowEvent');
  sSystemRegistry.register(time, 'time');
  sSystemRegistry.register(factory, 'factory');
  factory.setSystemRegistry(sSystemRegistry);
  factory.setCollisionSystem(collision);
  expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  expect(await levelSystem.loadLevel(resourceToLevelId[resource]), resource).toBe(true);
  manager.commitUpdates();
  return { manager, input, time, camera, oc, collision, levelSystem, sound, factory };
}

test('holding attack on the ground charges and spawns the ghost', async () => {
  const rig = await loadLevel('level_0_2_lab');
  const player = rig.manager.getPlayer() as GameObject;
  const component = player.getComponent(PlayerComponent) as PlayerComponent;
  component.setSystems(rig.input, rig.collision, rig.sound, rig.levelSystem);

  // Settle on the ground.
  for (let i = 0; i < 40; i++) {
    player.setGameTime(rig.time.getGameTime());
    rig.time.update(FRAME);
    rig.manager.update(FRAME, rig.time.getGameTime());
  }
  expect(player.touchingGround()).toBe(true);

  // Hold attack. GHOST_CHARGE_TIME is 0.75s, so this needs ~45 frames.
  for (let i = 0; i < 90 && !component.ghostActive; i++) {
    rig.input.setVirtualButton('stomp', true);
    player.setGameTime(rig.time.getGameTime());
    rig.time.update(FRAME);
    rig.manager.update(FRAME, rig.time.getGameTime());
  }

  expect(component.ghostActive, 'the ghost never charged').toBe(true);
  expect(component.currentState).toBe(PlayerState.FROZEN);
  expect(player.getCurrentAction()).toBe(ActionType.FROZEN);

  // Game.tsx's half: spawn the ghost object.
  const ghost = rig.factory.spawnPlayerGhost(player, 0);
  expect(ghost, 'spawnGhost returned nothing').not.toBeNull();
  expect(ghost!.type).toBe('ghost');
  const gc = ghost!.getComponent(
    GhostComponent as unknown as new (...args: unknown[]) => GhostComponent
  );
  expect(gc, 'the ghost has no GhostComponent').toBeTruthy();

  // And it must carry a POSSESS attack volume, or it can never take anything.
  const dyn = ghost!.getComponent(DynamicCollisionComponent);
  const types = (dyn?.getAttackVolumes() ?? []).map((v) => v.getHitType());
  expect(types, 'the ghost has no POSSESS attack volume').toContain(HitType.POSSESS);
  expect(ghost!.getPosition().y + ghost!.height).toBe(player.getPosition().y + player.height);
  // Releasing the charge key and steering must move the orb out of Andou,
  // not spawn it partly inside the floor where background collision traps it.
  rig.input.setVirtualButton('stomp', false);
  rig.input.setVirtualAxis('horizontal', 1);
  const startX = ghost!.getPosition().x;
  for (let i = 0; i < 20; i++) ghost!.update(FRAME, rig.time.getGameTime() + i * FRAME);
  expect(ghost!.getPosition().x).toBeGreaterThan(startX + 20);
}, 30_000);

test('the ghost survives long enough to be steered anywhere', async () => {
  // GameObject.activationRadius defaults to 0, and updateActivation() tests
  // `dx*dx + dy*dy < radius*radius`, so an unset radius means "never in range".
  // configureGhost never set one, so a freshly spawned ghost was culled and
  // recycled within a few frames - it came back 0x0 with no collision volumes,
  // whatever the camera was doing. The original sets mAlwaysActive, which is
  // the only sane value for something the player is driving.
  const rig = await loadLevel('level_0_2_lab');
  const player = rig.manager.getPlayer() as GameObject;
  const position = player.getPosition();

  const ghost = rig.factory.spawnGhost(position.x, position.y, 2) as GameObject;
  expect(ghost).not.toBeNull();
  expect(ghost.activationRadius, 'the ghost must never be culled by distance').toBe(-1);
  rig.manager.commitUpdates();

  rig.camera.setPosition(position.x, position.y);
  for (let i = 0; i < 120; i++) {
    rig.manager.update(FRAME, rig.time.getGameTime());
    rig.oc.update(FRAME);
    rig.time.update(FRAME);
  }

  expect(ghost.width, 'the ghost was recycled').toBe(64);
  expect(rig.manager.getActiveObjects()).toContain(ghost);

  // And it survives the camera wandering off, which is the whole point of
  // always-active: the ghost leads, the camera follows it.
  for (let i = 0; i < 60; i++) {
    rig.camera.setPosition(position.x + 4000, position.y);
    rig.manager.update(FRAME, rig.time.getGameTime());
    rig.oc.update(FRAME);
    rig.time.update(FRAME);
  }
  expect(ghost.width, 'the ghost was culled once the camera moved away').toBe(64);
}, 30_000);

test('a grounded player can charge and steer an orb into a shipped ceiling turret', async () => {
  const rig = await loadLevel('level_3_3_sewer');
  const player = rig.manager.getPlayer()!;
  const component = player.getComponent(PlayerComponent)!;
  component.setSystems(rig.input, rig.collision, rig.sound, rig.levelSystem);
  // Existing floor at y256, below the unchanged ceiling-mounted turrets.
  player.setPosition(1280, 256 - player.height);
  rig.camera.setTarget(player);
  rig.camera.setPosition(player.getCenteredPositionX(), player.getCenteredPositionY());
  const tick = (): void => {
    rig.time.update(FRAME);
    rig.manager.update(FRAME, rig.time.getGameTime());
    rig.collision.updateTemporarySurfaces();
    rig.oc.update(FRAME);
  };
  for (let frame = 0; frame < 30; frame++) tick();
  expect(player.touchingGround()).toBe(true);
  const turrets = rig.manager.getActiveObjects().filter(object => object.subType === 'turret');
  expect(turrets.length).toBeGreaterThan(0);
  rig.input.setVirtualButton('attack', true);
  for (let frame = 0; frame < 90 && !component.ghostActive; frame++) tick();
  expect(component.ghostActive).toBe(true);
  const body = player.getComponent(DynamicCollisionComponent)!;
  const sprite = player.getComponent(SpriteComponent)!;
  expect(body.getAttackVolumes()).toBeNull();
  expect(body.getVulnerabilityVolumes()).toBeNull();
  expect(sprite.getCurrentDraw()).toBeNull();
  const orb = rig.factory.spawnPlayerGhost(player, 0)!;
  rig.manager.commitUpdates();
  rig.input.setVirtualButton('attack', false);
  rig.input.setVirtualAxis('vertical', -1);
  let target: GameObject | undefined;
  for (let frame = 0; frame < 120 && !target; frame++) {
    tick();
    target = turrets.find(turret => turret.getComponent(GhostClass));
  }
  expect(target, `Orb at ${orb.getPosition().x},${orb.getPosition().y} never reached ceiling turret`).toBeDefined();
  expect(target!.lastReceivedHitType).toBe(HitType.POSSESS);
  // Complete the same handoff Game performs after collision; do not move the orb.
  orb.getComponent(GhostClass)!.transferControl(orb);
  rig.input.setVirtualAxis('vertical', 0);
  const lifeWhilePossessed = player.life;
  // Keep the real enemies and their projectiles running. The frozen body's
  // stale charge-frame vulnerability previously let Andou die during control.
  for (let frame = 0; frame < 600; frame++) tick();
  expect(player.life).toBe(lifeWhilePossessed);
  expect(component.ghostActive).toBe(true);
  expect(body.getVulnerabilityVolumes()).toBeNull();
  target!.getComponent(GhostClass)!.releaseControl(target!);
  expect(component.ghostActive).toBe(false);
  expect(target!.life).toBeGreaterThan(0);
  for (let frame = 0; frame < 120 && component.currentState !== PlayerState.MOVE; frame++) tick();
  tick();
  expect(sprite.getCurrentDraw()).not.toBeNull();
  expect(body.getVulnerabilityVolumes()).not.toBeNull();
});

test('brobots release on death and turrets support repeated possession and release', async () => {
  // The original calls setPossessionComponent in exactly two spawn functions:
  // spawnEnemyBrobot and spawnObjectTurret.
  const cases: Array<{ resource: string; subType: string }> = [
    { resource: 'level_0_2_lab', subType: 'brobot' },
    { resource: 'level_3_3_sewer', subType: 'turret' },
  ];

  for (const { resource, subType } of cases) {
    const rig = await loadLevel(resource);

    // Objects outside their activation radius sit on the inactive list and
    // never appear in getActiveObjects(), so sweep the camera to find one.
    let victim: GameObject | undefined;
    const { width, height } = rig.levelSystem.getLevelSize();
    for (let x = 0; x < width && !victim; x += 200) {
      for (let y = 0; y < height && !victim; y += 200) {
        rig.camera.setPosition(x, y);
        rig.manager.update(FRAME, rig.time.getGameTime());
        // Drain the collision system as the real loop does. Objects submit a
        // record every update, and only update() returns them to the pool, so
        // sweeping without this leaves stale records that collide with each
        // other - the same object lands its hit once per leftover record.
        rig.oc.update(FRAME);
        victim = (rig.manager.getActiveObjects() as GameObject[])
          .find((o) => o.subType === subType);
      }
    }
    expect(victim, `${resource} should contain a ${subType}`).toBeDefined();
    if (!victim) continue;

    // Park the camera on it and spawn the ghost there. A ghost spawned across
    // the level would be culled before it could reach anything.
    const target = victim.getPosition();
    rig.camera.setPosition(target.x, target.y);
    const ghost = rig.factory.spawnGhost(target.x, target.y, 2) as GameObject;
    expect(ghost, 'spawnGhost returned nothing').not.toBeNull();
    rig.manager.commitUpdates();

    let possessed = false;
    for (let i = 0; i < 120 && !possessed; i++) {
      rig.camera.setPosition(target.x, target.y);
      ghost.setPosition(
        target.x + victim.width / 2 - ghost.width / 2,
        target.y + victim.height / 2 - ghost.height / 2
      );
      ghost.setGameTime(rig.time.getGameTime());
      victim.setGameTime(rig.time.getGameTime());
      rig.time.update(FRAME);
      rig.manager.update(FRAME, rig.time.getGameTime());
      rig.oc.update(FRAME);

      // Game.tsx's half of the handoff, in the order it runs it: the moment a
      // target reports a POSSESS hit, the ghost transfers control and removes
      // itself. Without this the ghost keeps overlapping and delivers a second
      // POSSESS the next frame - and because the swap ping-pongs, that takes
      // the GhostComponent straight back out again.
      if (victim.lastReceivedHitType === HitType.POSSESS) {
        const source = ghost.getComponent(
          GhostComponent as unknown as new (...args: unknown[]) => GhostComponent
        );
        source?.transferControl(ghost);
        possessed = true;
      }
    }

    expect(possessed, `the ghost never possessed the ${subType}`).toBe(true);

    // The takeover has to swap a GhostComponent in, or there is nothing for
    // the player to drive.
    rig.manager.commitUpdates();
    const driving = victim.getComponent(
      GhostComponent as unknown as new (...args: unknown[]) => GhostComponent
    );
    expect(driving, `possessing the ${subType} swapped in no GhostComponent`).toBeTruthy();
    const player = rig.manager.getPlayer()!;
    const playerControl = player.getComponent(PlayerComponent)!;
    const playerSprite = player.getComponent(SpriteComponent)!;
    const playerBody = player.getComponent(DynamicCollisionComponent)!;
    const draws: string[] = [];
    if (subType === 'brobot') {
      // Exercise the off-screen body's return, not only the target's death.
      // Stage the already-charged player state; charging itself is covered above.
      playerControl.setSystems(rig.input, rig.collision, rig.sound, rig.levelSystem);
      playerControl.ghostActive = true;
      playerControl.currentState = PlayerState.FROZEN;
      playerSprite.setRenderSystem({
        hasSprite: () => true,
        drawSprite: (name: string): void => { draws.push(name); },
      } as unknown as RenderSystem);
      player.update(0, rig.time.getGameTime());
      rig.camera.setPosition(player.getPosition().x + 2000, player.getPosition().y);
      expect(playerSprite.getCurrentDraw()).toBeNull();
      expect(playerBody.getVulnerabilityVolumes()).toBeNull();
    }
    driving!.releaseControl(victim);
    if (subType === 'brobot') {
      expect(victim.life).toBe(0);
      expect(victim.isMarkedForRemoval()).toBe(true);
      expect(playerControl.ghostActive).toBe(false);
      expect(playerControl.currentState).toBe(PlayerState.POST_GHOST_DELAY);
      // Paused display frames do not advance the 1.5-second simulation delay.
      for (let frame = 0; frame < 120; frame++) player.render();
      expect(draws).toEqual([]);
      for (let frame = 0; frame < 40; frame++) {
        rig.time.update(FRAME);
        player.update(FRAME, rig.time.getGameTime());
        player.render();
      }
      expect(draws).toEqual([]);
      expect(playerBody.getVulnerabilityVolumes()).toBeNull();
      for (let frame = 0; frame < 60; frame++) {
        rig.time.update(FRAME);
        player.update(FRAME, rig.time.getGameTime());
        player.render();
      }
      expect<PlayerState>(playerControl.currentState).toBe(PlayerState.MOVE);
      expect(playerSprite.getCurrentDraw()).not.toBeNull();
      expect(playerBody.getVulnerabilityVolumes()).not.toBeNull();
      expect(draws.some(name => name.startsWith('andou_'))).toBe(true);
      continue;
    }

    const swap = victim.getComponent(SwapClass)!;
    expect(victim.life).toBeGreaterThan(0);
    expect(victim.getComponent(GhostClass)).toBeNull();
    expect(swap.getCurrentlySwapped()).toBe(false);
    // Take the same turret over twice more through real collision. Merely
    // swapping the controller back in is insufficient if it stays released.
    for (let cycle = 0; cycle < 2; cycle++) {
      victim.lastReceivedHitType = HitType.INVALID; // Game clears the old handoff marker.
      const nextOrb = rig.factory.spawnGhost(target.x, target.y, 2)!;
      rig.manager.commitUpdates();
      for (let tick = 0; tick < 60 && !victim.getComponent(GhostClass); tick++) {
        nextOrb.setPosition(target.x + victim.width / 2 - nextOrb.width / 2,
          target.y + victim.height / 2 - nextOrb.height / 2);
        rig.camera.setPosition(target.x, target.y);
        rig.time.update(FRAME);
        rig.manager.update(FRAME, rig.time.getGameTime());
        rig.oc.update(FRAME);
      }
      const controller = victim.getComponent(GhostClass)!;
      expect(controller).toBe(driving!); // the same cached component is reused
      nextOrb.getComponent(GhostClass)!.transferControl(nextOrb);
      expect(controller.isReleased()).toBe(false);
      rig.input.setVirtualButton('jump', true);
      controller.update(FRAME, victim);
      expect(victim.getCurrentAction()).toBe(ActionType.ATTACK);
      rig.input.setVirtualButton('jump', false);
      // A new attack press releases, after the prior update observed it up.
      rig.input.setVirtualButton('attack', true);
      controller.update(FRAME, victim);
      rig.input.setVirtualButton('attack', false);
      expect(controller.isReleased()).toBe(true);
      expect(victim.getComponent(GhostClass)).toBeNull();
      expect(swap.getCurrentlySwapped()).toBe(false);
      expect(victim.life).toBeGreaterThan(0);
    }
  }
}, 60_000);
