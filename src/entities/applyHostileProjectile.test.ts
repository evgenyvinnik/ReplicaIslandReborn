import { describe, expect, test } from 'bun:test';
import { Team } from '../types';
import { GameObject } from './GameObject';
import { applyHostileProjectileToSource } from './applyHostileProjectile';
import { HitReactionComponent } from './components/HitReactionComponent';

function createProjectile(): GameObject {
  const projectile = new GameObject();
  projectile.type = 'projectile';
  projectile.team = Team.ENEMY;
  return projectile;
}

describe('The Source projectile routing', () => {
  test('enemy shots damage the friendly boss and respect its hit cooldown', () => {
    const source = new GameObject();
    source.subType = 'the_source';
    source.team = Team.PLAYER;
    source.life = 3;
    const hitReaction = new HitReactionComponent({ invincibleAfterHitTime: 0.6 });
    source.addComponent(hitReaction);

    const first = createProjectile();
    expect(applyHostileProjectileToSource(first, source)).toBe(true);
    expect(source.life).toBe(2);
    expect(first.isMarkedForRemoval()).toBe(true);

    const blocked = createProjectile();
    expect(applyHostileProjectileToSource(blocked, source)).toBe(false);
    expect(source.life).toBe(2);
    expect(blocked.isMarkedForRemoval()).toBe(false);

    hitReaction.update(0.61, source);
    const next = createProjectile();
    expect(applyHostileProjectileToSource(next, source)).toBe(true);
    expect(source.life).toBe(1);
  });
});
