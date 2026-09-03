/**
 * Do enemies die on death tiles?
 *
 * `LifetimeComponent.setVulnerableToDeathTiles()` was ported with a setter, a
 * getter and no reader - the flag existed, nothing consulted it - and no spawn
 * attached the component to an enemy at all. The original marks four walking
 * enemies vulnerable (brobot, snailbomb, skeleton, onion), so in the port all
 * four strolled through death pits unharmed. `level_4_9_underground` puts a
 * skeleton beside fifteen DIE tiles, which is where it showed.
 *
 * The sampling point is the interesting half: the original reads the hot spot
 * at `position.y + 10`, and its position is the object's *bottom*. Read the
 * same field in Y-down space and a 128px enemy samples a tile four rows above
 * its feet.
 */

import { beforeEach, expect, test } from 'bun:test';
import { LifetimeComponent } from './LifetimeComponent';
import { GameObject } from '../GameObject';
import { HotSpotSystem, HotSpotType } from '../../engine/HotSpotSystem';
import { sSystemRegistry } from '../../engine/SystemRegistry';

const TILE = 32;
const COLS = 20;
const ROWS = 10;

/** A hot-spot world that is empty except for a row of DIE tiles at `dieRow`. */
function worldWithDieRow(dieRow: number): HotSpotSystem {
  const tiles: number[][] = [];
  for (let x = 0; x < COLS; x++) {
    tiles[x] = [];
    for (let y = 0; y < ROWS; y++) {
      tiles[x][y] = x >= 8 && x <= 12 && y === dieRow ? HotSpotType.DIE : HotSpotType.NONE;
    }
  }
  const hotSpots = new HotSpotSystem();
  hotSpots.setWorld({ width: COLS, height: ROWS, tiles });
  hotSpots.setLevelDimensions(COLS * TILE, ROWS * TILE);
  return hotSpots;
}

beforeEach(() => {
  sSystemRegistry.reset();
});

/** Stand an enemy of the given height with its feet in row `row`. */
function standIn(row: number, height: number): GameObject {
  const o = new GameObject();
  o.width = 64;
  o.height = height;
  // Feet a few pixels inside the row, as a grounded object's are.
  o.setPosition(10 * TILE, (row + 1) * TILE - 4 - height);
  o.life = 1;
  return o;
}

test('an enemy standing on a death tile dies', () => {
  sSystemRegistry.register(worldWithDieRow(6), 'hotSpot');
  const enemy = standIn(6, 64);
  const life = new LifetimeComponent();
  life.setVulnerableToDeathTiles(true);
  enemy.addComponent(life);

  enemy.update(1 / 60, 0.1);
  expect(enemy.life).toBe(0);
});

test('a tall enemy samples the tile under its feet, not its chest', () => {
  // A 128px enemy: reading position.y directly would sample four rows high.
  sSystemRegistry.register(worldWithDieRow(6), 'hotSpot');
  const enemy = standIn(6, 128);
  const life = new LifetimeComponent();
  life.setVulnerableToDeathTiles(true);
  enemy.addComponent(life);

  enemy.update(1 / 60, 0.1);
  expect(enemy.life).toBe(0);
});

test('an enemy on safe ground is untouched', () => {
  sSystemRegistry.register(worldWithDieRow(6), 'hotSpot');
  const enemy = standIn(3, 64);
  const life = new LifetimeComponent();
  life.setVulnerableToDeathTiles(true);
  enemy.addComponent(life);

  enemy.update(1 / 60, 0.1);
  expect(enemy.life).toBe(1);
});

test('an enemy not marked vulnerable ignores the tile', () => {
  // The original only marks four of them; the rest are unaffected.
  sSystemRegistry.register(worldWithDieRow(6), 'hotSpot');
  const enemy = standIn(6, 64);
  enemy.addComponent(new LifetimeComponent());

  enemy.update(1 / 60, 0.1);
  expect(enemy.life).toBe(1);
});

test('a death-tile kill leaves removal to the enemy death owner', () => {
  // Game.tsx's resolveCollisionOutcomes turns life<=0 into the crush flash,
  // stomp sound and score, and skips anything already marked for removal.
  // A lifetime attached purely for death-tile vulnerability must not steal it.
  sSystemRegistry.register(worldWithDieRow(6), 'hotSpot');
  const enemy = standIn(6, 64);
  const life = new LifetimeComponent();
  life.setVulnerableToDeathTiles(true);
  enemy.addComponent(life);

  enemy.update(1 / 60, 0.1);
  expect(enemy.life).toBe(0);
  expect(enemy.isMarkedForRemoval()).toBe(false);
});

test('a projectile lifetime still owns its own removal', () => {
  // The other half of that split: a component given a lifetime trigger must
  // keep destroying its object, or projectiles never expire.
  const shot = new GameObject();
  shot.width = 16;
  shot.height = 16;
  shot.life = 1;
  const life = new LifetimeComponent();
  life.setTimeUntilDeath(0.05);
  shot.addComponent(life);

  for (let i = 0; i < 10; i++) shot.update(1 / 60, i / 60);
  expect(shot.isMarkedForRemoval()).toBe(true);
});
