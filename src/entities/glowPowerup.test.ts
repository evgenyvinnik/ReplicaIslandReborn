/**
 * The glow powerup: what enough coins buys you.
 *
 * The halo adds an attack without replacing the body's collision volumes.
 * Force immunity blocks ordinary HIT damage, but not cannon/hazard signals.
 */

import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameObject } from './GameObject';
import { GameObjectManager } from './GameObjectManager';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { PlayerComponent, PlayerState } from './components/PlayerComponent';
import { SpriteComponent } from './components/SpriteComponent';
import { createPlayerVolumeSets, createPlayerGlowVolumes } from './playerCollisionVolumes';
import { InputSystem } from '../engine/InputSystem';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { SoundSystem } from '../engine/SoundSystem';
import type { LevelSystem } from '../levels/LevelSystemNew';
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
afterEach(() => sSystemRegistry.reset());

test('the separate halo has the original converted attack sphere and no vulnerability', () => {
  const sets = createPlayerVolumeSets();
  const glow = createPlayerGlowVolumes();
  expect(glow.vulnerability).toBeNull();
  expect(glow.attack).toHaveLength(1);
  expect(sets.normal.vulnerability, 'the normal state must be vulnerable').not.toBeNull();

  const glowHit = glow.attack.find((v) => v.getHitType() === HitType.HIT);
  const stompHit = sets.stomping.attack.find((v) => v.getHitType() === HitType.HIT);
  expect(glowHit, 'glowing needs a HIT volume').toBeTruthy();
  expect(stompHit).toBeTruthy();

  // The original's glow sphere is larger than the stomp box's reach.
  const spread = (v: { getMaxXPosition(f: null): number; getMinXPosition(f: null): number }): number =>
    v.getMaxXPosition(null) - v.getMinXPosition(null);
  expect(spread(glowHit!), 'the glow volume should be the wider of the two')
    .toBeGreaterThan(spread(stompHit!));
  expect(glowHit!.getMinXPosition(null)).toBe(-16);
  expect(glowHit!.getMaxXPosition(null)).toBe(64);
  expect(glowHit!.getMinYPosition(null)).toBe(-32);
  expect(glowHit!.getMaxYPosition(null)).toBe(48);
});

function glowingPlayer(): {
  player: GameObject; control: PlayerComponent; sprite: SpriteComponent;
  playerCollision: DynamicCollisionComponent; playerReaction: HitReactionComponent;
} {
  const player = new GameObject();
  player.type = 'player';
  player.team = Team.PLAYER;
  player.width = 32;
  player.height = 48;
  player.life = 3;
  player.getPosition().set(100, 100);
  const control = new PlayerComponent();
  control.setSystems(new InputSystem(), new CollisionSystem(), new SoundSystem(),
    { getLevelSize: () => ({ width: 4096, height: 4096 }) } as LevelSystem);
  const sprite = new SpriteComponent();
  const playerCollision = new DynamicCollisionComponent();
  const playerReaction = new HitReactionComponent();
  playerCollision.setHitReactionComponent(playerReaction);
  player.addComponent(control);
  player.addComponent(sprite);
  player.addComponent(playerCollision);
  player.addComponent(playerReaction);
  control.activateGlow(15);
  return { player, control, sprite, playerCollision, playerReaction };
}

test('a glowing player kills on contact and takes no damage back, with body vulnerability intact', () => {
  const { player, playerCollision, playerReaction } = glowingPlayer();
  const enemy = new GameObject();
  enemy.type = 'enemy';
  enemy.team = Team.ENEMY;
  enemy.width = 64;
  enemy.height = 64;
  enemy.life = 1;
  enemy.getPosition().set(100, 100);

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
  expect(playerCollision.getVulnerabilityVolumes()).not.toBeNull();
  expect(playerReaction.isInvincible()).toBe(true);
  expect(playerReaction.receivedHit(player, enemy, HitType.HIT)).toBe(false);
});

test.each(['stomp', 'frozen'] as const)('the halo remains an independent attack while the body is %s', (state) => {
  const { player, control, playerCollision } = glowingPlayer();
  control.currentState = state === 'stomp' ? PlayerState.STOMP : PlayerState.FROZEN;
  control.stomping = state === 'stomp';
  control.ghostActive = state === 'frozen';
  player.update(0, 1);
  const colliders = player.getComponents().filter(c => c instanceof DynamicCollisionComponent);
  expect(colliders).toHaveLength(2);
  const halo = colliders.find(c => c !== playerCollision)!;
  expect(halo.getAttackVolumes()).toHaveLength(1);
  expect(halo.getAttackVolumes()![0].getHitType()).toBe(HitType.HIT);
  expect(playerCollision.getVulnerabilityVolumes()).toBeNull();
  if (state === 'stomp') expect(playerCollision.getAttackVolumes()).toHaveLength(3);
  else expect(playerCollision.getAttackVolumes()).toBeNull();
});

test('expiry removes only the halo and force immunity; reactivation does not duplicate components', () => {
  const { player, control, playerCollision, playerReaction } = glowingPlayer();
  player.update(0, 1);
  system.update(0);
  const componentCount = player.getComponents().length;
  control.activateGlow(15);
  player.update(0, 1);
  system.update(0);
  expect(player.getComponents()).toHaveLength(componentCount);
  playerReaction.setInvincible(true);
  control.glowTime = 0.01;
  player.update(0.02, 1.02);
  system.update(0);
  expect(control.glowMode).toBe(false);
  expect(player.getComponents().filter(c => c instanceof DynamicCollisionComponent)).toEqual([playerCollision]);
  expect(playerCollision.getVulnerabilityVolumes()).not.toBeNull();
  expect(playerReaction.isInvincible(), 'post-hit immunity survives glow expiry').toBe(true);
  playerReaction.setInvincible(false);
  expect(playerReaction.isInvincible()).toBe(false);
  control.activateGlow(15);
  player.update(0, 1.02);
  system.update(0);
  expect(player.getComponents()).toHaveLength(componentCount);
  control.beginDeath(player, true);
  expect(player.getComponents().filter(c => c instanceof DynamicCollisionComponent)).toEqual([playerCollision]);
  expect(playerReaction.isInvincible()).toBe(false);
});

test('glow immunity still permits instant-death hazards', () => {
  const { player, playerReaction } = glowingPlayer();
  player.update(0, 1);
  const hazard = new GameObject();
  hazard.setPosition(100, 100); hazard.width = 32; hazard.height = 48;
  const collision = new DynamicCollisionComponent();
  const volumes = createPlayerVolumeSets().normal;
  for (const volume of volumes.attack) volume.setHitType(HitType.DEATH);
  collision.setCollisionVolumes(volumes.attack, null);
  hazard.addComponent(collision);
  hazard.update(0, 1);
  expect(playerReaction.isInvincible()).toBe(true);
  system.update(0);
  expect(player.life).toBe(0);
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
