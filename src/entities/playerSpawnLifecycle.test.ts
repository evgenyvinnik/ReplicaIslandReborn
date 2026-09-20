import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { GameObjectManager } from './GameObjectManager';
import { GameObject } from './GameObject';
import { PlayerComponent } from './components/PlayerComponent';
import { SpriteComponent } from './components/SpriteComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { PhysicsComponent } from './components/PhysicsComponent';
import { MovementComponent } from './components/MovementComponent';
import { FadeDrawableComponent } from './components/FadeDrawableComponent';
import { InputSystem } from '../engine/InputSystem';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { SoundSystem } from '../engine/SoundSystem';
import { SortConstants } from '../engine/SortConstants';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { DifficultySettings } from '../stores/useGameStore';
import { LevelSystem } from '../levels/LevelSystemNew';
import type { RenderSystem } from '../engine/RenderSystem';
import { HitType, Team } from '../types';

afterEach(() => sSystemRegistry.reset());
const originalFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const asset = file(join(import.meta.dir, '../../public', url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '')));
    return await asset.exists() ? new Response(await asset.arrayBuffer()) : new Response(null, { status: 404 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });

function scene(rendering: boolean): {
  manager: GameObjectManager; factory: GameObjectFactory; collision: CollisionSystem;
  input: InputSystem; sound: SoundSystem; level: LevelSystem; draws: string[];
} {
  sSystemRegistry.reset();
  const manager = new GameObjectManager(), factory = new GameObjectFactory(manager);
  const collision = new CollisionSystem(), input = new InputSystem(), sound = new SoundSystem();
  const level = { getLevelSize: () => ({ width: 4096, height: 4096 }) } as LevelSystem;
  const draws: string[] = [];
  if (rendering) {
    const renderer = { hasSprite: () => true, drawSprite: (name: string) => draws.push(name) } as unknown as RenderSystem;
    factory.setRenderSystem(renderer); sSystemRegistry.renderSystem = renderer;
  }
  factory.setCollisionSystem(collision);
  return { manager, factory, collision, input, sound, level, draws };
}

test.each([false, true])('runtime player has full body collision and one movement owner (renderer=%s)', rendering => {
  const rig = scene(rendering);
  const player = rig.factory.spawn(GameObjectType.PLAYER, 100, 200)!;
  const control = player.getComponent(PlayerComponent)!;
  expect(rig.manager.getPlayer()).toBe(player);
  expect(player.getComponent(SpriteComponent)).not.toBeNull();
  expect(player.getComponent(DynamicCollisionComponent)).not.toBeNull();
  expect(player.getComponents().filter(c => c instanceof HitReactionComponent)).toHaveLength(1);
  expect(player.getComponent(PhysicsComponent)).toBeNull();
  expect(player.getComponent(MovementComponent)).toBeNull();
  expect([player.width, player.height, player.life, player.maxLife, player.team, player.activationRadius])
    .toEqual([32, 48, 3, 3, Team.PLAYER, -1]);
  control.setSystems(rig.input, rig.collision, rig.sound, rig.level);
  player.setVelocity(120, 40);
  player.update(1 / 60, 1);
  expect(player.getPosition().x).toBeCloseTo(102);
  expect(player.getPosition().y).toBeCloseTo(200 + (40 + PlayerComponent.GRAVITY / 60) / 60);
  expect(player.getVelocity().y).toBeCloseTo(40 + PlayerComponent.GRAVITY / 60);
  const body = player.getComponent(DynamicCollisionComponent)!;
  expect(body.getAttackVolumes()!.map(v => v.getHitType())).toEqual([HitType.COLLECT, HitType.DEPRESS]);
  expect(body.getVulnerabilityVolumes()).toHaveLength(1);
  expect(player.getComponent(SpriteComponent)!.getCurrentDraw()?.priority).toBe(SortConstants.PLAYER);
});

test.each([DifficultySettings.baby, DifficultySettings.kids, DifficultySettings.adults])('placed and runtime players share the body/reaction setup at life %s', async difficulty => {
  const rig = scene(false);
  const level = new LevelSystem();
  level.setSystems(rig.collision, rig.manager, new HotSpotSystem());
  level.setPlayerMaxLife(difficulty.playerMaxLife);
  expect(await level.loadLevel(2)).toBe(true);
  rig.manager.commitUpdates();
  const placed = rig.manager.getPlayer()!;
  rig.factory.setPlayerMaxLife(difficulty.playerMaxLife);
  const runtime = rig.factory.spawn(GameObjectType.PLAYER, 100, 200)!;
  expect(runtime.getComponents().map(c => c.constructor.name))
    .toEqual(placed.getComponents().map(c => c.constructor.name));
  for (const player of [placed, runtime]) {
    expect([player.life, player.maxLife]).toEqual([difficulty.playerMaxLife, difficulty.playerMaxLife]);
    player.getComponent(PlayerComponent)!.setSystems(rig.input, rig.collision, rig.sound, level);
    player.update(0, 1);
    const volumes = player.getComponent(DynamicCollisionComponent)!;
    expect(volumes.getAttackVolumes()!.map(v => v.getHitType())).toEqual([HitType.COLLECT, HitType.DEPRESS]);
    expect(volumes.getVulnerabilityVolumes()).toHaveLength(1);
    expect(player.getComponent(SpriteComponent)!.getCurrentDraw()?.sprite).toBe('andou_stand');
  }
});

