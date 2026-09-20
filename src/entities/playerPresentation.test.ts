import { afterEach, expect, test } from 'bun:test';
import { selectPlayerAnimation } from '../data/playerAnimations';
import { GameObject } from './GameObject';
import { PlayerComponent, PlayerState } from './components/PlayerComponent';
import { SpriteComponent } from './components/SpriteComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { InputSystem } from '../engine/InputSystem';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { SoundSystem } from '../engine/SoundSystem';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { sSystemRegistry } from '../engine/SystemRegistry';
import type { RenderSystem } from '../engine/RenderSystem';
import type { LevelSystem } from '../levels/LevelSystemNew';
import { HitType, Team } from '../types';

afterEach(() => sSystemRegistry.reset());

// AnimationComponent.java uses strict < / > boundaries; Android's positive Y
// is upward, whereas the web simulation's negative Y is upward.
test.each([
  [true, false, 29.999, 0, 'idle'], [true, false, 30, 0, 'move'],
  [true, false, 200.01, 0, 'move'], [true, false, 300, 0, 'move'],
  [true, false, 300.001, 0, 'move_fast'],
  [false, false, 0.999, 100, 'idle'], [false, false, 1, 100, 'move'],
  [false, false, 101, 100, 'move'], [false, false, 300, 100, 'move'],
  [false, false, 301, 100, 'move_fast'],
  [false, true, 0, -10, 'boost_move'], [false, true, 0, -10.001, 'boost_up'],
  [false, true, 99.999, -100, 'boost_up'], [false, true, 100, -100, 'boost_move'],
  [false, true, 300, -100, 'boost_move'], [false, true, 300.001, -100, 'boost_move_fast'],
] as const)('movement pose: grounded=%s jets=%s vx=%s vy=%s gives %s', (touchingGround, rocketsOn, vx, velocityY, expected) => {
  for (const direction of [-1, 1]) {
    expect(selectPlayerAnimation({ hitReacting: false, dying: false, stomping: false,
      touchingGround, rocketsOn, velocityX: vx * direction, velocityY })).toBe(expected);
  }
});

function scene(): {
  player: GameObject; control: PlayerComponent; sprite: SpriteComponent;
  collision: DynamicCollisionComponent; input: InputSystem; objects: GameObjectCollisionSystem;
  draws: Array<{ name: string; opacity: number }>;
} {
  sSystemRegistry.reset();
  const player = new GameObject();
  player.type = 'player'; player.team = Team.PLAYER;
  player.width = 32; player.height = 48; player.life = 3;
  player.setPosition(200, 200);
  const control = new PlayerComponent(), input = new InputSystem();
  control.setSystems(input, new CollisionSystem(), new SoundSystem(),
    { getLevelSize: () => ({ width: 4096, height: 4096 }) } as LevelSystem);
  const draws: Array<{ name: string; opacity: number }> = [];
  const renderer = { hasSprite: () => true,
    drawSprite: (name: string, _x: number, _y: number, _frame: number, _priority: number, opacity: number) => draws.push({ name, opacity }),
  } as unknown as RenderSystem;
  const sprite = new SpriteComponent(); sprite.setRenderSystem(renderer);
  const collision = new DynamicCollisionComponent(), reaction = new HitReactionComponent();
  collision.setHitReactionComponent(reaction);
  player.addComponent(control); player.addComponent(sprite);
  player.addComponent(collision); player.addComponent(reaction);
  const objects = new GameObjectCollisionSystem();
  sSystemRegistry.gameObjectCollisionSystem = objects;
  return { player, control, sprite, collision, input, objects, draws };
}

test('holding attack pulses the normal ground pose by game time; release restores opacity', () => {
  const { player, control, sprite, input, objects, draws } = scene();
  input.setVirtualButton('stomp', true);
  for (const [now, dt, expectedOpacity] of [[1, 0.01, 1], [1.25, 0.25, 0.75], [1.5, 0.25, 0.5], [1.5, 0, 0.5]]) {
    player.setLastTouchedFloorTime(now);
    player.update(dt, now); objects.update(dt);
    expect(control.ghostActive).toBe(false);
    sprite.render(player);
    expect(draws[draws.length - 1].name).toBe('andou_stand');
    expect(draws[draws.length - 1].opacity).toBeCloseTo(expectedOpacity);
  }
  input.setVirtualButton('stomp', false);
  player.update(0, 1.5); objects.update(0); sprite.render(player);
  expect(draws[draws.length - 1].opacity).toBe(1);
  input.setVirtualButton('stomp', true);
  player.update(0, 1.5); objects.update(0); sprite.render(player);
  expect(draws[draws.length - 1].opacity, 'a fresh press restarts the wave').toBe(1);
});

test.each([HitType.HIT, HitType.DEATH, HitType.LAUNCH])('hit-reaction frames reject signal %s until normal body recovery', hitType => {
  for (const velocityX of [-120, 0, 120]) {
    const { player, control, sprite, collision, objects } = scene();
    control.currentState = PlayerState.HIT_REACT;
    control.hitReactTimer = 0.2;
    player.setVelocity(velocityX, 0);
    player.update(0, 1);
    expect(sprite.getCurrentDraw()?.sprite).toBe('andou_hit');
    expect(player.facingDirection.x).toBe(velocityX === 0 ? 1 : -Math.sign(velocityX));
    expect(collision.getVulnerabilityVolumes()).toBeNull();
    expect(collision.getAttackVolumes()!.map(v => v.getHitType())).toEqual([HitType.COLLECT, HitType.DEPRESS]);
    const hazard = new GameObject(); hazard.team = Team.ENEMY;
    hazard.setPosition(200, 200); hazard.width = 32; hazard.height = 48;
    const attack = new DynamicCollisionComponent();
    attack.setCollisionVolumes([new SphereCollisionVolume(48, 16, 16, hitType)], null);
    hazard.addComponent(attack); hazard.update(0, 1); objects.update(0);
    expect(player.life).toBe(3);
    expect(player.lastReceivedHitType).toBe(HitType.INVALID);
    player.update(0.21, 1.21); objects.update(0.21);
    expect(control.currentState as PlayerState).toBe(PlayerState.MOVE);
    expect(collision.getVulnerabilityVolumes()).toHaveLength(1);
  }
});

test('charging retains the moving pose and its opacity clears when airborne or hit', () => {
  const { player, control, sprite, input, objects, draws } = scene();
  input.setVirtualButton('stomp', true);
  input.setVirtualAxis('horizontal', 1);
  player.setVelocity(120, 0);
  for (const [now, expectedOpacity] of [[1, 1], [1.25, 0.75]]) {
    player.setLastTouchedFloorTime(now);
    player.update(0, now); objects.update(0); sprite.render(player);
    expect(draws[draws.length - 1].name).toBe('andou_diag01');
    expect(draws[draws.length - 1].opacity).toBeCloseTo(expectedOpacity);
  }
  // Original floor contact remains valid for 0.3s after the last touch.
  player.update(0, 1.6); objects.update(0); sprite.render(player);
  expect(control.touchingGround).toBe(false);
  expect(draws[draws.length - 1].opacity).toBe(1);
  control.currentState = PlayerState.HIT_REACT; control.hitReactTimer = 0.2;
  player.setLastTouchedFloorTime(1.6);
  player.update(0, 1.6); objects.update(0); sprite.render(player);
  expect(draws[draws.length - 1]).toEqual({ name: 'andou_hit', opacity: 1 });
});
