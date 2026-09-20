import { afterEach, beforeEach, expect, test } from 'bun:test';
import { file } from 'bun';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { TimeSystem } from '../engine/TimeSystem';
import type { RenderSystem } from '../engine/RenderSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObject } from '../entities/GameObject';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { HitReactionComponent } from '../entities/components/HitReactionComponent';
import { GravityComponent } from '../entities/components/GravityComponent';
import { SimpleCollisionComponent } from '../entities/components/SimpleCollisionComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { HitType, Team } from '../types';
import { GameObjectTypeIndex } from '../types/GameObjectTypes';
import { LevelSystem, type SpawnInfo } from './LevelSystemNew';

let collision: CollisionSystem;
beforeEach(async () => {
  sSystemRegistry.reset();
  collision = new CollisionSystem();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0]): Promise<Response> =>
      new Response(await file(new URL('../../public/assets/collision.json', import.meta.url)).arrayBuffer())) as typeof fetch;
    expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  } finally { globalThis.fetch = originalFetch; }
  collision.setTileCollision(Array.from({ length: 400 }, (_, i) => i % 20 === 6 ? 1 : -1), 20, 20, 32, 32);
  sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(new TimeSystem(), 'time');
});
afterEach(() => sSystemRegistry.reset());

const kinds = [
  { kind: 'cannon_ball', index: GameObjectTypeIndex.CANNON_BALL, size: 32, ttl: 3, radius: 8, diesOnAttack: true },
  { kind: 'turret_bullet', index: GameObjectTypeIndex.TURRET_BULLET, size: 16, ttl: 3, radius: 8, diesOnAttack: true },
  { kind: 'energy_ball', index: GameObjectTypeIndex.ENERGY_BALL, size: 32, ttl: 5, radius: 16, diesOnAttack: true },
  { kind: 'wanda_shot', index: GameObjectTypeIndex.WANDA_SHOT, size: 32, ttl: 5, radius: 16, diesOnAttack: false },
  { kind: 'brobot_bullet', index: GameObjectTypeIndex.BROBOT_BULLET, size: 64, ttl: 3, radius: null, diesOnAttack: false },
] as const;

function spawn(kind: typeof kinds[number], placed: boolean, rendered = false): GameObject {
  const manager = new GameObjectManager();
  sSystemRegistry.register(manager, 'gameObject');
  const factory = new GameObjectFactory(manager);
  factory.setCollisionSystem(collision);
  factory.setSystemRegistry(sSystemRegistry);
  if (rendered) {
    const renderer = { hasSprite: () => true } as unknown as RenderSystem;
    factory.setRenderSystem(renderer);
    sSystemRegistry.register(renderer, 'render');
  }
  if (placed) {
    const level = new LevelSystem();
    level.setSystems(collision, manager, new HotSpotSystem());
    // Exercise the actual serialized-object dispatch without inventing a
    // campaign level containing projectile placements that it does not ship.
    (level as unknown as { spawnObjectByType: (info: SpawnInfo) => void }).spawnObjectByType({
      type: kind.index, x: 96, y: 96, tileX: 3, tileY: 3,
    });
  } else {
    factory.spawn(kind.kind as GameObjectType, 96, 96);
  }
  manager.commitUpdates();
  const object = manager.getActiveObjects()[0];
  expect(object).toBeDefined();
  return object;
}

const art: Record<string, string[]> = {
  cannon_ball: ['snail_bomb'],
  turret_bullet: ['effect_bullet01', 'effect_bullet02'],
  energy_ball: ['energy_ball01', 'energy_ball02', 'energy_ball03', 'energy_ball04'],
  wanda_shot: ['energy_ball01', 'energy_ball02', 'energy_ball03', 'energy_ball04'],
  brobot_bullet: ['enemy_brobot_walk01', 'enemy_brobot_walk02', 'enemy_brobot_walk03'],
};

