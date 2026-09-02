import { afterEach, describe, expect, test } from 'bun:test';
import { HotSpotSystem, HotSpotType } from '../../engine/HotSpotSystem';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { ActionType } from '../../types';
import { GameObject } from '../GameObject';
import { NPCComponent } from './NPCComponent';

function makeRoute(): HotSpotSystem {
  const hotSpots = new HotSpotSystem();
  hotSpots.setWorld({
    width: 3,
    height: 1,
    tiles: [
      [HotSpotType.NONE],
      [HotSpotType.ATTACK],
      [HotSpotType.NPC_RUN_QUEUED_COMMANDS],
    ],
  });
  hotSpots.setLevelDimensions(96, 32);
  sSystemRegistry.register(hotSpots, 'hotSpot');
  return hotSpots;
}

function makeNpc(pauseOnAttack: boolean): { object: GameObject; npc: NPCComponent } {
  const object = new GameObject();
  object.width = 32;
  object.height = 32;
  object.setPosition(32, 0); // ATTACK tile
  const npc = new NPCComponent({ pauseOnAttack });
  return { object, npc };
}

afterEach(() => {
  sSystemRegistry.reset();
});

describe('NPCComponent scripted attack timing', () => {
  test('queues a pausing attack until the route runs queued commands', () => {
    makeRoute();
    const { object, npc } = makeNpc(true);

    npc.update(1 / 60, object);
    expect(object.getCurrentAction()).toBe(ActionType.MOVE);

    object.setPosition(64, 0); // NPC_RUN_QUEUED_COMMANDS tile
    npc.update(1 / 60, object);
    expect(object.getCurrentAction()).toBe(ActionType.ATTACK);
    expect(object.getVelocity().x).toBe(0);
  });

  test('executes a non-pausing attack immediately', () => {
    makeRoute();
    const { object, npc } = makeNpc(false);

    npc.update(1 / 60, object);

    expect(object.getCurrentAction()).toBe(ActionType.ATTACK);
  });
});
