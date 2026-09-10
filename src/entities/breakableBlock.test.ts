import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { GameObject } from './GameObject';
import { GameObjectManager } from './GameObjectManager';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { resolveBreakableBlockDeath } from './breakableBlock';
import { PlayerComponent } from './components/PlayerComponent';
import { SpriteComponent } from './components/SpriteComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { SolidSurfaceComponent, setSolidSurfaceSystemRegistry } from './components/SolidSurfaceComponent';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { InputSystem } from '../engine/InputSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { SortConstants } from '../engine/SortConstants';
import type { SoundSystem } from '../engine/SoundSystem';
import type { RenderSystem } from '../engine/RenderSystem';
import type { LevelSystem } from '../levels/LevelSystemNew';
import { Team } from '../types';

afterEach(() => sSystemRegistry.reset());

function scene(): {
  manager: GameObjectManager; factory: GameObjectFactory; player: GameObject;
  block: GameObject; input: InputSystem; sounds: string[]; draws: string[];
  collision: CollisionSystem; frame: () => void;
} {
  sSystemRegistry.reset();
  const manager = new GameObjectManager(), collision = new CollisionSystem();
  const dynamic = new GameObjectCollisionSystem(), input = new InputSystem();
  const clock = new TimeSystem(); clock.update(1);
  const factory = new GameObjectFactory(manager);
  const sounds: string[] = [], draws: string[] = [];
  const sound = { playSfx: (name: string) => sounds.push(name) } as unknown as SoundSystem;
  sSystemRegistry.register(manager, 'gameObject'); sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(dynamic, 'gameObjectCollision'); sSystemRegistry.register(factory, 'factory');
  sSystemRegistry.register(sound, 'sound');
  sSystemRegistry.register(clock, 'time');
  setSolidSurfaceSystemRegistry(sSystemRegistry);
  factory.setSystemRegistry(sSystemRegistry); factory.setCollisionSystem(collision);
  factory.setRenderSystem({ hasSprite: () => true, drawSprite: (name: string) => draws.push(name) } as unknown as RenderSystem);
  const player = new GameObject();
  player.type = 'player'; player.team = Team.PLAYER; player.activationRadius = -1;
  player.width = 32; player.height = 48; player.setPosition(160, 160);
  const control = new PlayerComponent();
  control.setSystems(input, collision, sound, { getLevelSize: () => ({ width: 4096, height: 4096 }) } as LevelSystem);
  player.addComponent(control); player.addComponent(new SpriteComponent()); player.addComponent(new DynamicCollisionComponent());
  manager.add(player); manager.setPlayer(player);
  const block = factory.spawn(GameObjectType.BREAKABLE_BLOCK, 160, 320)!;
  manager.commitUpdates();
  block.update(0, 1); collision.updateTemporarySurfaces();
  return { manager, factory, player, block, input, sounds, draws, collision, frame(): void {
    clock.update(1 / 60);
    const dt = clock.getFrameDelta();
    manager.update(dt, clock.getGameTime()); dynamic.update(dt);
    manager.forEach(object => resolveBreakableBlockDeath(object));
    collision.updateTemporarySurfaces();
  } };
}

test('a normal landing rests on a block without destroying it or playing break effects', () => {
  const { player, block, sounds, frame } = scene();
  for (let i = 0; i < 90; i++) frame();
  expect(block.life).toBe(1);
  expect(block.isVisible()).toBe(true);
  expect(player.getPosition().y + player.height).toBeCloseTo(320);
  expect(sounds.filter(s => s === 'sound_break_block')).toEqual([]);
});

