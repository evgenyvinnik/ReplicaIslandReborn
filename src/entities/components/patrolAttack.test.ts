/**
 * Does a patrolling enemy actually decide to attack?
 *
 * `PatrolComponent.updateAttack()` gates the swing on a squared distance
 * between the enemy and the player. The original measures that distance from
 * each object's *position*, which in its Y-up space is the object's **bottom**;
 * X is taken from the centre, Y is not. Read the same field in Y-down canvas
 * space and you are measuring from each object's **top** instead, which adds a
 * constant `enemyHeight - playerHeight` to every vertical delta.
 *
 * That error is invisible for equal-height enemies and fatal for tall ones: a
 * 128px mudman beside a 48px player picks up 80px of phantom vertical
 * separation against an attack range of 70, so `dx^2 + 6400 < 4900` can never
 * hold and the mudman never swings at all. Nothing else notices - it patrols,
 * animates and collides normally - which is why this needs a test that asks
 * the one question that exposes it: standing next to the player, does it
 * attack?
 */

import { beforeEach, expect, test } from 'bun:test';
import { PatrolComponent } from './PatrolComponent';
import { GameObject } from '../GameObject';
import { GameObjectManager } from '../GameObjectManager';
import { CameraSystem } from '../../engine/CameraSystem';
import { TimeSystem } from '../../engine/TimeSystem';
import { HotSpotSystem } from '../../engine/HotSpotSystem';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { ActionType } from '../../types';

const FRAME = 1 / 60;
const FLOOR_Y = 500; // y of the ground line both characters stand on

/** Build an object whose feet rest on FLOOR_Y, as a spawned character's do. */
function standing(width: number, height: number, x: number): GameObject {
  const o = new GameObject();
  o.width = width;
  o.height = height;
  o.setPosition(x, FLOOR_Y - height);
  o.life = 1;
  o.facingDirection.set(1, 1);
  return o;
}

let manager: GameObjectManager;
let camera: CameraSystem;
let time: TimeSystem;

beforeEach(() => {
  sSystemRegistry.reset();
  manager = new GameObjectManager();
  camera = new CameraSystem(480, 320);
  time = new TimeSystem();
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(time, 'time');
  sSystemRegistry.register(new HotSpotSystem(), 'hotSpot');
});

/**
 * Run an enemy's patrol against a player placed `gap` pixels away
 * horizontally, both on the same floor, and report whether it ever attacked.
 */
function attacksAt(
  enemy: { width: number; height: number },
  patrol: PatrolComponent,
  gap: number
): boolean {
  const e = standing(enemy.width, enemy.height, 1000);
  const player = standing(32, 48, 1000 + gap);
  manager.setPlayer(player);
  e.addComponent(patrol);

  // Centre the camera on the pair so updateAttack's visibility test passes.
  camera.setPosition(
    e.getCenteredPositionX() - 240,
    e.getCenteredPositionY() - 160
  );

  for (let i = 0; i < 120; i++) {
    time.update(FRAME);
    const gt = time.getGameTime();
    // Stand the enemy on the ground: patrol only thinks while touching it.
    e.setGameTime(gt);
    e.setLastTouchedFloorTime(gt);
    e.update(FRAME, gt);
    if (e.getCurrentAction() === ActionType.ATTACK) return true;
  }
  return false;
}

function mudmanPatrol(): PatrolComponent {
  // Transcribed from spawnEnemyMudman: setMovementSpeed(20, 400),
  // setupAttack(70, attackLength, 0, true).
  return new PatrolComponent({
    maxSpeed: 20,
    acceleration: 400,
    flying: false,
    turnToFacePlayer: false,
    attack: { enabled: true, atDistance: 70, duration: 0.5, delay: 0, stopsMovement: true },
  });
}

test('a mudman swings at a player standing next to it', () => {
  // Well inside its 70px reach.
  expect(attacksAt({ width: 128, height: 128 }, mudmanPatrol(), 40)).toBe(true);
});

test('a mudman does not swing at a player beyond its reach', () => {
  expect(attacksAt({ width: 128, height: 128 }, mudmanPatrol(), 400)).toBe(false);
});

test('a skeleton swings at a player just inside its 75px reach', () => {
  // spawnEnemySkeleton: setupAttack(75, ...). 64px tall, so the same
  // top-vs-bottom error costs it 16px of reach rather than all of it.
  const patrol = new PatrolComponent({
    maxSpeed: 50,
    acceleration: 1000,
    flying: false,
    turnToFacePlayer: true,
    attack: { enabled: true, atDistance: 75, duration: 0.5, delay: 0, stopsMovement: true },
  });
  expect(attacksAt({ width: 64, height: 64 }, patrol, 70)).toBe(true);
});

test('reach is measured from the feet, so height does not shrink it', () => {
  // The regression guard proper: two enemies with identical attack ranges but
  // different heights must reach equally far, because the original measures
  // both from the ground they share.
  const reach = (height: number): boolean =>
    attacksAt(
      { width: 64, height },
      new PatrolComponent({
        maxSpeed: 20,
        acceleration: 400,
        flying: false,
        attack: { enabled: true, atDistance: 70, duration: 0.5, delay: 0, stopsMovement: true },
      }),
      60
    );
  expect(reach(48)).toBe(true);
  expect(reach(128)).toBe(true);
});
