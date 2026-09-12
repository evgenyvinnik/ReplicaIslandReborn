import { beforeEach, expect, test } from 'bun:test';
import { GameObject } from '../GameObject';
import { GameObjectManager } from '../GameObjectManager';
import { TimeSystem } from '../../engine/TimeSystem';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { ActionType } from '../../types';
import { AttackAtDistanceComponent } from './AttackAtDistanceComponent';

let manager: GameObjectManager;
let time: TimeSystem;

beforeEach(() => {
  sSystemRegistry.reset();
  manager = new GameObjectManager();
  time = new TimeSystem();
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(time, 'time');
  time.update(2);
});

function actionAt(x: number, feetY: number, facing = 1): ActionType {
  const turret = new GameObject();
  turret.width = turret.height = 64;
  turret.setPosition(1000, 500 - turret.height);
  turret.facingDirection.x = facing;
  const player = new GameObject();
  player.width = 32;
  player.height = 48;
  player.setPosition(1000 + x, 500 + feetY - player.height);
  manager.setPlayer(player);
  // Original spawnObjectTurret configuration.
  const control = new AttackAtDistanceComponent({
    attackDistance: 300, attackDelay: 0, attackLength: 1, requireFacing: true,
  });
  control.update(1 / 60, turret);
  return turret.getCurrentAction();
}

for (const direction of [-1, 1]) {
  test(`turret attack range uses both actor bases (${direction})`, () => {
    expect(actionAt(1, direction * 299)).toBe(ActionType.ATTACK);
    expect(actionAt(1, direction * 301)).toBe(ActionType.IDLE);
  });
}

test('turret radius is circular and its boundary remains exclusive', () => {
  expect(actionAt(299, 0)).toBe(ActionType.ATTACK);
  expect(actionAt(300, 0)).toBe(ActionType.IDLE);
  expect(actionAt(0, 300)).toBe(ActionType.IDLE);
  expect(actionAt(240, 180)).toBe(ActionType.IDLE);
  expect(actionAt(240, 179)).toBe(ActionType.ATTACK);
});

test('turret facing follows Android sign, including an aligned player', () => {
  expect(actionAt(0, 100, 1)).toBe(ActionType.ATTACK);
  expect(actionAt(0, 100, -1)).toBe(ActionType.IDLE);
  expect(actionAt(-1, 100, -1)).toBe(ActionType.ATTACK);
  expect(actionAt(-1, 100, 1)).toBe(ActionType.IDLE);
  expect(actionAt(1, 100, -1)).toBe(ActionType.IDLE);
});