test('runtime collision damage bounces the player and grants the original three-second immunity', () => {
  const rig = scene(false), objects = new GameObjectCollisionSystem();
  sSystemRegistry.gameObjectCollisionSystem = objects;
  const player = rig.factory.spawn(GameObjectType.PLAYER, 100, 200)!;
  player.getComponent(PlayerComponent)!.setSystems(rig.input, rig.collision, rig.sound, rig.level);
  const attacker = new GameObject(); attacker.team = Team.ENEMY;
  attacker.width = 32; attacker.height = 48; attacker.setPosition(108, 200);
  const attack = new DynamicCollisionComponent();
  attack.setCollisionVolumes([new SphereCollisionVolume(16, 16, 16, HitType.HIT)], null);
  attacker.addComponent(attack);
  player.update(0, 1); attacker.update(0, 1); objects.update(0);
  expect(player.life).toBe(2);
  expect(player.getVelocity()).toMatchObject({ x: -100, y: -100 });
  const reaction = player.getComponents().find(c => c instanceof HitReactionComponent)!;
  reaction.update(2.99, player);
  expect(reaction.receivedHit(player, attacker, HitType.HIT)).toBe(false);
  reaction.update(0.02, player);
  expect(reaction.receivedHit(player, attacker, HitType.HIT)).toBe(true);
  expect(player.life).toBe(1);
});

test('a pooled player restores body, halo and hitboxes across repeated spawn/removal cycles', () => {
  const rig = scene(true);
  let previousControl: PlayerComponent | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const player = rig.factory.spawn(GameObjectType.PLAYER, 100, 200)!;
    const control = player.getComponent(PlayerComponent)!;
    if (previousControl) expect(control).toBe(previousControl);
    expect(control.hasSystemsInjected()).toBe(false);
    control.setSystems(rig.input, rig.collision, rig.sound, rig.level);
    control.activateGlow(15);
    rig.manager.update(0, 1 + attempt);
    expect(player.getComponent(SpriteComponent)!.getCurrentDraw()?.sprite).toBe('andou_stand');
    expect(player.getComponents().filter(c => c instanceof SpriteComponent)).toHaveLength(2);
    expect(player.getComponents().filter(c => c instanceof FadeDrawableComponent)).toHaveLength(1);
    expect(player.getComponents().filter(c => c instanceof DynamicCollisionComponent)).toHaveLength(2);
    rig.draws.length = 0;
    player.render();
    expect(rig.draws).toContain('andou_stand');
    expect(rig.draws).toContain('effect_glow01');
    previousControl = control;
    rig.manager.reset();
    expect(player.getComponents()).toHaveLength(0);
  }
});

test('in-place reset removes owned glow resources and repeated difficulty setup does not stack faders', () => {
  const rig = scene(true);
  const player = rig.factory.spawn(GameObjectType.PLAYER, 100, 200)!;
  const control = player.getComponent(PlayerComponent)!;
  control.setSystems(rig.input, rig.collision, rig.sound, rig.level);
  control.activateGlow(15); rig.manager.update(0, 1);
  const reaction = player.getComponents().find(c => c instanceof HitReactionComponent)!;
  expect(reaction.isInvincible()).toBe(true);
  control.reset();
  expect(reaction.isInvincible()).toBe(false);
  expect(player.getComponents().filter(c => c instanceof SpriteComponent)).toHaveLength(1);
  expect(player.getComponents().filter(c => c instanceof FadeDrawableComponent)).toHaveLength(0);
  expect(player.getComponents().filter(c => c instanceof DynamicCollisionComponent)).toHaveLength(1);
  for (const difficulty of [DifficultySettings.baby, DifficultySettings.kids, DifficultySettings.adults]) {
    control.applyDifficulty(difficulty, 0, player);
    rig.manager.update(0, 2);
    expect(player.getComponents().filter(c => c instanceof FadeDrawableComponent)).toHaveLength(1);
    expect(player.getComponents().filter(c => c instanceof SpriteComponent)).toHaveLength(2);
    expect(player.getComponent(SpriteComponent)!.getCurrentDraw()?.sprite).toBe('andou_stand');
  }
});
