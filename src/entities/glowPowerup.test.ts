/**
 * The glow powerup: what enough coins buys you.
 *
 * `activateGlow()` is only half of it. The powerup's whole point is that the
 * glowing frames carry a *larger* HIT attack volume and **no** vulnerability
 * volume, so while it lasts Andou kills what he touches and nothing touches
 * him. Those volumes live in the animation catalogue, selected from
 * `glowMode`, so a change to either can quietly turn the powerup into a
 * cosmetic halo.
 */

import { beforeEach, expect, test } from 'bun:test';
import { GameObject } from './GameObject';
import { GameObjectManager } from './GameObjectManager';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { PlayerComponent } from './components/PlayerComponent';
import { createPlayerVolumeSets, selectPlayerVolumeState } from './playerCollisionVolumes';
import { createEnemyCollisionProfile } from './enemyCollisionProfiles';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { TimeSystem } from '../engine/TimeSystem';
import { DifficultySettings } from '../stores/useGameStore';
import { HitType, Team } from '../types';

let system: GameObjectCollisionSystem;
let time: TimeSystem;

beforeEach(() => {
  sSystemRegistry.reset();
  system = new GameObjectCollisionSystem();
  time = new TimeSystem();
  sSystemRegistry.register(system, 'gameObjectCollision');
  sSystemRegistry.register(new GameObjectManager(), 'gameObject');
  sSystemRegistry.register(time, 'time');
});

test('glowing swaps in a bigger attack volume and drops the vulnerable one', () => {
  const sets = createPlayerVolumeSets();

  // No vulnerability at all: this is what makes the powerup invincibility
  // rather than a damage boost.
  expect(sets.glowing.vulnerability, 'glowing must have no vulnerability volume').toBeNull();
  expect(sets.normal.vulnerability, 'the normal state must be vulnerable').not.toBeNull();

  const glowHit = sets.glowing.attack.find((v) => v.getHitType() === HitType.HIT);
  const stompHit = sets.stomping.attack.find((v) => v.getHitType() === HitType.HIT);
  expect(glowHit, 'glowing needs a HIT volume').toBeTruthy();
  expect(stompHit).toBeTruthy();

  // The original's glow sphere is larger than the stomp box's reach.
  const spread = (v: { getMaxXPosition(f: null): number; getMinXPosition(f: null): number }): number =>
    v.getMaxXPosition(null) - v.getMinXPosition(null);
  expect(spread(glowHit!), 'the glow volume should be the wider of the two')
    .toBeGreaterThan(spread(stompHit!));
});

test('a glowing player kills on contact and takes no damage back', () => {
  const player = new GameObject();
  player.type = 'player';
  player.team = Team.PLAYER;
  player.width = 32;
  player.height = 48;
  player.life = 3;
  player.getPosition().set(100, 100);

  const enemy = new GameObject();
  enemy.type = 'enemy';
  enemy.team = Team.ENEMY;
  enemy.width = 64;
  enemy.height = 64;
  enemy.life = 1;
  enemy.getPosition().set(100, 100);

  const sets = createPlayerVolumeSets();
  const state = selectPlayerVolumeState(false, true);
  expect(state).toBe('glowing');

  const playerCollision = new DynamicCollisionComponent();
  playerCollision.setCollisionVolumes(sets[state].attack, sets[state].vulnerability);
  const playerReaction = new HitReactionComponent({});
  playerCollision.setHitReactionComponent(playerReaction);
  player.addComponent(playerCollision);
  player.addComponent(playerReaction);

  // A brobot: hostile on every frame, so it would normally hurt him.
  const profile = createEnemyCollisionProfile('brobot')!;
  const enemyCollision = new DynamicCollisionComponent();
  enemyCollision.setCollisionVolumes(profile.attack, profile.vulnerability);
  const enemyReaction = new HitReactionComponent({});
  enemyCollision.setHitReactionComponent(enemyReaction);
  enemy.addComponent(enemyCollision);
  enemy.addComponent(enemyReaction);

  for (let i = 0; i < 10 && enemy.life > 0; i++) {
    const now = i / 60;
    time.update(1 / 60);
    player.setGameTime(now);
    enemy.setGameTime(now);
    player.update(1 / 60, now);
    enemy.update(1 / 60, now);
    system.update(1 / 60);
  }

  expect(enemy.life, 'a glowing player should kill what it touches').toBe(0);
  expect(player.life, 'a glowing player should take no damage').toBe(3);
});

test('the powerup gets harder and shorter as the difficulty rises', () => {
  // Game.tsx compares coinsForPowerup against the *difficulty's*
  // coinsPerPowerup and passes its glowDuration to activateGlow. The exact
  // numbers are pinned against the Java in data/originalConstants.test.ts;
  // what matters here is the shape, because a hardcoded constant on either
  // side would still satisfy that test while flattening the difficulty curve.
  const order = [DifficultySettings.baby, DifficultySettings.kids, DifficultySettings.adults];
  for (let i = 1; i < order.length; i++) {
    expect(order[i].coinsPerPowerup, 'each difficulty should cost more coins')
      .toBeGreaterThan(order[i - 1].coinsPerPowerup);
    expect(order[i].glowDuration, 'each difficulty should glow for less time')
      .toBeLessThan(order[i - 1].glowDuration);
  }
});

test('activateGlow restarts the halo phase so a second powerup stops the flash', () => {
  // The original calls this out as a hack: extending the powerup has to reset
  // the fader, or the halo keeps flashing "about to expire" through the whole
  // of the second one.
  const component = new PlayerComponent();
  component.activateGlow(15);
  expect(component.glowMode).toBe(true);
  const first = (component as unknown as { glowTime: number }).glowTime;
  expect(first).toBe(15);

  (component as unknown as { glowTime: number }).glowTime = 2;
  component.activateGlow(15);
  expect((component as unknown as { glowTime: number }).glowTime,
    'collecting a second powerup should restore the full duration').toBe(15);
});
