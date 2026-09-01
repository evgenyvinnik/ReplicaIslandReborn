import { describe, expect, test } from 'bun:test';
import { ComponentPhase } from '../types';
import { GameComponent } from './GameComponent';
import { GameObjectManager } from './GameObjectManager';

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
