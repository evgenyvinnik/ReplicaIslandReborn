import { afterEach, expect, test } from 'bun:test';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { GameObjectManager } from './GameObjectManager';
import { SpriteComponent } from './components/SpriteComponent';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { SortConstants } from '../engine/SortConstants';
import { EffectsSystem, EffectType } from '../engine/EffectsSystem';
import type { RenderSystem } from '../engine/RenderSystem';

afterEach(() => sSystemRegistry.reset());

test('renderer-enabled runtime actors use the same original layering as placed actors', () => {
  const factory = new GameObjectFactory(new GameObjectManager());
  factory.setRenderSystem({ hasSprite: () => true } as unknown as RenderSystem);
  for (const [type, priority] of [
    [GameObjectType.PLAYER, SortConstants.PLAYER],
    [GameObjectType.ENEMY_BROBOT, SortConstants.GENERAL_ENEMY],
    [GameObjectType.ENEMY_SNAILBOMB, SortConstants.GENERAL_ENEMY],
    [GameObjectType.COIN, SortConstants.GENERAL_OBJECT],
    [GameObjectType.GHOST, SortConstants.PROJECTILE],
    [GameObjectType.SMOKE_BIG, SortConstants.EFFECT],
    [GameObjectType.SMOKE_SMALL, SortConstants.EFFECT],
  ] as const) {
    const object = factory.spawn(type, 100, 100)!;
    expect(object.getComponent(SpriteComponent)?.getCurrentDraw()?.priority, type).toBe(priority);
  }
});

test('runtime and pooled smoke show the same five original frames and expire', () => {
  const random = Math.random;
  try {
    for (const [variant, hold] of [10, 13, 8, 5, 15].entries()) {
      Math.random = (): number => (variant + 0.5) / 5;
      const manager = new GameObjectManager();
      sSystemRegistry.register(manager, 'gameObject');
      const factory = new GameObjectFactory(manager);
      factory.setSystemRegistry(sSystemRegistry);
      const object = factory.spawn(GameObjectType.SMOKE_BIG, 100, 100)!;
      manager.commitUpdates();
      const sprite = object.getComponent(SpriteComponent)!;
      const effects = new EffectsSystem();
      effects.spawn(EffectType.SMOKE_BIG, 116, 116);
      const drawn: string[] = [];
      const renderer = { hasSprite: () => true, drawSprite: (name: string): void => { drawn.push(name); } } as unknown as RenderSystem;
      const frames = new Set<string>();
      // Eight updates per authored animation frame avoid crossing an entire
      // short frame between observations while testing the full hold duration.
      for (let tick = 0; tick < (hold + 4) * 8; tick++) {
        frames.add(sprite.getCurrentDraw()!.sprite);
        effects.drawQueued(renderer, SortConstants.EFFECT);
        expect(drawn[drawn.length - 1]).toBe(sprite.getCurrentDraw()!.sprite);
        object.update(1 / 192, tick / 192);
        effects.update(1 / 192);
      }
      expect(frames).toEqual(new Set([1, 2, 3, 4, 5].map((n) => `effect_smoke_big0${n}.png`)));
      object.update(1 / 192, 1);
      expect(object.isMarkedForRemoval()).toBe(true);
      manager.update(0, 1);
      manager.commitUpdates();
      expect(manager.getActiveObjects()).not.toContain(object);
      expect(effects.getActiveCount()).toBe(0);
    }
  } finally { Math.random = random; }
});
