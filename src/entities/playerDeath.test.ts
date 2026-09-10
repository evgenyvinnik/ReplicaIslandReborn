import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { GameObject } from './GameObject';
import { GameObjectFactory } from './GameObjectFactory';
import { GameObjectManager } from './GameObjectManager';
import { PlayerComponent, PlayerState } from './components/PlayerComponent';
import { SpriteComponent } from './components/SpriteComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { SolidSurfaceComponent, setSolidSurfaceSystemRegistry } from './components/SolidSurfaceComponent';
import { createPlayerAnimations } from '../data/playerAnimations';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { InputSystem } from '../engine/InputSystem';
import { HotSpotType, type HotSpotSystem } from '../engine/HotSpotSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { ActionType, HitType, Team } from '../types';
import type { SoundSystem } from '../engine/SoundSystem';
import type { RenderSystem } from '../engine/RenderSystem';
import type { LevelSystem } from '../levels/LevelSystemNew';

afterEach(() => sSystemRegistry.reset());

function scene(): { player: GameObject; control: PlayerComponent; sprite: SpriteComponent;
  collision: DynamicCollisionComponent; reaction: HitReactionComponent; manager: GameObjectManager; sounds: string[]; draws: string[];
  input: InputSystem; world: CollisionSystem } {
  sSystemRegistry.reset();
  const manager = new GameObjectManager(), factory = new GameObjectFactory(manager);
  const sounds: string[] = [];
  const sound = { playSfx: (name: string) => { sounds.push(name); return 1; }, stopSound: () => {} } as unknown as SoundSystem;
  sSystemRegistry.register(manager, 'gameObject'); sSystemRegistry.register(factory, 'factory');
  sSystemRegistry.register(sound, 'sound');
  const draws: string[] = [];
  const renderer = { hasSprite: () => true, drawSprite: (name: string) => draws.push(name) } as unknown as RenderSystem;
  sSystemRegistry.register(renderer, 'render');
  const player = new GameObject();
  player.type = 'player'; player.team = Team.PLAYER;
  player.width = 32; player.height = 48; player.life = player.maxLife = 3;
  player.setPosition(100, 200); player.activationRadius = -1;
  const control = new PlayerComponent(), sprite = new SpriteComponent();
  sprite.setRenderSystem(renderer);
  const input = new InputSystem(), world = new CollisionSystem();
  sSystemRegistry.register(world, 'collision'); setSolidSurfaceSystemRegistry(sSystemRegistry);
  control.setSystems(input, world, sound,
    { getLevelSize: () => ({ width: 4096, height: 4096 }) } as LevelSystem);
  const collision = new DynamicCollisionComponent();
  const reaction = new HitReactionComponent(); collision.setHitReactionComponent(reaction);
  player.addComponent(control); player.addComponent(sprite); player.addComponent(collision);
  player.addComponent(reaction);
  manager.add(player); manager.setPlayer(player); manager.update(0, 1);
  player.setLastTouchedFloorTime(1);
  return { player, control, sprite, collision, reaction, manager, sounds, draws, input, world };
}

test('all ordinary death frames clear attacks and vulnerability, including the glow set', () => {
  for (const glowing of [false, true]) {
    const frames = createPlayerAnimations(glowing).get('dead')!.frames;
    expect(frames).toHaveLength(16);
    for (const frame of frames) {
      expect(frame.attackVolumes).toBeNull(); expect(frame.vulnerabilityVolumes).toBeNull();
    }
  }
});

test('ordinary death plays only Andou animation and one death sound, cancelling stale stomp and flicker', () => {
  const { player, control, sprite, collision, manager, sounds } = scene();
  control.currentState = PlayerState.HIT_REACT;
  manager.update(0.01, 1.01);
  control.stomping = true;
  expect(control.beginDeath(player)).toBe(true);
  expect(control.beginDeath(player)).toBe(false);
  expect(sprite.getCurrentDraw()?.sprite).toBe('andou_die01');
  expect(control.isFlickerHidden()).toBe(false);
  sprite.update(0, player); // PRE_DRAW publishes the newly selected frame's volumes.
  expect(collision.getAttackVolumes()).toBeNull();
  expect(collision.getVulnerabilityVolumes()).toBeNull();
  expect(manager.getActiveObjects().filter(o => o.type === 'effect')).toHaveLength(0);
  expect(sounds).toEqual(['sound_explode']);
  expect(control.stomping).toBe(false);
  manager.update(4 / 24, 1.01 + 4 / 24);
  expect(sprite.getCurrentDraw()?.sprite).toBe('andou_explode01');
  manager.update(1, 3);
  expect(sprite.getCurrentDraw()?.sprite).toBe('andou_explode12');
  expect<PlayerState>(control.currentState).toBe(PlayerState.DEAD);
  expect(sounds).toEqual(['sound_explode']);
});

