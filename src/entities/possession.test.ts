/**
 * Possession, resolved through the collision pipeline.
 *
 * The original does not special-case which objects can be taken over. The ghost
 * carries a POSSESS attack volume, and any object whose vulnerability volume
 * accepts POSSESS can be possessed - brobots leave theirs untyped so it accepts
 * every hit type, while turrets and brobot spawners type theirs POSSESS. The
 * takeover itself is a component swap: `hitReact.setPossessionComponent(swap)`
 * runs a ChangeComponentsComponent that pulls the AI out and puts a
 * GhostComponent in.
 *
 * Game.tsx used to do all of this with an AABB overlap and hand-rolled
 * component surgery against a hardcoded list of subTypes.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObject } from './GameObject';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { ChangeComponentsComponent } from './components/ChangeComponentsComponent';
import { GhostComponent } from './components/GhostComponent';
import { PatrolComponent } from './components/PatrolComponent';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { HitType, Team, ActionType } from '../types';

describe('possession', () => {
  let system: GameObjectCollisionSystem;

  beforeEach(() => {
    sSystemRegistry.reset();
    system = new GameObjectCollisionSystem();
    sSystemRegistry.register(system, 'gameObjectCollision');
  });

  /** The player's ghost, carrying the original's POSSESS attack volume. */
  function makeGhost(x = 100, y = 100): GameObject {
    const ghost = new GameObject();
    ghost.type = 'ghost';
    ghost.team = Team.PLAYER;
    ghost.width = 64;
    ghost.height = 64;
    ghost.life = 1;
    ghost.getPosition().set(x, y);

    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(
      [new SphereCollisionVolume(32, 32, 32, HitType.POSSESS)],
      null
    );
    ghost.addComponent(collision);
    return ghost;
  }

  /** A target wired the way LevelSystem.attachPossession wires it. */
  function makeTarget(vulnerableTo: HitType, withPatrol = true): GameObject {
    const target = new GameObject();
    target.type = 'enemy';
    target.team = Team.ENEMY;
    target.width = 64;
    target.height = 64;
    target.life = 1;
    target.getPosition().set(100, 100);

    const reaction = new HitReactionComponent();
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(null, [new SphereCollisionVolume(32, 32, 32, vulnerableTo)]);
    collision.setHitReactionComponent(reaction);

    const swap = new ChangeComponentsComponent();
    swap.setPingPongBehavior(true);
    swap.addSwapInComponent(new GhostComponent({ targetAction: ActionType.MOVE }));
    if (withPatrol) {
      const patrol = new PatrolComponent();
      target.addComponent(patrol);
      swap.addSwapOutComponent(patrol);
    }
    reaction.setPossessionComponent(swap);

    target.addComponent(collision);
    target.addComponent(reaction);
    target.addComponent(swap);
    return target;
  }

  function runFrame(objects: GameObject[], time = 1): void {
    for (const object of objects) {
      object.setGameTime(time);
      object.update(1 / 60, time);
    }
    system.update(1 / 60);
  }

  function ghostComponentOf(object: GameObject): GhostComponent | null {
    return object.getComponent(
      GhostComponent as unknown as new (...args: unknown[]) => GhostComponent
    ) as GhostComponent | null;
  }

  function patrolOf(object: GameObject): PatrolComponent | null {
    return object.getComponent(
      PatrolComponent as unknown as new (...args: unknown[]) => PatrolComponent
    ) as PatrolComponent | null;
  }

  test('a POSSESS-typed target is taken over', () => {
    // Turrets and brobot spawners type their volume POSSESS.
    const ghost = makeGhost();
    const turret = makeTarget(HitType.POSSESS);

    expect(ghostComponentOf(turret)).toBeNull();
    runFrame([ghost, turret]);

    expect(ghostComponentOf(turret)).not.toBeNull();
    expect(turret.lastReceivedHitType).toBe(HitType.POSSESS);
  });

  test('an untyped target is taken over too', () => {
    // A brobot's vulnerability volume is untyped, so it accepts POSSESS as well
    // as HIT - which is why it can be both stomped and possessed.
    const ghost = makeGhost();
    const brobot = makeTarget(HitType.INVALID);

    runFrame([ghost, brobot]);

    expect(ghostComponentOf(brobot)).not.toBeNull();
  });

  test('a HIT-only target cannot be possessed', () => {
    // The snailbomb types its volume HIT, so a POSSESS hit does not match.
    const ghost = makeGhost();
    const snailbomb = makeTarget(HitType.HIT);

    runFrame([ghost, snailbomb]);

    expect(ghostComponentOf(snailbomb)).toBeNull();
  });

  test('a distant target is left alone', () => {
    const ghost = makeGhost(1000, 100);
    const brobot = makeTarget(HitType.INVALID);

    runFrame([ghost, brobot]);

    expect(ghostComponentOf(brobot)).toBeNull();
  });

  test('possession stops the AI and releasing brings it back', () => {
    const ghost = makeGhost();
    const brobot = makeTarget(HitType.INVALID);
    expect(patrolOf(brobot)).not.toBeNull();

    runFrame([ghost, brobot]);
    // Driving it means its patrol must stop.
    expect(patrolOf(brobot)).toBeNull();
    expect(ghostComponentOf(brobot)).not.toBeNull();

    // Release reverses the swap, the way Game.tsx does it.
    const swap = brobot.getComponent(
      ChangeComponentsComponent as unknown as new (...args: unknown[]) => ChangeComponentsComponent
    ) as ChangeComponentsComponent;
    brobot.removeComponent(ghostComponentOf(brobot)!);
    expect(swap.getCurrentlySwapped()).toBe(true);
    swap.activate(brobot);

    expect(patrolOf(brobot)).not.toBeNull();
  });
});
