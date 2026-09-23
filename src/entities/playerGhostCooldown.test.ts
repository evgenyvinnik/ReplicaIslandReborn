import { afterEach, expect, test } from 'bun:test';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem } from '../engine/SoundSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { TimeSystem } from '../engine/TimeSystem';
import type { LevelSystem } from '../levels/LevelSystemNew';
import { GameObject } from './GameObject';
import { PlayerComponent, PlayerState } from './components/PlayerComponent';

afterEach(() => sSystemRegistry.reset());

function scene(): {
  player: GameObject;
  controller: PlayerComponent;
  input: InputSystem;
  time: TimeSystem;
  frame: () => void;
} {
  sSystemRegistry.reset();
  const time = new TimeSystem();
  time.update(1);
  sSystemRegistry.register(time, 'time');
  const input = new InputSystem();
  const player = new GameObject();
  player.type = 'player';
  player.width = 32;
  player.height = 48;
  player.setPosition(100, 100);
  const controller = new PlayerComponent();
  controller.setSystems(input, new CollisionSystem(), new SoundSystem(), {
    getLevelSize: () => ({ width: 1024, height: 1024 }),
  } as LevelSystem);
  player.addComponent(controller);
  const frame = (): void => {
    time.update(1 / 60);
    const now = time.getGameTime();
    player.setGameTime(now);
    player.setLastTouchedFloorTime(now);
    controller.update(1 / 60, player);
  };
  frame();
  return { player, controller, input, time, frame };
}

test('a held attack cannot recharge the orb during Android\'s post-release cooldown', () => {
  const { controller, input, frame } = scene();
  controller.ghostActive = true;
  controller.currentState = PlayerState.FROZEN;
  input.setVirtualButton('attack', true);

  controller.deactivateGhost(0);
  expect(Number(controller.currentState)).toBe(PlayerState.POST_GHOST_DELAY);
  for (let i = 0; i < 17; i++) frame();
  expect(Number(controller.currentState)).toBe(PlayerState.MOVE);
  expect(controller.ghostChargeTime).toBe(0);
  expect(controller.ghostActive).toBe(false);

  for (let i = 0; i < 3; i++) frame();
  expect(controller.ghostChargeTime).toBeGreaterThan(0);
});

test('an offscreen return delay is followed by the same reactivation cooldown', () => {
  const { controller, input, frame } = scene();
  controller.ghostActive = true;
  controller.currentState = PlayerState.FROZEN;
  input.setVirtualButton('attack', true);

  controller.deactivateGhost(0.5);
  for (let i = 0; i < 46; i++) frame();
  expect(Number(controller.currentState)).toBe(PlayerState.MOVE);
  expect(controller.ghostChargeTime).toBe(0);
  for (let i = 0; i < 4; i++) frame();
  expect(controller.ghostChargeTime).toBeGreaterThan(0);
});