for (const cause of ['death tile', 'DEATH collision'] as const) {
  test(`${cause} hides Andou and emits exactly one real giant blast aligned to his original body`, () => {
    const { player, control, sprite, collision, reaction, manager, sounds, draws } = scene();
    control.activateGlow(15);
    manager.update(0, 1);
    player.render(); expect(draws.some(name => name.startsWith('effect_glow'))).toBe(true);
    draws.length = 0;
    if (cause === 'DEATH collision') {
      const attacker = new GameObject(); attacker.team = Team.ENEMY;
      reaction.receivedHit(player, attacker, HitType.DEATH);
      expect(player.life).toBe(0);
    }
    expect(control.beginDeath(player, cause === 'death tile')).toBe(true);
    expect(control.beginDeath(player, true)).toBe(false);
    expect(control.glowMode).toBe(false);
    player.render(); expect(draws).toEqual([]);
    manager.commitUpdates();
    const blasts = manager.getActiveObjects().filter(o => o.subType === 'explosion_giant');
    expect(blasts).toHaveLength(1);
    expect(blasts[0].getPosition()).toMatchObject({ x: 84, y: 184 });
    expect(sprite.getCurrentDraw()).toBeNull();
    sprite.update(0, player);
    expect(collision.getAttackVolumes()).toBeNull();
    expect(collision.getVulnerabilityVolumes()).toBeNull();
    manager.update(1 / 60, 1 + 1 / 60);
    expect(sounds).toEqual(['sound_explode', 'quick_explosion']);
    expect(sprite.getCurrentDraw()).toBeNull();
    manager.update(1, 3); manager.commitUpdates();
    expect(manager.getActiveObjects().filter(o => o.subType === 'explosion_giant')).toHaveLength(0);
    expect(sprite.getCurrentDraw()).toBeNull();
    control.reset(); player.life = 3; manager.update(0, 3);
    player.setLastTouchedFloorTime(3);
    expect(sprite.getCurrentDraw()).not.toBeNull();
    expect(collision.getVulnerabilityVolumes()).not.toBeNull();
    expect(control.beginDeath(player)).toBe(true);
    expect(sprite.getCurrentDraw()?.sprite).toBe('andou_die01');
  });
}

test('both Game death entry points use the shared path without a second visual explosion', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(source).toContain('playerComponent.beginDeath(player)');
  expect(source).toContain('playerComponent.beginDeath(player, hotSpot === HotSpotType.DIE)');
  expect(source).not.toContain('effectsSystem.spawnExplosion(');
});

test('a fatal ordinary hit on a death tile still selects the hazard presentation', () => {
  const { player, control, sprite, manager } = scene();
  const samples: number[][] = [];
  sSystemRegistry.hotSpotSystem = { getHotSpot: (x: number, y: number) => {
    samples.push([x, y]); return HotSpotType.DIE;
  } } as unknown as HotSpotSystem;
  player.lastReceivedHitType = HitType.HIT;
  control.beginDeath(player);
  manager.commitUpdates();
  expect(samples).toEqual([[116, 238]]);
  expect(sprite.getCurrentDraw()).toBeNull();
  expect(manager.getActiveObjects().filter(o => o.subType === 'explosion_giant')).toHaveLength(1);
});

test('an airborne fatal hit preserves falling motion and the hit pose until real ground contact', () => {
  const { player, control, sprite, reaction, manager, sounds, input, world } = scene();
  const floor = new GameObject(); floor.width = 1024; floor.height = 32; floor.setPosition(0, 320);
  const solid = new SolidSurfaceComponent(); solid.createRectangle(1024, 32); floor.addComponent(solid);
  floor.update(0, 1); world.updateTemporarySurfaces();
  player.setPosition(100, 80); player.setLastTouchedFloorTime(0); player.getVelocity().set(0, 100);
  player.life = 1;
  reaction.receivedHit(player, new GameObject(), HitType.HIT);
  control.beginDeath(player);
  expect(control.deathPresentationStarted).toBe(false);
  expect(player.getVelocity().y).toBe(100);
  expect(sprite.getCurrentDraw()?.sprite).toBe('andou_hit');
  expect(sounds).toEqual([]);
  input.setVirtualButton('fly', true); input.setVirtualButton('attack', true); input.setVirtualAxis('horizontal', 1);
  let time = 1;
  for (let i = 0; i < 120 && !control.deathPresentationStarted; i++) {
    time += 1 / 60; manager.update(1 / 60, time);
    if (!control.deathPresentationStarted) expect(player.getCurrentAction()).not.toBe(ActionType.DEATH);
    expect(control.currentState).toBe(PlayerState.DEAD);
  }
  expect(control.deathPresentationStarted).toBe(true);
  expect(player.getPosition().x).toBe(100);
  expect(player.getPosition().y + player.height).toBeCloseTo(320);
  expect(player.getCurrentAction()).toBe(ActionType.DEATH);
  expect(sprite.getCurrentDraw()?.sprite).toBe('andou_die01');
  expect(sounds).toEqual(['sound_explode']);
});

test('falling below the world starts death without requiring a ground surface', () => {
  const { player, control, sprite } = scene();
  player.setLastTouchedFloorTime(0); player.setPosition(100, 4097);
  control.beginDeath(player);
  expect(control.deathPresentationStarted).toBe(true);
  expect(sprite.getCurrentDraw()?.sprite).toBe('andou_die01');
});
