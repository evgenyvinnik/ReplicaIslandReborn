import { afterEach, expect, test } from 'bun:test';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { GameObjectManager } from './GameObjectManager';
import { SpriteComponent } from './components/SpriteComponent';
import { SolidSurfaceComponent } from './components/SolidSurfaceComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { ButtonAnimationComponent } from './components/ButtonAnimationComponent';
import { DoorAnimationComponent } from './components/DoorAnimationComponent';
import { ChannelSystem } from '../engine/ChannelSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import type { RenderSystem } from '../engine/RenderSystem';
import { ActionType, HitType, Team } from '../types';

afterEach(() => sSystemRegistry.reset());

test('runtime colour buttons open their matching gates and render the real frames', () => {
  const manager = new GameObjectManager();
  const factory = new GameObjectFactory(manager);
  const time = new TimeSystem();
  sSystemRegistry.register(time, 'time');
  sSystemRegistry.channelSystem = new ChannelSystem();
  const drawn: string[] = [];
  factory.setRenderSystem({
    hasSprite: () => true,
    drawSprite: (key: string) => drawn.push(key),
  } as unknown as RenderSystem);

  for (const [color, buttonType, doorType] of [
    ['red', GameObjectType.BUTTON_RED, GameObjectType.DOOR_RED],
    ['blue', GameObjectType.BUTTON_BLUE, GameObjectType.DOOR_BLUE],
    ['green', GameObjectType.BUTTON_GREEN, GameObjectType.DOOR_GREEN],
  ] as const) {
    const button = factory.spawn(buttonType, 100, 100)!;
    const door = factory.spawn(doorType, 140, 68)!;
    const buttonSprite = button.getComponent(SpriteComponent)!;
    const doorSprite = door.getComponent(SpriteComponent)!;
    const vulnerability = button.getComponent(DynamicCollisionComponent)!.getVulnerabilityVolumes()![0];
    expect([button.type, button.subType, button.team, button.width, button.height])
      .toEqual(['button', color, Team.NONE, 32, 32]);
    expect([vulnerability.getMinYPosition(null), vulnerability.getMaxYPosition(null), vulnerability.getHitType()])
      .toEqual([16, 32, HitType.DEPRESS]);
    expect(button.getComponents().some(component => component instanceof ButtonAnimationComponent)).toBe(true);
    expect(door.getComponents().some(component => component instanceof DoorAnimationComponent)).toBe(true);
    expect(door.getComponents().some(component => component instanceof SolidSurfaceComponent)).toBe(true);
    expect(doorSprite.getCurrentDraw()?.sprite).toBe(`object_door_${color}01`);
    buttonSprite.render(button);
    doorSprite.render(door);
    expect(drawn.slice(-2)).toEqual([`object_button_${color}`, `object_door_${color}01`]);

    // The real animation component stamps the named channel, which the door
    // observes. This failed when the runtime factory made generic shells.
    button.lastReceivedHitType = HitType.DEPRESS;
    button.setCurrentAction(ActionType.HIT_REACT);
    button.update(0, time.getGameTime());
    door.update(0, time.getGameTime());
    expect(buttonSprite.getCurrentDraw()?.sprite).toBe(`object_button_pressed_${color}`);
    expect(door.getComponents().some(component => component instanceof SolidSurfaceComponent)).toBe(false);
    expect(doorSprite.getCurrentDraw()?.sprite).toBe(`object_door_${color}02`);
    buttonSprite.render(button);
    doorSprite.render(door);
    expect(drawn.slice(-2)).toEqual([`object_button_pressed_${color}`, `object_door_${color}02`]);

    time.update(6);
    door.update(0, time.getGameTime());
    expect(door.getComponents().some(component => component instanceof SolidSurfaceComponent)).toBe(true);
    expect(doorSprite.getCurrentDraw()?.sprite).toBe(`object_door_${color}01`);
  }
});

test('runtime nonblocking gates keep their crush animation without a solid wall', () => {
  const manager = new GameObjectManager();
  const factory = new GameObjectFactory(manager);
  sSystemRegistry.channelSystem = new ChannelSystem();
  const cases = [
    GameObjectType.DOOR_RED_NONBLOCKING,
    GameObjectType.DOOR_BLUE_NONBLOCKING,
    GameObjectType.DOOR_GREEN_NONBLOCKING,
  ];
  for (const type of cases) {
    const door = factory.spawn(type, 100, 100)!;
    expect(door.type).toBe('door');
    expect(door.subType.endsWith('_nonblocking')).toBe(true);
    expect(door.getComponents().some(component => component instanceof SolidSurfaceComponent)).toBe(false);
    const sprite = door.getComponent(SpriteComponent)!;
    const closing = sprite.findAnimation(2)!;
    expect(closing.frames[1].attackVolumes?.[0].getHitType()).toBe(HitType.DEATH);
  }
});

test('runtime gate remains intact through off-camera sleep and returns on approach', () => {
  const manager = new GameObjectManager();
  const camera = new CameraSystem(480, 320);
  camera.setPosition(100, 100);
  manager.setCamera(camera);
  const factory = new GameObjectFactory(manager);
  const door = factory.spawn(GameObjectType.DOOR, 100, 100)!;
  const originalId = door.id;
  manager.commitUpdates();
  door.setPosition(4000, 4000);
  manager.update(0, 0);
  manager.commitUpdates();
  expect(manager.getInactiveObjectCount()).toBe(1);
  door.setPosition(100, 100);
  manager.update(0, 0);
  expect(manager.getActiveObjects()).toContain(door);
  expect(door.id).toBe(originalId);
  expect(door.getComponents().some(component => component instanceof SolidSurfaceComponent)).toBe(true);
});

test('level-data runtime object lookup recognizes gate colours and rejects unknown objects', () => {
  const manager = new GameObjectManager();
  const factory = new GameObjectFactory(manager);
  const blue = factory.spawnFromLevelData({ type: 'door_blue', x: 10, y: 20 })!;
  const green = factory.spawnFromLevelData({ type: 'button_green', x: 20, y: 30 })!;
  expect(blue.subType).toBe('blue');
  expect(green.subType).toBe('green');
  expect(factory.spawnFromLevelData({ type: 'unknown', x: 0, y: 0 })).toBeNull();
  expect(manager.getPlayer()).toBeNull();
});
