import { afterEach, describe, expect, test } from 'bun:test';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { GameObjectManager } from './GameObjectManager';
import { ActionType, Team } from '../types';
import { GhostComponent } from './components/GhostComponent';
import { MovementComponent } from './components/MovementComponent';
import { PatrolComponent } from './components/PatrolComponent';
import { LaunchProjectileComponent } from './components/LaunchProjectileComponent';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { TimeSystem } from '../engine/TimeSystem';

afterEach(() => {
  sSystemRegistry.reset();
});

describe('GameObjectFactory managed spawns', () => {
  test('ghosts use the manager pool and are recyclable after release', () => {
    const manager = new GameObjectManager();
    const factory = new GameObjectFactory(manager);
    const ghost = factory.spawnGhost(10, 20, 0);
    if (!ghost) throw new Error('Expected a ghost to be created');
    manager.commitUpdates();

    const component = ghost.getComponent(
      GhostComponent as unknown as new (...args: unknown[]) => GhostComponent
    );
    const movement = ghost.getComponent(
      MovementComponent as unknown as new (...args: unknown[]) => MovementComponent
    );
    if (!component) throw new Error('Expected the spawned object to control ghost behavior');
    if (!movement) throw new Error('Expected the spawned object to have movement');
    component.transferControl(ghost);
    manager.remove(ghost);
    manager.commitUpdates();

    const recycled = manager.createObject();
    expect(recycled).toBe(ghost);
    expect(recycled.getComponents()).toHaveLength(0);

    const nextGhost = factory.spawnGhost(30, 40, 0);
    if (!nextGhost) throw new Error('Expected another ghost to be created');
    expect(nextGhost.getComponent(
      MovementComponent as unknown as new (...args: unknown[]) => MovementComponent
    )).toBe(movement);
  });

  test('runtime projectiles retain their identity and travel', () => {
    const cases = [
      { type: GameObjectType.CANNON_BALL, subType: 'cannon_ball', size: 32 },
      { type: GameObjectType.ENERGY_BALL, subType: 'energy_ball', size: 32 },
      { type: GameObjectType.WANDA_SHOT, subType: 'wanda_shot', size: 32 },
      { type: GameObjectType.TURRET_BULLET, subType: 'turret_bullet', size: 16 },
    ];

    for (const projectileCase of cases) {
      const manager = new GameObjectManager();
      const factory = new GameObjectFactory(manager);
      const projectile = factory.spawn(projectileCase.type, 10, 20);
      if (!projectile) throw new Error(`Expected ${projectileCase.subType} to spawn`);

      projectile.setVelocity(100, 0);
      manager.update(0.25, 0.25);

      expect(projectile.type).toBe('projectile');
      expect(projectile.subType).toBe(projectileCase.subType);
      expect(projectile.width).toBe(projectileCase.size);
      expect(projectile.height).toBe(projectileCase.size);
      if (projectileCase.type === GameObjectType.WANDA_SHOT) {
        expect(projectile.team).toBe(Team.NONE);
      }
      expect(projectile.getPosition().x).toBe(35);
      expect(projectile.getPosition().y).toBe(20);
    }
  });

  test('snailbomb uses the original patrol and mirrored three-shot launcher', () => {
    const manager = new GameObjectManager();
    const factory = new GameObjectFactory(manager);
    const time = new TimeSystem();
    sSystemRegistry.gameObjectManager = manager;
    sSystemRegistry.gameObjectFactory = factory;
    sSystemRegistry.timeSystem = time;

    const snailbomb = factory.spawn(GameObjectType.ENEMY_SNAILBOMB, 100, 200);
    if (!snailbomb) throw new Error('Expected a snailbomb to spawn');
    manager.commitUpdates();

    expect(snailbomb.getComponent(
      PatrolComponent as unknown as new (...args: unknown[]) => PatrolComponent
    )).not.toBeNull();
    const launcher = snailbomb.getComponent(
      LaunchProjectileComponent as unknown as new (...args: unknown[]) => LaunchProjectileComponent
    );
    if (!launcher) throw new Error('Expected the snailbomb launcher');

    // Attacks happen after the four-second patrol cooldown. The first shot is
    // emitted when the 5/24-second attack animation reaches its end.
    time.update(4.1);
    snailbomb.setCurrentAction(ActionType.ATTACK);
    launcher.update(0, snailbomb);
    time.update(0.2);
    launcher.update(0.2, snailbomb);
    manager.commitUpdates();
    expect(manager.findObjectsByType('projectile')).toHaveLength(0);

    time.update(0.01);
    launcher.update(0.01, snailbomb);
    manager.commitUpdates();
    let shots = manager.findObjectsByType('projectile');
    expect(shots).toHaveLength(1);
    expect(shots[0].getPosition().x).toBe(139);
    expect(shots[0].getPosition().y).toBe(205);
    expect(shots[0].getVelocity().x).toBe(100);

    for (let shot = 1; shot < 3; shot++) {
      time.update(0.25);
      launcher.update(0.25, snailbomb);
      manager.commitUpdates();
    }
    expect(manager.findObjectsByType('projectile')).toHaveLength(3);

    // Leaving ATTACK resets the one-set limiter. A left-facing activation
    // mirrors offset 55 through the 64px parent before centering the shot.
    snailbomb.setCurrentAction(ActionType.MOVE);
    launcher.update(0, snailbomb);
    snailbomb.facingDirection.x = -1;
    snailbomb.setCurrentAction(ActionType.ATTACK);
    launcher.update(0, snailbomb);
    time.update(0.21);
    launcher.update(0.21, snailbomb);
    manager.commitUpdates();
    shots = manager.findObjectsByType('projectile');
    expect(shots).toHaveLength(4);
    expect(shots[3].getPosition().x).toBe(93);
    expect(shots[3].getVelocity().x).toBe(-100);
  });
});
