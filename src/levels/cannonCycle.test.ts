import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem } from '../engine/SoundSystem';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import type { CollisionVolume } from '../engine/collision/CollisionVolume';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObject } from '../entities/GameObject';
import { GameObjectManager } from '../entities/GameObjectManager';
import { LauncherComponent } from '../entities/components/LauncherComponent';
import { PlayerComponent, PlayerState } from '../entities/components/PlayerComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { GenericAnimationComponent, GenericAnimation } from '../entities/components/GenericAnimationComponent';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { resourceToLevelId } from '../data/levelTree';
import { ActionType, HitType } from '../types';
import { LevelSystem } from './LevelSystemNew';

const originalFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const asset = file(join(import.meta.dir, '../../public', url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '')));
    return await asset.exists() ? new Response(await asset.arrayBuffer()) : new Response(null, { status: 404 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });
afterEach(() => { sSystemRegistry.reset(); });

const cannonLevels = ['level_1_8_island', 'level_3_3_sewer', 'level_3_4_sewer',
  'level_4_5_underground', 'level_4_9_underground'];
const launcherType = LauncherComponent as unknown as new (...args: unknown[]) => LauncherComponent;

async function encounter(resource: string): Promise<{
  cannon: GameObject;
  time: TimeSystem;
  player: GameObject;
  collision: CollisionSystem;
  level: LevelSystem;
}> {
  sSystemRegistry.reset();
  const manager = new GameObjectManager();
  const time = new TimeSystem();
  sSystemRegistry.timeSystem = time;
  const collision = new CollisionSystem();
  expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  const level = new LevelSystem();
  level.setSystems(collision, manager, new HotSpotSystem());
  expect(await level.loadLevel(resourceToLevelId[resource])).toBe(true);
  manager.commitUpdates();
  const cannon = manager.getActiveObjects().find(object => object.type === 'cannon');
  if (!cannon) throw new Error(`No cannon in ${resource}`);
  return { cannon, time, player: manager.getPlayer()!, collision, level };
}

test('loaded objects follow the launcher base, including different-height and moving bodies', () => {
  const time = new TimeSystem();
  sSystemRegistry.timeSystem = time;
  for (const [launcherHeight, shotHeight] of [[128, 48], [64, 48], [32, 64], [48, 48]]) {
    const launcher = new LauncherComponent();
    const parent = new GameObject();
    const shot = new GameObject();
    parent.height = launcherHeight;
    shot.height = shotHeight;
    shot.life = 1;
    launcher.prepareToLaunch(shot, parent);
    for (const [x, y] of [[100, 200], [130, 175]]) {
      parent.setPosition(x, y);
      launcher.update(0, parent);
      expect(shot.getPosition().x).toBe(x);
      expect(shot.getPosition().y + shot.height).toBe(y + parent.height);
    }
  }
});

test('real cannon contact hides and freezes Andou until firing, then restores movement and hitboxes', async () => {
  const { cannon, player, time, collision, level } = await encounter('level_3_3_sewer');
  const input = new InputSystem();
  const component = player.getComponent(PlayerComponent)!;
  component.setSystems(input, collision, new SoundSystem(), level);
  const objects = new GameObjectCollisionSystem();
  sSystemRegistry.gameObjectCollisionSystem = objects;
  const playerSprite = player.getComponent(SpriteComponent)!;
  const playerVolumes = player.getComponent(DynamicCollisionComponent)!;
  const cannonSprite = cannon.getComponent(SpriteComponent)!;
  const cannonVolumes = cannon.getComponent(DynamicCollisionComponent)!;
  const launcher = cannon.getComponent(launcherType)!;
  const animator = cannon.getComponent(GenericAnimationComponent)!;
  time.update(1);
  player.setGameTime(time.getGameTime());
  cannon.setGameTime(time.getGameTime());
  // Stage only the approach; contact itself uses the real collision pipeline.
  player.setPosition(cannon.getPosition().x + 16, cannon.getPosition().y + 48);
  component.update(0, player);
  playerSprite.update(0, player);
  cannonSprite.update(0, cannon);
  playerVolumes.update(0, player);
  cannonVolumes.update(0, cannon);
  objects.update(0);
  expect(launcher.getLoadedShot()).toBe(player);
  expect(player.lastReceivedHitType).toBe(HitType.LAUNCH);
  input.setVirtualAxis('horizontal', 1);
  input.setVirtualButton('fly', true);
  input.setVirtualButton('stomp', true);
  component.update(1 / 60, player);
  playerSprite.update(1 / 60, player);
  expect(component.currentState).toBe(PlayerState.FROZEN);
  expect(component.ghostActive).toBe(false);
  expect(component.stomping).toBe(false);
  expect(playerSprite.getCurrentDraw()).toBeNull();
  expect(playerVolumes.getAttackVolumes()).toBeNull();
  expect(playerVolumes.getVulnerabilityVolumes()).toBeNull();
  launcher.update(0, cannon);
  const loadedX = player.getPosition().x;
  const loadedY = player.getPosition().y;
  expect(loadedX).toBe(cannon.getPosition().x + 16);
  expect(loadedY + player.height).toBe(cannon.getPosition().y + cannon.height);
  for (let frame = 0; frame < 60; frame++) {
    time.update(1 / 60);
    player.setGameTime(time.getGameTime());
    component.update(1 / 60, player);
    playerSprite.update(1 / 60, player);
    expect(player.getPosition().x).toBe(loadedX);
    expect(player.getPosition().y).toBe(loadedY);
  }
  time.update(1.01);
  launcher.update(0, cannon);
  animator.update(0, cannon);
  cannonSprite.update(0, cannon);
  expect(cannonVolumes.getAttackVolumes()).toBeNull();
  expect(player.getCurrentAction()).toBe(ActionType.MOVE);
  player.setGameTime(time.getGameTime());
  component.update(1 / 60, player);
  playerSprite.update(1 / 60, player);
  expect(component.currentState).toBe(PlayerState.MOVE);
  expect(component.ghostActive).toBe(false);
  expect(component.stomping).toBe(false);
  expect(playerSprite.getCurrentDraw()).not.toBeNull();
  expect(playerVolumes.getVulnerabilityVolumes()?.length).toBeGreaterThan(0);
  expect(player.getVelocity().y).toBeLessThan(-1900);
  expect(player.getPosition().y).toBeLessThan(loadedY);
});

