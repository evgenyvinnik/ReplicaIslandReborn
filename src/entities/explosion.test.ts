import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { preloadExplosionSprites, EXPLOSION_SPRITES } from './explosion';
import { GameObject } from './GameObject';
import { GameObjectManager } from './GameObjectManager';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { SpriteComponent } from './components/SpriteComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { SortConstants } from '../engine/SortConstants';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { LevelSystem } from '../levels/LevelSystemNew';
import { GameObjectTypeIndex } from '../types/GameObjectTypes';
import { resolveEnemyDeath } from './resolveEnemyDeath';
import { getInventory, setInventory } from './components/InventoryComponent';
import { useGameStore } from '../stores/useGameStore';
import type { RenderSystem } from '../engine/RenderSystem';
import type { SoundSystem } from '../engine/SoundSystem';
import { HitType, Team } from '../types';

let originalStore = useGameStore.getState(), originalInventory = { ...getInventory() };
beforeEach(() => { originalStore = useGameStore.getState(); originalInventory = { ...getInventory() }; });
afterEach(() => { sSystemRegistry.reset(); useGameStore.setState(originalStore); setInventory(originalInventory); });

function setup(): { manager: GameObjectManager; factory: GameObjectFactory; sounds: string[] } {
  sSystemRegistry.reset();
  const manager = new GameObjectManager(), factory = new GameObjectFactory(manager), sounds: string[] = [];
  sSystemRegistry.register(manager, 'gameObject'); sSystemRegistry.register(factory, 'factory');
  sSystemRegistry.soundSystem = { playSfx: (name: string) => sounds.push(name) } as unknown as SoundSystem;
  const renderer = { hasSprite: () => true, drawSprite: () => {} } as unknown as RenderSystem;
  factory.setRenderSystem(renderer); sSystemRegistry.register(renderer, 'render');
  return { manager, factory, sounds };
}

for (const large of [false, true]) {
  const kind = large ? GameObjectType.EXPLOSION_LARGE : GameObjectType.EXPLOSION_SMALL;
  const size = large ? 64 : 32, count = large ? 9 : 7;
  test(`${kind}: original frames, dimensions, neutral team, sound, exact lifetime and recycling`, () => {
    const { manager, factory, sounds } = setup();
    const blast = factory.spawn(kind, 100, 200)!;
    const sprite = blast.getComponent(SpriteComponent)!;
    expect(blast.width).toBe(size); expect(blast.height).toBe(size); expect(blast.team).toBe(Team.NONE);
    expect(blast.activationRadius).toBe(-1);
    const frames = sprite.getCurrentAnimation()!.frames;
    expect(frames).toHaveLength(count); expect(sprite.getCurrentAnimation()!.loop).toBe(false);
    for (let i = 0; i < count; i++) {
      expect(frames[i].sprite).toBe(`effect_explosion_${large ? 'big' : 'small'}${String(i + 1).padStart(2, '0')}.png`);
      expect(frames[i].duration).toBe(1 / 24);
      expect(frames[i].attackVolumes).toHaveLength(1); expect(frames[i].vulnerabilityVolumes).toBeNull();
    }
    manager.update((count - 1) / 24, 1);
    expect(sprite.getCurrentDraw()?.sprite).toBe(frames[count - 1].sprite);
    expect(sprite.getCurrentDraw()?.priority).toBe(SortConstants.EFFECT);
    expect(blast.isMarkedForRemoval()).toBe(false);
    expect(sounds).toEqual(large ? ['quick_explosion'] : []);
    manager.update(1 / 24 + 1e-9, 2); manager.commitUpdates();
    expect(manager.getActiveObjects()).toHaveLength(0);
    const reused = manager.createObject(); expect(reused).toBe(blast);
    expect(reused.getComponents()).toHaveLength(0);
    expect(sounds).toEqual(large ? ['quick_explosion'] : []);
  });

  test(`${kind}: its circular HIT damages either team but not targets beyond the radius`, () => {
    const { factory } = setup();
    const system = new GameObjectCollisionSystem(); sSystemRegistry.register(system, 'gameObjectCollision');
    const blast = factory.spawn(kind, 100, 200)!;
    const attack = blast.getComponent(DynamicCollisionComponent)!.getAttackVolumes()![0] as SphereCollisionVolume;
    expect(attack.getRadius()).toBe(size / 2); expect(attack.getCenter()).toEqual({ x: size / 2, y: size / 2 });
    const target = (team: Team, x: number): GameObject => {
      const object = new GameObject(); object.width = object.height = 2; object.team = team; object.life = 3;
      object.setPosition(x, 200 + size / 2 - 1);
      const collision = new DynamicCollisionComponent();
      collision.setCollisionVolumes(null, [new SphereCollisionVolume(1, 1, 1, HitType.HIT)]);
      const reaction = new HitReactionComponent(); collision.setHitReactionComponent(reaction);
      object.addComponent(collision); object.addComponent(reaction); return object;
    };
    const andou = target(Team.PLAYER, 100 + size - 2), enemy = target(Team.ENEMY, 100 + size - 2);
    const distant = target(Team.ENEMY, 100 + size + 2);
    for (const object of [blast, andou, enemy, distant]) object.update(0, 1);
    system.update(0);
    expect(andou.life).toBe(2); expect(enemy.life).toBe(2); expect(distant.life).toBe(3);
  });
}

