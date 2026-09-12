import { beforeEach, expect, test } from 'bun:test';
import { GameObject } from '../GameObject';
import { GameObjectManager } from '../GameObjectManager';
import { TimeSystem } from '../../engine/TimeSystem';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { ActionType } from '../../types';
import { PopOutComponent } from './PopOutComponent';

let manager: GameObjectManager;
let time: TimeSystem;

beforeEach(() => {
  sSystemRegistry.reset();
  manager = new GameObjectManager();
  time = new TimeSystem();
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(time, 'time');
});

function encounter(footDelta: number, xDelta = 0, config = {
  appearDistance: 2000, hideDistance: 4000, attackDistance: 200,
  attackDelay: 2, attackLength: 23 / 24,
}): { slime: GameObject; player: GameObject; tick: (delta?: number) => void } {
  // Shipped shadow-slime and player dimensions. Android compares positions
  // at the sprite bases, not the differing Y-down sprite tops.
  const slime = new GameObject();
  slime.width = slime.height = 64;
  slime.setPosition(1000, 500 - slime.height);
  const player = new GameObject();
  player.width = 32;
  player.height = 48;
  player.setPosition(1000 + xDelta, 500 + footDelta - player.height);
  manager.setPlayer(player);
  const control = new PopOutComponent(config);
  const tick = (delta = 1 / 60): void => {
    time.update(delta);
    control.update(delta, slime);
  };
  return { slime, player, tick };
}

for (const direction of [-1, 1]) {
  test(`shadow slime attacks inside its base-to-base range (${direction})`, () => {
    const { slime, tick } = encounter(direction * 199);
    tick(); // Hidden -> visible, with the original one-frame action lag.
    tick(2.01); // Visible -> attacking after the two-second cooldown.
    tick();
    expect(slime.getCurrentAction()).toBe(ActionType.ATTACK);
  });

  test(`shadow slime does not attack outside its base-to-base range (${direction})`, () => {
    const { slime, tick } = encounter(direction * 201);
    for (let i = 0; i < 240; i++) {
      tick();
      expect(slime.getCurrentAction()).not.toBe(ActionType.ATTACK);
    }
  });
}

test('pop-out appearance and hiding use the same converted base anchor', () => {
  const { slime, player, tick } = encounter(119, 0, {
    appearDistance: 120, hideDistance: 190, attackDistance: 0,
    attackDelay: 0, attackLength: 0,
  });
  tick();
  tick();
  expect(slime.getCurrentAction()).toBe(ActionType.IDLE);
  player.setPosition(1000, 500 + 189 - player.height);
  tick();
  tick();
  expect(slime.getCurrentAction()).toBe(ActionType.IDLE);
  player.setPosition(1000, 500 + 191 - player.height);
  tick();
  tick();
  expect(slime.getCurrentAction()).toBe(ActionType.HIDE);
});

test('shadow slime keeps horizontal distance and its original attack cycle', () => {
  const { slime, player, tick } = encounter(0, 201);
  tick();
  tick(2.01);
  tick();
  expect(slime.getCurrentAction()).toBe(ActionType.IDLE);
  player.setPosition(1199, 500 - player.height);
  tick();
  tick();
  expect(slime.getCurrentAction()).toBe(ActionType.ATTACK);
  tick(23 / 24);
  tick();
  expect(slime.getCurrentAction()).toBe(ActionType.IDLE);
  tick(1.9);
  expect(slime.getCurrentAction()).toBe(ActionType.IDLE);
  tick(0.11);
  tick();
  expect(slime.getCurrentAction()).toBe(ActionType.ATTACK);
});
