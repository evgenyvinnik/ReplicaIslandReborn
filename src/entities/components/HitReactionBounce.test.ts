import { expect, test } from 'bun:test';
import { GameObject } from '../GameObject';
import { HitReactionComponent, type HitReactionConfig } from './HitReactionComponent';
import { HitType, Team } from '../../types';

function actor(x: number, feet: number, height: number): GameObject {
  const object = new GameObject();
  object.width = 32;
  object.height = height;
  object.life = 3;
  object.setPosition(x, feet - height);
  object.setVelocity(7, 9);
  object.setTargetVelocity(11, 13);
  return object;
}

test('knockback matches Android base-position signs for every direction and attacker height', () => {
  for (const height of [16, 48, 64, 128]) {
    for (const x of [-20, 0, 20]) for (const feet of [-20, 0, 20]) {
      const player = actor(100 + x, 500 + feet, 48);
      const attacker = actor(100, 500, height);
      const reaction = new HitReactionComponent({ bounceOnHit: true });
      expect(reaction.receivedHit(player, attacker, HitType.HIT)).toBe(true);
      // Android Utils.sign(0) is +1. Inverting Y maps its equal-base
      // upward kick to negative Canvas velocity, not zero or downward.
      expect(player.getVelocity().x).toBe(x >= 0 ? 100 : -100);
      expect(player.getVelocity().y).toBe(feet <= 0 ? -100 : 100);
      expect(player.getTargetVelocity().x).toBe(0);
      expect(player.getTargetVelocity().y).toBe(0);
      expect(player.life).toBe(2);
    }
  }
});

test('custom knockback magnitude is retained for aligned actors', () => {
  const player = actor(100, 500, 48);
  const attacker = actor(100, 500, 64);
  const reaction = new HitReactionComponent({ bounceOnHit: true, bounceMagnitude: 350 });
  reaction.receivedHit(player, attacker, HitType.HIT);
  expect(player.getVelocity().x).toBe(175);
  expect(player.getVelocity().y).toBe(-175);
});

test('disabled, lethal and rejected hits do not apply knockback', () => {
  const cases: Array<{ config: HitReactionConfig; life: number; friendly?: boolean; accepted: boolean }> = [
    { config: { bounceOnHit: false }, life: 3, accepted: true },
    { config: { bounceOnHit: true }, life: 1, accepted: true },
    { config: { bounceOnHit: true, forceInvincibility: true }, life: 3, accepted: false },
    { config: { bounceOnHit: true }, life: 3, friendly: true, accepted: false },
  ];
  for (const entry of cases) {
    const player = actor(100, 500, 48);
    const attacker = actor(100, 500, 64);
    player.life = entry.life;
    if (entry.friendly) player.team = attacker.team = Team.PLAYER;
    const reaction = new HitReactionComponent(entry.config);
    expect(reaction.receivedHit(player, attacker, HitType.HIT)).toBe(entry.accepted);
    expect(player.getVelocity().x).toBe(7);
    expect(player.getVelocity().y).toBe(9);
    expect(player.getTargetVelocity().x).toBe(11);
    expect(player.getTargetVelocity().y).toBe(13);
    expect(player.life).toBe(entry.life - (entry.accepted ? 1 : 0));
  }
});

test('post-hit invincibility prevents repeated contact from resetting knockback', () => {
  const player = actor(100, 500, 48);
  const attacker = actor(100, 500, 64);
  const reaction = new HitReactionComponent({ bounceOnHit: true, invincibleAfterHitTime: 3 });
  expect(reaction.receivedHit(player, attacker, HitType.HIT)).toBe(true);
  player.setVelocity(20, -30);
  expect(reaction.receivedHit(player, attacker, HitType.HIT)).toBe(false);
  expect(player.life).toBe(2);
  expect(player.getVelocity().x).toBe(20);
  expect(player.getVelocity().y).toBe(-30);
});