test('level-placed blasts share factory behavior and a real level turret emits one large blast on death', async () => {
  const { manager, factory, sounds } = setup();
  const level = new LevelSystem(); level.setSystems(new CollisionSystem(), manager);
  const tiles = Array.from({ length: 8 }, () => Array(16).fill(-1) as number[]);
  tiles[3][2] = GameObjectTypeIndex.EXPLOSION_SMALL;
  tiles[3][6] = GameObjectTypeIndex.EXPLOSION_LARGE;
  tiles[3][10] = GameObjectTypeIndex.TURRET;
  const data = { format: 'replica-island-level', version: 1, backgroundId: 2, layers: [
    { typeId: 1, themeId: 0, scrollSpeed: 1, world: { width: 16, height: 8, tiles: tiles.map(row => row.map(() => -1)) } },
    { typeId: 2, themeId: 0, scrollSpeed: 1, world: { width: 16, height: 8, tiles } },
  ] };
  const fetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify(data))) as unknown as typeof globalThis.fetch;
    expect(await level.loadLevel(2)).toBe(true);
  } finally { globalThis.fetch = fetch; }
  manager.commitUpdates();
  for (const large of [false, true]) {
    const kind = large ? GameObjectType.EXPLOSION_LARGE : GameObjectType.EXPLOSION_SMALL;
    const placed = manager.getActiveObjects().find(o => o.subType === kind)!;
    const runtime = factory.spawn(kind, 0, 0)!;
    expect(placed).toBeDefined();
    expect(placed.getComponent(SpriteComponent)!.getCurrentAnimation()).toEqual(runtime.getComponent(SpriteComponent)!.getCurrentAnimation());
    expect(placed.team).toBe(Team.NONE);
    placed.update((large ? 9 : 7) / 24 + 1e-9, 1);
    expect(placed.isMarkedForRemoval()).toBe(true);
  }
  const turret = manager.getActiveObjects().find(o => o.subType === 'turret')!;
  expect(turret.getComponent(DynamicCollisionComponent)!.getVulnerabilityVolumes()![0].getHitType()).toBe(HitType.POSSESS);
  const x = turret.getPosition().x, y = turret.getPosition().y;
  turret.life = 0; // Test its death consequence; ordinary HIT cannot kill a turret.
  expect(resolveEnemyDeath(turret)).toBe(true); expect(resolveEnemyDeath(turret)).toBe(false);
  manager.commitUpdates();
  const blast = manager.getActiveObjects().find(o => o.subType === 'explosion_large' && o.getPosition().x === x)!;
  expect(blast.getPosition().y).toBe(y);
  sounds.length = 0; blast.update(0, 1); blast.update(0, 1);
  expect(sounds).toEqual(['quick_explosion']);
});

test('Game startup preloads every small, large and giant frame under its actual renderer key', async () => {
  const { factory } = setup();
  const loaded = new Map<string, string>();
  await preloadExplosionSprites({ loadSingleImage: async (name: string, url: string) => {
    loaded.set(name, url);
  } } as unknown as RenderSystem);
  expect(loaded.size).toBe(16); expect(EXPLOSION_SPRITES).toHaveLength(16);
  for (const kind of [GameObjectType.EXPLOSION_SMALL, GameObjectType.EXPLOSION_LARGE, GameObjectType.EXPLOSION_GIANT]) {
    const object = factory.spawn(kind, 0, 0)!;
    for (const component of object.getComponents()) {
      if (!(component instanceof SpriteComponent)) continue;
      for (const frame of component.getCurrentAnimation()!.frames) {
        if (!frame.sprite) continue; // giant's delayed blank frames
        expect(loaded.get(frame.sprite)?.endsWith(`/assets/sprites/${frame.sprite}`)).toBe(true);
      }
    }
  }
  const game = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(game).toContain('await Promise.all([effectsSystem.preloadSprites(), preloadExplosionSprites(renderSystem)])');
});
