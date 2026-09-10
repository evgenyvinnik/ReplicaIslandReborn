import { afterEach, expect, test } from 'bun:test';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { GameObjectManager } from './GameObjectManager';
import { GameObject } from './GameObject';
import { SpriteComponent } from './components/SpriteComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { SortConstants } from '../engine/SortConstants';
import type { RenderSystem } from '../engine/RenderSystem';
import type { SoundSystem } from '../engine/SoundSystem';
import { HitType, Team } from '../types';

afterEach(() => sSystemRegistry.reset());

interface DrawCall { sprite: string; x: number; y: number; z: number }
function fixture(): {
  manager: GameObjectManager; factory: GameObjectFactory; blast: GameObject;
  draw: () => DrawCall[]; sounds: string[];
} {
  sSystemRegistry.reset();
  const manager = new GameObjectManager();
  const factory = new GameObjectFactory(manager);
  const calls: DrawCall[] = [];
  factory.setRenderSystem({
    hasSprite: (name: string) => name !== '',
    drawSprite: (sprite: string, x: number, y: number, _frame: number, z: number) => {
      calls.push({ sprite, x, y, z });
    },
  } as unknown as RenderSystem);
  const sounds: string[] = [];
  sSystemRegistry.soundSystem = { playSfx: (name: string) => sounds.push(name) } as unknown as SoundSystem;
  const blast = factory.spawn(GameObjectType.EXPLOSION_GIANT, 100, 200)!;
  const draw = (): DrawCall[] => { calls.length = 0; blast.render(); return [...calls]; };
  return { manager, factory, blast, draw, sounds };
}

test('giant blast has four overlapping layers with original offsets and staggered starts', () => {
  const { blast, draw } = fixture();
  expect(blast.width).toBe(64);
  expect(blast.height).toBe(64);
  expect(blast.getComponents().filter(c => c instanceof SpriteComponent)).toHaveLength(4);
  expect(draw()).toEqual([
    { sprite: 'effect_explosion_big01.png', x: 100, y: 200, z: SortConstants.EFFECT },
    { sprite: 'effect_explosion_small01.png', x: 140, y: 182, z: SortConstants.EFFECT },
  ]);
  blast.update(4 / 24, 4 / 24);
  expect(draw().map(c => [c.sprite, c.x, c.y])).toEqual([
    ['effect_explosion_big05.png', 100, 200],
    ['effect_explosion_small05.png', 140, 182],
    ['effect_explosion_small01.png', 90, 232],
  ]);
  blast.update(4 / 24, 8 / 24);
  expect(draw().map(c => c.sprite)).toEqual([
    'effect_explosion_big09.png', 'effect_explosion_small07.png',
    'effect_explosion_small05.png', 'effect_explosion_small01.png',
  ]);
  blast.update(6 / 24, 14 / 24);
  expect(draw().map(c => c.sprite)).toEqual([
    'effect_explosion_big09.png', 'effect_explosion_small07.png',
    'effect_explosion_small07.png', 'effect_explosion_small07.png',
  ]);
});

test('giant blast plays one quick explosion, expires at 15/24s and is recycled', () => {
  const { manager, blast, sounds, draw } = fixture();
  manager.update(14 / 24, 14 / 24);
  expect(sounds).toEqual(['quick_explosion']);
  expect(blast.isMarkedForRemoval()).toBe(false);
  manager.update(1 / 24 + 1e-9, 15 / 24 + 1e-9);
  expect(blast.isMarkedForRemoval()).toBe(true);
  expect(draw()).toEqual([]);
  expect(sounds).toEqual(['quick_explosion']);
  manager.commitUpdates();
  expect(manager.getActiveObjects()).toHaveLength(0);
  const recycled = manager.createObject();
  expect(recycled).toBe(blast);
  expect(recycled.getComponents()).toHaveLength(0);
});

test('giant blast damages enemies in its 64px radius, not Andou or distant targets', () => {
  const { blast } = fixture();
  const collisionSystem = new GameObjectCollisionSystem();
  sSystemRegistry.register(collisionSystem, 'gameObjectCollision');
  const volume = blast.getComponent(DynamicCollisionComponent)!.getAttackVolumes()![0] as SphereCollisionVolume;
  expect(volume.getRadius()).toBe(64);
  expect(volume.getCenter()).toEqual({ x: 32, y: 32 });
  expect(blast.team).toBe(Team.PLAYER);
  const target = (x: number, team: Team): GameObject => {
    const object = new GameObject();
    object.width = object.height = 2;
    object.life = 3;
    object.team = team;
    object.setPosition(x, 231);
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(null, [new SphereCollisionVolume(1, 1, 1, HitType.HIT)]);
    const reaction = new HitReactionComponent();
    collision.setHitReactionComponent(reaction);
    object.addComponent(collision);
    object.addComponent(reaction);
    return object;
  };
  const enemy = target(190, Team.ENEMY); // Outside the 64x64 artwork, inside its blast.
  const andou = target(132, Team.PLAYER);
  const distant = target(200, Team.ENEMY);
  for (const obj of [blast, enemy, andou, distant]) obj.update(1 / 60, 1 / 60);
  collisionSystem.update(1 / 60);
  expect(enemy.life).toBe(2);
  expect(andou.life).toBe(3);
  expect(distant.life).toBe(3);
});