test('every shipped cannon wires the original idle/fire frames and converted loading volume', async () => {
  for (const resource of cannonLevels) {
    const { cannon } = await encounter(resource);
    const sprite = cannon.getComponent(SpriteComponent)!;
    const animator = cannon.getComponent(GenericAnimationComponent)!;
    expect(animator.getSprite() === sprite, resource).toBe(true);
    const idle = sprite.findAnimation(GenericAnimation.IDLE)!;
    const firing = sprite.findAnimation(GenericAnimation.ATTACK)!;
    expect(idle).not.toBeNull();
    expect(firing).not.toBeNull();
    for (const animation of [idle, firing]) {
      expect(animation.loop).toBe(false);
      expect(animation.frames).toHaveLength(1);
      expect(animation.frames[0]).toMatchObject({ sprite: 'object_cannon', width: 64, height: 128, duration: 1 });
    }
    const volume = idle.frames[0].attackVolumes![0] as CollisionVolume;
    expect(volume.getHitType()).toBe(HitType.LAUNCH);
    expect(volume.getMinYPosition(null)).toBe(128 - 16 - 80);
    expect(volume.getMaxYPosition(null)).toBe(128 - 16);
    expect(firing.frames[0].attackVolumes).toBeNull();
  }
});

test('shipped cannons hold for two game seconds, fire once, disable contact for a second, and rearm', async () => {
  for (const resource of cannonLevels) {
    const { cannon, player, time } = await encounter(resource);
    const launcher = cannon.getComponent(launcherType)!;
    const sprite = cannon.getComponent(SpriteComponent)!;
    const animator = cannon.getComponent(GenericAnimationComponent)!;
    const volumes = cannon.getComponent(DynamicCollisionComponent)!;
    function step(delta: number): void {
      time.update(delta);
      launcher.update(delta, cannon);
      animator.update(delta, cannon);
      sprite.update(delta, cannon);
    }
    for (let cycle = 0; cycle < 2; cycle++) {
      cannon.setCurrentAction(ActionType.IDLE);
      step(0);
      expect(volumes.getAttackVolumes()?.[0].getHitType()).toBe(HitType.LAUNCH);
      player.getVelocity().zero();
      launcher.prepareToLaunch(player, cannon);
      step(2);
      expect(launcher.getLoadedShot()).toBe(player);
      expect(player.getVelocity().y).toBe(0);
      time.pause();
      step(5);
      expect(launcher.getLoadedShot()).toBe(player);
      time.resume();
      step(0.001);
      expect(launcher.getLoadedShot()).toBeNull();
      expect(player.getVelocity().y).toBeCloseTo(-2000);
      expect(cannon.getCurrentAction()).toBe(ActionType.ATTACK);
      expect(volumes.getAttackVolumes()).toBeNull();
      step(0.9);
      expect(volumes.getAttackVolumes()).toBeNull();
      step(0.101);
      expect(cannon.getCurrentAction()).toBe(ActionType.IDLE);
      expect(volumes.getAttackVolumes()?.[0].getHitType()).toBe(HitType.LAUNCH);
    }
  }
});