test('an input-driven stomp from above removes block art and solidity and emits exactly three pieces', () => {
  const { player, block, manager, input, sounds, draws, collision, frame } = scene();
  const id = block.id;
  input.setVirtualButton('attack', true);
  frame(); input.setVirtualButton('attack', false);
  for (let i = 0; i < 90 && !block.isMarkedForRemoval(); i++) frame();
  expect(block.life).toBe(0);
  expect(block.isMarkedForRemoval()).toBe(true);
  expect(block.isVisible()).toBe(false);
  expect(resolveBreakableBlockDeath(block)).toBe(false);
  draws.length = 0; block.render();
  expect(draws).toEqual([]);
  expect(collision.sweepTemporaryBox(160, 250, 32, 48, 0, 100, player)).toBeNull();
  for (let i = 0; i < 15; i++) frame();
  expect(manager.getActiveObjects().some(o => o.id === id)).toBe(false);
  const pieces = manager.getActiveObjects().filter(o => o.subType === 'block_piece');
  expect(pieces).toHaveLength(3);
  expect(sounds.filter(s => s === 'sound_break_block')).toHaveLength(1);
  for (const piece of pieces) {
    expect(piece.width).toBe(16); expect(piece.height).toBe(16);
    expect(piece.getComponent(SpriteComponent)!.getCurrentDraw()?.sprite).toBe('debris_piece');
    expect(piece.getComponent(SpriteComponent)!.getCurrentDraw()?.priority).toBe(SortConstants.GENERAL_OBJECT);
  }
  for (let i = 0; i < 210; i++) frame();
  expect(manager.getActiveObjects().filter(o => o.subType.startsWith('block_piece'))).toHaveLength(0);
});

test('the player can jump off the block and stomp it after first landing normally', () => {
  const { player, block, input, frame } = scene();
  for (let i = 0; i < 90; i++) frame();
  input.setVirtualButton('fly', true);
  // Android retains floor contact for 0.3s; attack before that charges the orb.
  for (let i = 0; i < 20; i++) frame();
  input.setVirtualButton('fly', false);
  expect(player.getPosition().y + player.height).toBeLessThan(320);
  input.setVirtualButton('attack', true); frame(); input.setVirtualButton('attack', false);
  expect(player.getComponent(PlayerComponent)!.stomping).toBe(true);
  for (let i = 0; i < 90 && !block.isMarkedForRemoval(); i++) frame();
  expect(block.isMarkedForRemoval()).toBe(true);
});

test('debris is emitted at the old block centre with original velocity envelope and bounces at 0.3', () => {
  const { block, manager, factory, collision } = scene();
  block.life = 0;
  expect(resolveBreakableBlockDeath(block)).toBe(true);
  manager.commitUpdates();
  const emitter = manager.getActiveObjects().find(o => o.subType === 'block_piece_spawner')!;
  expect(emitter.getPosition().y + emitter.height).toBe(352);
  // Deterministic angle: sin(0)=0, cos(0)=1; Y-up -1000 becomes Canvas +1000.
  const random = Math.random;
  try {
    Math.random = (): number => 0;
    for (let i = 0; i < 3; i++) emitter.update(1 / 60, 1 + i / 60);
  } finally { Math.random = random; }
  manager.commitUpdates();
  const pieces = manager.getActiveObjects().filter(o => o.subType === 'block_piece');
  expect(pieces).toHaveLength(3);
  for (const piece of pieces) {
    expect(piece.getCenteredPositionX()).toBe(176);
    expect(piece.getCenteredPositionY()).toBe(336);
    expect(piece.getVelocity().x).toBe(0); expect(piece.getVelocity().y).toBe(1000);
  }
  const floor = new GameObject(); floor.width = 1024; floor.height = 32; floor.setPosition(0, 400);
  const surface = new SolidSurfaceComponent(); surface.createRectangle(1024, 32); floor.addComponent(surface);
  floor.update(0, 1); collision.updateTemporarySurfaces();
  const piece = factory.spawn(GameObjectType.BLOCK_PIECE, 100, 380)!;
  piece.getVelocity().set(0, 1000);
  piece.update(1 / 120, 2);
  expect(piece.getPosition().y + 14).toBeCloseTo(400);
  expect(piece.getVelocity().y).toBeCloseTo(-(1000 + 400 / 120) * 0.3);
});

test('scripted and collision deaths use one cleanup path, with no living-only inline block branch', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(source).toContain('resolveBreakableBlockDeath(block, systemRegistry)');
  expect(source).toContain('resolveBreakableBlockDeath(obj, systemRegistry)');
  expect(source).not.toContain("obj.type === 'breakable_block' && obj.life > 0");
});