for (const rendered of [false, true]) for (const placed of [false, true]) for (const kind of kinds) {
  const label = `${rendered ? 'rendered' : 'headless'} ${placed ? 'serialized' : 'runtime'} ${kind.kind}`;
  test(`${label} matches original size, hit behavior and straight motion`, () => {
    const object = spawn(kind, placed, rendered);
    expect(object.type).toBe('projectile');
    expect(object.subType).toBe(kind.kind);
    expect(object.width).toBe(kind.size);
    expect(object.height).toBe(kind.size);
    expect(object.team).toBe(kind.kind === 'wanda_shot' ? Team.NONE : Team.ENEMY);
    expect(object.destroyOnDeactivation).toBe(true);
    expect(object.getComponent(GravityComponent as unknown as new (...args: unknown[]) => GravityComponent)).toBeNull();
    expect(!!object.getComponent(SimpleCollisionComponent)).toBe(kind.kind === 'cannon_ball');
    const animation = object.getComponent(SpriteComponent)!.getCurrentAnimation()!;
    expect(animation.frames.map(frame => frame.sprite)).toEqual(art[kind.kind]);
    expect(animation.frames.map(frame => frame.duration)).toEqual(art[kind.kind].map(() => 1 / 24));
    expect(animation.loop).toBe(kind.kind !== 'cannon_ball');
    const attack = object.getComponent(DynamicCollisionComponent)?.getAttackVolumes();
    if (kind.radius === null) {
      expect(attack ?? null).toBeNull();
      const draw = object.getComponent(SpriteComponent)!.getCurrentDraw()!;
      expect(draw.sprite).toBe('enemy_brobot_walk01');
      const frames = object.getComponent(SpriteComponent)!.getCurrentAnimation()!.frames;
      expect(frames.map(frame => frame.sprite)).toEqual([
        'enemy_brobot_walk01', 'enemy_brobot_walk02', 'enemy_brobot_walk03',
      ]);
      for (const frame of frames) {
        expect(frame.width).toBe(64);
        expect(frame.height).toBe(64);
        expect(frame.duration).toBe(1 / 24);
      }
    } else {
      expect(attack?.length).toBe(1);
      expect(attack?.[0].getHitType()).toBe(HitType.HIT);
      expect((attack?.[0] as SphereCollisionVolume).getRadius()).toBe(kind.radius);
    }
    object.setPosition(96, 96);
    object.setVelocity(60, -30);
    object.update(0.1, 1);
    expect(object.getPosition().x).toBeCloseTo(102, 5);
    expect(object.getPosition().y).toBeCloseTo(93, 5);
    const reaction = object.getComponent(HitReactionComponent as unknown as new (...args: unknown[]) => HitReactionComponent);
    reaction?.hitVictim(object, new GameObject(), HitType.HIT, true);
    expect(object.life === 0).toBe(kind.diesOnAttack);
  });

  test(`${label} obeys original terrain and lifetime rules`, () => {
    const object = spawn(kind, placed, rendered);
    object.setPosition(96, 96);
    object.setVelocity(300, 0);
    for (let frame = 1; frame <= 20 && !object.isMarkedForRemoval(); frame++) {
      sSystemRegistry.timeSystem!.update(0.05);
      object.update(0.05, sSystemRegistry.timeSystem!.getGameTime());
    }
    expect(object.isMarkedForRemoval()).toBe(kind.kind === 'cannon_ball');
    if (kind.kind !== 'cannon_ball') expect(object.getPosition().x).toBeGreaterThan(224);
    const timed = spawn(kind, placed, rendered);
    timed.setVelocity(0, 0);
    timed.update(kind.ttl - 0.01, 1);
    expect(timed.isMarkedForRemoval()).toBe(false);
    timed.update(0.02, 2);
    expect(timed.isMarkedForRemoval()).toBe(true);
  });
}

test('projectile frame sizes and names match the shipped PNG assets', async () => {
  for (const kind of kinds) {
    const animation = spawn(kind, false).getComponent(SpriteComponent)!.getCurrentAnimation()!;
    for (const frame of animation.frames) {
      const png = file(new URL(`../../public/assets/sprites/${frame.sprite}.png`, import.meta.url));
      expect(await png.exists(), frame.sprite).toBe(true);
      const bytes = new DataView(await png.arrayBuffer());
      expect(bytes.getUint32(16)).toBe(frame.width);
      expect(bytes.getUint32(20)).toBe(frame.height);
    }
  }
});
