/**
 * The drawable-modifying components: fades, the glow halo, and motion blur.
 *
 * These three were ported long ago and attached to nothing, because rendering
 * did not go through `SpriteComponent` and they all work by changing what a
 * sprite draws. Now that it does, they are wired the way the original wires
 * them, and this pins that:
 *
 * - The Source is five cross-fading layers (`spawnObjectTheSource`)
 * - the glow powerup is a halo layered over Andou (`spawnPlayer`, PLAYER_GLOW)
 * - Kyle trails a motion blur while he dashes (`spawnEnemyKyle`)
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { LevelSystem } from './LevelSystemNew';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { FadeDrawableComponent } from '../entities/components/FadeDrawableComponent';
import { MotionBlurComponent } from '../entities/components/MotionBlurComponent';
import { PlayerComponent } from '../entities/components/PlayerComponent';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem } from '../engine/SoundSystem';
import { GameObject } from '../entities/GameObject';
import type { RenderSystem } from '../engine/RenderSystem';
import type { GameComponent } from '../entities/GameComponent';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');

interface DrawCall {
  sprite: string;
  x: number;
  y: number;
  priority: number;
  alpha: number;
}

function createRecordingRenderSystem(): { system: RenderSystem; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const system = {
    hasSprite: (): boolean => true,
    drawSprite: (
      sprite: string, x: number, y: number,
      _frame: number, priority: number, alpha: number
    ): void => {
      calls.push({ sprite, x, y, priority, alpha: alpha ?? 1 });
    },
  } as unknown as RenderSystem;
  return { system, calls };
}

function componentsOf<T extends GameComponent>(object: GameObject, ctor: unknown): T[] {
  return object.getComponents().filter((c) => c instanceof (ctor as never)) as T[];
}

beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.pathname
        : new URL(input.url).pathname;
    const pathname = rawUrl.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const requested = file(join(publicDirectory, pathname));
    if (!(await requested.exists())) return new Response(null, { status: 404 });
    return new Response(await requested.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('drawable-modifying components', () => {
  let calls: DrawCall[];
  let manager: GameObjectManager;

  beforeEach(() => {
    sSystemRegistry.reset();
    manager = new GameObjectManager();
    manager.setCamera(new CameraSystem(480, 320));
    const recorder = createRecordingRenderSystem();
    calls = recorder.calls;
    sSystemRegistry.register(recorder.system, 'render');
    sSystemRegistry.register(manager, 'gameObject');
  });

  async function loadLevelWith(
    predicate: (object: GameObject) => boolean
  ): Promise<GameObject | null> {
    for (const group of linearLevelTree) {
      for (const entry of group.levels) {
        const levelSystem = new LevelSystem();
        levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
        if (!(await levelSystem.loadLevel(resourceToLevelId[entry.resource]))) continue;
        manager.commitUpdates();
        const found = manager.getActiveObjects().find(predicate);
        if (found) return found;
        manager.reset();
      }
    }
    return null;
  }

  describe('The Source', () => {
    async function loadTheSource(): Promise<GameObject> {
      const source = await loadLevelWith((o) => o.subType === 'the_source');
      expect(source, 'no level spawns The Source').not.toBeNull();
      return source!;
    }

    test('is built from five layered sprites, each with its own fade', async () => {
      const source = await loadTheSource();
      expect(componentsOf<SpriteComponent>(source, SpriteComponent).length).toBe(5);
      expect(componentsOf<FadeDrawableComponent>(source, FadeDrawableComponent).length).toBe(5);
    });

    test('the layers draw back-to-front in the original\'s order', async () => {
      const source = await loadTheSource();
      calls.length = 0;
      for (const sprite of componentsOf<SpriteComponent>(source, SpriteComponent)) {
        sprite.update(1 / 60, source);
        sprite.render(source);
      }

      const drawn = [...calls].sort((a, b) => a.priority - b.priority).map((c) => c.sprite);
      // Original: spikes, body, black, spots, core at THE_SOURCE_START + 0..4.
      expect(drawn).toEqual([
        'source_spikes', 'source_body', 'source_black', 'source_spots', 'source_core',
      ]);
    });

    test('the layers all sit behind ordinary objects', async () => {
      const source = await loadTheSource();
      calls.length = 0;
      for (const sprite of componentsOf<SpriteComponent>(source, SpriteComponent)) {
        sprite.update(1 / 60, source);
        sprite.render(source);
      }
      for (const call of calls) {
        expect(call.priority).toBeLessThan(0);
      }
    });

    test('the layers cross-fade, reaching different opacities', async () => {
      const source = await loadTheSource();
      const fades = componentsOf<FadeDrawableComponent>(source, FadeDrawableComponent);
      const sprites = componentsOf<SpriteComponent>(source, SpriteComponent);

      // A second in, the five layers are at five different points in their
      // cycles - that divergence is the whole effect.
      for (let i = 0; i < 60; i++) {
        for (const fade of fades) fade.update(1 / 60, source);
      }
      calls.length = 0;
      for (const sprite of sprites) sprite.update(1 / 60, source);
      source.render();

      const opacities = calls.map((c) => c.alpha);
      expect(new Set(opacities.map((o) => o.toFixed(3))).size).toBeGreaterThan(3);
      for (const opacity of opacities) {
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      }
    });

    test('a ping-pong fade turns around rather than sticking at its target', async () => {
      const source = await loadTheSource();
      // The core: 0.2 -> 1.0 over 1.2s, ping-pong.
      const core = componentsOf<SpriteComponent>(source, SpriteComponent)[4];
      const coreFade = componentsOf<FadeDrawableComponent>(source, FadeDrawableComponent)[4];

      const samples: number[] = [];
      for (let i = 0; i < 200; i++) {
        coreFade.update(1 / 60, source);
        calls.length = 0;
        core.update(1 / 60, source);
        core.render(source);
        if (calls.length) samples.push(calls[0].alpha);
      }

      // Over 3.3s the 1.2s cycle both rises and falls.
      const rose = samples.some((v, i) => i > 0 && v > samples[i - 1]);
      const fell = samples.some((v, i) => i > 0 && v < samples[i - 1]);
      expect(rose).toBe(true);
      expect(fell).toBe(true);
    });
  });

  describe('motion blur', () => {
    test('Kyle trails a fading copy of himself', async () => {
      const kyle = await loadLevelWith((o) => o.subType === 'kyle');
      expect(kyle, 'no level spawns Kyle').not.toBeNull();

      const blur = kyle!.getComponent(
        MotionBlurComponent as unknown as new (...a: unknown[]) => MotionBlurComponent
      );
      expect(blur, 'Kyle has no motion blur').not.toBeNull();

      const sprite = kyle!.getComponent(
        SpriteComponent as unknown as new (...a: unknown[]) => SpriteComponent
      )!;

      // Let the trail fill: four samples at 0.1s apart.
      for (let i = 0; i < 40; i++) {
        sprite.update(1 / 60, kyle!);
        blur!.update(1 / 60, kyle!);
      }

      calls.length = 0;
      blur!.update(1 / 60, kyle!);
      blur!.render(kyle!);

      expect(calls.length).toBe(4);
      // Each step is fainter than the one in front of it, and all are behind
      // the sprite itself.
      const alphas = calls.map((c) => c.alpha);
      for (let i = 1; i < alphas.length; i++) {
        expect(alphas[i]).toBeLessThan(alphas[i - 1]);
      }
      for (const call of calls) {
        expect(call.priority).toBeLessThan(sprite.getCurrentDraw()!.priority);
      }
    });

    test('clearing the history stops the trail, so a respawn does not smear', () => {
      const object = new GameObject();
      object.width = 64;
      object.height = 64;
      const sprite = new SpriteComponent();
      sprite.setRenderSystem(sSystemRegistry.renderSystem!);
      sprite.setSprite('enemy_kyle_stand');
      sprite.addAnimation('idle', {
        frames: [{ x: 0, y: 0, width: 64, height: 64, duration: 1, sprite: 'enemy_kyle_stand' }],
        loop: true,
      });
      sprite.playAnimation('idle');
      object.addComponent(sprite);

      const blur = new MotionBlurComponent();
      blur.setTarget(sprite);
      object.addComponent(blur);

      for (let i = 0; i < 40; i++) blur.update(1 / 60, object);
      blur.clearHistory();

      calls.length = 0;
      blur.update(1 / 60, object);
      blur.render(object);
      expect(calls.length).toBe(0);
    });
  });

  describe('the glow powerup halo', () => {
    /**
     * A player object driven by real systems, the way campaignGameplay.test.ts
     * drives one - PlayerComponent bails out early without them.
     */
    function makePlayer(): { object: GameObject; player: PlayerComponent } {
      const object = new GameObject();
      object.type = 'player';
      object.width = 32;
      object.height = 48;
      object.setPosition(64, 64);

      const sprite = new SpriteComponent();
      sprite.setRenderSystem(sSystemRegistry.renderSystem!);
      object.addComponent(sprite);

      const player = new PlayerComponent();
      const levelSystem = new LevelSystem();
      const collision = new CollisionSystem();
      levelSystem.setSystems(collision, manager, new HotSpotSystem());
      player.setSystems(new InputSystem(), collision, new SoundSystem(), levelSystem);
      object.addComponent(player);
      return { object, player };
    }

    /** Advance one frame and return what was drawn. */
    function step(object: GameObject, frames: number = 1): DrawCall[] {
      let drawn: DrawCall[] = [];
      for (let i = 0; i < frames; i++) {
        calls.length = 0;
        object.update(1 / 60, 1 / 60);
        object.render();
        drawn = [...calls];
      }
      return drawn;
    }

    test('no halo is drawn until the powerup is collected', () => {
      const { object } = makePlayer();
      // The halo is created hidden alongside the animation set.
      const drawn = step(object, 2).map((c) => c.sprite);
      expect(drawn.some((s) => s.startsWith('effect_glow'))).toBe(false);
    });

    test('collecting the powerup layers a halo in front of Andou', () => {
      const { object, player } = makePlayer();
      player.activateGlow(15);

      const drawn = step(object, 2);
      const halo = drawn.find((c) => c.sprite.startsWith('effect_glow'));
      const body = drawn.find((c) => c.sprite.startsWith('andou'));
      expect(halo, 'no glow halo drawn').toBeDefined();
      expect(body, 'no player body drawn').toBeDefined();
      // SortConstants.PLAYER + 1: the halo sits just in front of him.
      expect(halo!.priority).toBeGreaterThan(body!.priority);
    });

    test('the halo disappears again when the powerup runs out', () => {
      const { object, player } = makePlayer();
      player.activateGlow(15);
      expect(step(object, 2).some((c) => c.sprite.startsWith('effect_glow'))).toBe(true);

      player.glowMode = false;
      expect(step(object, 2).some((c) => c.sprite.startsWith('effect_glow'))).toBe(false);
    });

    test('the halo flashes only in the last seconds of the powerup', () => {
      const { object, player } = makePlayer();
      // A short powerup so the flash window is reached quickly.
      player.activateGlow(5);

      const haloAlpha = (drawn: DrawCall[]): number => {
        const halo = drawn.find((c) => c.sprite.startsWith('effect_glow'));
        return halo ? halo.alpha : 1;
      };

      // Half a second in: steady.
      expect(haloAlpha(step(object, 30))).toBe(1);

      // Past the flash lead time (duration - 4s), it starts pulsing.
      const alphas: number[] = [];
      for (let i = 0; i < 120; i++) alphas.push(haloAlpha(step(object)));
      expect(new Set(alphas.map((a) => a.toFixed(2))).size).toBeGreaterThan(1);
    });
  });

  describe('fade behaviour', () => {
    function spriteObject(): { object: GameObject; sprite: SpriteComponent } {
      const object = new GameObject();
      const sprite = new SpriteComponent();
      sprite.setRenderSystem(sSystemRegistry.renderSystem!);
      sprite.setSprite('effect_glow01');
      sprite.addAnimation('glow', {
        frames: [{ x: 0, y: 0, width: 64, height: 64, duration: 1, sprite: 'effect_glow01' }],
        loop: true,
      });
      sprite.playAnimation('glow');
      object.addComponent(sprite);
      return { object, sprite };
    }

    test('an initial delay holds the sprite steady before the fade starts', () => {
      const { object, sprite } = spriteObject();
      const fade = new FadeDrawableComponent();
      fade.setSpriteComponent(sprite);
      fade.setupFade({
        startOpacity: 1, endOpacity: 0, duration: 0.15,
        loopType: 1, fadeFunction: 1, initialDelay: 1.0,
      });

      for (let i = 0; i < 30; i++) fade.update(1 / 60, object);  // 0.5s in
      calls.length = 0;
      sprite.update(1 / 60, object);
      sprite.render(object);
      expect(calls[0].alpha).toBe(1);
    });

    test('resetPhase restarts the delay, so extending a powerup stops the flash', () => {
      const { object, sprite } = spriteObject();
      const fade = new FadeDrawableComponent();
      fade.setSpriteComponent(sprite);
      fade.setupFade({
        startOpacity: 1, endOpacity: 0, duration: 0.15,
        loopType: 1, fadeFunction: 1, initialDelay: 0.5, phaseDuration: 5,
      });

      // Run past the delay so the flash has started.
      for (let i = 0; i < 45; i++) fade.update(1 / 60, object);
      fade.resetPhase();

      // Immediately after the reset it is steady again, not mid-flash.
      fade.update(1 / 60, object);
      calls.length = 0;
      sprite.update(1 / 60, object);
      sprite.render(object);
      expect(calls[0].alpha).toBe(1);
    });
  });
});
