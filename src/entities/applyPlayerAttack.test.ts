import { describe, expect, test } from 'bun:test';
import { ActionType, Team } from '../types';
import { GameObject } from './GameObject';
import { applyPlayerAttack, canPlayerAttackTarget } from './applyPlayerAttack';
import { RokudouBossComponent } from './components/RokudouBossComponent';

describe('applyPlayerAttack', () => {
  test('rejects player stomps against The Source on the same team', () => {
    const player = new GameObject();
    player.team = Team.PLAYER;
    const source = new GameObject();
    source.subType = 'the_source';
    source.team = Team.PLAYER;

    expect(canPlayerAttackTarget(player, source)).toBe(false);
    source.team = Team.ENEMY;
    expect(canPlayerAttackTarget(player, source)).toBe(true);
  });

  test('removes an ordinary enemy immediately', () => {
    const enemy = new GameObject();
    enemy.type = 'enemy';
    enemy.subType = 'brobot';

    expect(applyPlayerAttack(enemy)).toEqual({ isBoss: false, defeated: true });
    expect(enemy.life).toBe(0);
    expect(enemy.isVisible()).toBe(false);
    expect(enemy.isMarkedForRemoval()).toBe(true);
  });

  test('damages Rokudou without removing the boss before its death sequence', () => {
    const enemy = new GameObject();
    enemy.type = 'enemy';
    enemy.subType = 'rokudou';
    enemy.life = 3;
    enemy.addComponent(new RokudouBossComponent());

    expect(applyPlayerAttack(enemy)).toEqual({ isBoss: true, defeated: false });
    expect(enemy.life).toBe(2);
    expect(enemy.getCurrentAction()).toBe(ActionType.HIT_REACT);
    expect(enemy.isVisible()).toBe(true);
    expect(enemy.isMarkedForRemoval()).toBe(false);
  });

  test('lets Rokudou finish dying and fire its ending event', () => {
    const enemy = new GameObject();
    enemy.type = 'enemy';
    enemy.subType = 'rokudou';
    enemy.life = 1;
    const boss = new RokudouBossComponent();
    let endingEvents = 0;
    boss.setGameEventTrigger(() => {
      endingEvents += 1;
    });
    enemy.addComponent(boss);

    applyPlayerAttack(enemy);
    const initialY = enemy.getPosition().y;
    boss.update(0.1, enemy); // enter the death state
    boss.update(0.1, enemy); // apply the death fall
    expect(enemy.getPosition().y).toBeGreaterThan(initialY);

    enemy.setGameTime(1);
    enemy.setLastTouchedFloorTime(1);
    boss.update(1 / 60, enemy);

    expect(endingEvents).toBe(1);
  });
});
