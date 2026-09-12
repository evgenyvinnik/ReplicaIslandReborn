import { describe, expect, test } from 'bun:test';
import { ComponentPhase } from '../types';
import { GameComponent } from './GameComponent';
import { GameObjectManager } from './GameObjectManager';
import { CameraSystem } from '../engine/CameraSystem';

class TrackingComponent extends GameComponent {
  updates = 0;

  constructor() {
    super(ComponentPhase.THINK);
  }

  update(): void {
    this.updates += 1;
  }

  reset(): void {
    this.updates = 0;
  }
}

describe('GameObjectManager level reset', () => {
  test('pooled objects do not retain components from the previous level', () => {
    const manager = new GameObjectManager(1);
    const previousLevelObject = manager.createObject();
    previousLevelObject.addComponent(new TrackingComponent());
    manager.add(previousLevelObject);
    manager.commitUpdates();

    manager.reset();

    expect(previousLevelObject.getComponents()).toHaveLength(0);
  });

  test('reset also releases objects whose additions were still pending', () => {
    const manager = new GameObjectManager(1);
    const pendingObject = manager.createObject();
    pendingObject.addComponent(new TrackingComponent());
    manager.add(pendingObject);

    manager.reset();

    expect(pendingObject.getComponents()).toHaveLength(0);
  });
});

describe('terminal removal is not camera deactivation', () => {
  test('a marked persistent object is released once and cannot reactivate', () => {
    const manager = new GameObjectManager();
    const camera = new CameraSystem(480, 320);
    manager.setCamera(camera);
    const object = manager.createObject();
    object.activationRadius = -1;
    object.destroyOnDeactivation = false;
    const tracker = new TrackingComponent();
    object.addComponent(tracker);
    manager.add(object);
    manager.update(0, 1);
    expect(tracker.updates).toBe(1);
    let releases = 0;
    manager.setComponentReleaseHandler(() => { releases++; });
    object.markForRemoval();
    object.setVisible(false);
    manager.remove(object);
    manager.remove(object);
    manager.commitUpdates();
    for (let frame = 0; frame < 10; frame++) manager.update(1 / 60, 2 + frame / 60);
    expect(tracker.updates).toBe(1);
    expect(releases).toBe(1);
    expect(manager.getActiveObjects()).toHaveLength(0);
    expect(object.getComponents()).toHaveLength(0);
    manager.reset();
    expect(releases).toBe(1);
  });

  test('a marked object is removed while inactive, but a living off-screen object returns', () => {
    const manager = new GameObjectManager();
    const camera = new CameraSystem(480, 320);
    manager.setCamera(camera);
    const dead = manager.createObject();
    const living = manager.createObject();
    for (const object of [dead, living]) {
      object.activationRadius = 100;
      object.setPosition(2000, 2000);
      object.addComponent(new TrackingComponent());
      manager.add(object);
    }
    manager.update(0, 1);
    expect(manager.getActiveObjects()).toHaveLength(0);
    dead.markForRemoval();
    manager.commitUpdates();
    expect(dead.getComponents()).toHaveLength(0);
    camera.setPosition(2000, 2000);
    manager.update(0, 2);
    expect(manager.getActiveObjects()).toEqual([living]);
  });
});
