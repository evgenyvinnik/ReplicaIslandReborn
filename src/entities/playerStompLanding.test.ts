import { afterEach, expect, spyOn, test } from 'bun:test';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { CameraSystem } from '../engine/CameraSystem';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem } from '../engine/SoundSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { SortConstants } from '../engine/SortConstants';
import type { LevelSystem } from '../levels/LevelSystemNew';
import type { RenderSystem } from '../engine/RenderSystem';
import { GameObject } from './GameObject';
import { GameObjectManager } from './GameObjectManager';
import { GameObjectFactory } from './GameObjectFactory';
import { PlayerComponent, PlayerState } from './components/PlayerComponent';
import { SpriteComponent } from './components/SpriteComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { SolidSurfaceComponent, setSolidSurfaceSystemRegistry } from './components/SolidSurfaceComponent';

afterEach(() => sSystemRegistry.reset());

function scene(): {
  player: GameObject; component: PlayerComponent; input: InputSystem;
  manager: GameObjectManager; camera: CameraSystem; factory: GameObjectFactory;
  frame: () => void;
} {
  sSystemRegistry.reset();
  const collision = new CollisionSystem();
  const camera = new CameraSystem(480, 320);
  camera.setPosition(160, 200);
  const manager = new GameObjectManager();
  manager.setCamera(camera);
  const factory = new GameObjectFactory(manager);
  const input = new InputSystem();
  sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(factory, 'factory');
  sSystemRegistry.register(manager, 'gameObject');
  setSolidSurfaceSystemRegistry(sSystemRegistry);
  const player = new GameObject();
  player.type = 'player';
  player.activationRadius = -1;
  player.width = 32;
  player.height = 48;
  player.setPosition(160, 160);
  const component = new PlayerComponent();
  component.setSystems(input, collision, new SoundSystem(),
    { getLevelSize: () => ({ width: 4096, height: 4096 }) } as LevelSystem);
  player.addComponent(component);
  player.addComponent(new SpriteComponent());
  player.addComponent(new DynamicCollisionComponent());
  manager.add(player);
  const floor = new GameObject();
  floor.activationRadius = -1;
  floor.width = 1024;
  floor.height = 32;
  floor.setPosition(0, 320);
  const surface = new SolidSurfaceComponent();
  surface.createRectangle(floor.width, floor.height);
  floor.addComponent(surface);
  manager.add(floor);
  manager.commitUpdates();
  floor.update(0, 0);
  collision.updateTemporarySurfaces();
  // Avoid treating the default zero contact timestamp as a just-touched floor.
  let time = 1;
  return { player, component, input, manager, camera, factory, frame(): void {
    time += 1 / 60;
    manager.update(1 / 60, time);
    collision.updateTemporarySurfaces();
    manager.commitUpdates();
    camera.update(1 / 60);
  } };
}

test('stomp lands once, shakes for 0.15s, emits mirrored dust and recovers before accepting input', () => {
  const { player, component, input, manager, camera, factory, frame } = scene();
  const shake = spyOn(camera, 'shake');
  const draws: Array<{ name: string; scaleX: number; priority: number }> = [];
  factory.setRenderSystem({
    hasSprite: () => true,
    drawSprite: (name: string, _x: number, _y: number, _frame: number,
      priority: number, _opacity: number, scaleX: number) => draws.push({ name, priority, scaleX }),
  } as unknown as RenderSystem);
  input.setVirtualButton('attack', true);
  frame();
  input.setVirtualButton('attack', false);
  input.setVirtualButton('fly', true);
  input.setVirtualAxis('horizontal', 1);
  for (let i = 0; i < 60 && !component.stompLanded; i++) {
    frame();
    expect(player.getPosition().x).toBe(160);
    expect(component.rocketsOn).toBe(false);
  }
  expect(component.stompLanded).toBe(true);
  expect(component.currentState).toBe(PlayerState.STOMP);
  expect(shake.mock.calls).toEqual([[15, 0.15]]);
  const dust = manager.getActiveObjects().filter(object => object.subType === 'dust');
  expect(dust).toHaveLength(2);
  expect(dust.map(object => [object.getPosition().x, object.getPosition().y]))
    .toEqual([[144, 304], [176, 304]]);
  for (const puff of dust) {
    const sprite = puff.getComponent(SpriteComponent)!;
    expect(sprite.getCurrentAnimation()?.frames.map(frame => frame.sprite))
      .toEqual(['dust01.png', 'dust02.png', 'dust03.png', 'dust04.png', 'dust05.png']);
    expect(sprite.getCurrentAnimation()?.frames.every(frame => frame.duration === 1 / 24)).toBe(true);
    sprite.render(puff);
  }
  expect(draws.map(draw => draw.scaleX)).toEqual([-1, 1]);
  expect(draws.every(draw => draw.priority === SortConstants.EFFECT)).toBe(true);
  for (let i = 0; i < 8; i++) frame();
  expect(component.currentState).toBe(PlayerState.STOMP);
  expect(player.getPosition().x).toBe(160);
  expect(player.getComponent(DynamicCollisionComponent)?.getVulnerabilityVolumes()).toBeNull();
  expect(shake).toHaveBeenCalledTimes(1);
  expect(dust.map(object => [object.getPosition().x, object.getPosition().y]))
    .toEqual([[144, 304], [176, 304]]);
  for (let i = 0; i < 6; i++) frame();
  expect(component.currentState).toBe(PlayerState.MOVE);
  expect(player.getPosition().x).toBeGreaterThan(160);
  expect(player.getComponent(DynamicCollisionComponent)?.getVulnerabilityVolumes()).not.toBeNull();
  for (let i = 0; i < 12; i++) frame();
  expect(manager.getActiveObjects().filter(object => object.subType === 'dust')).toHaveLength(0);
  // Jump again using a fresh press after recovery. The next attack must have
  // its own landing, without resetting the component or staging its flags.
  input.setVirtualButton('fly', false);
  input.setVirtualAxis('horizontal', 0);
  frame();
  input.setVirtualButton('fly', true);
  for (let i = 0; i < 8; i++) frame();
  expect(player.touchingGround()).toBe(false);
  input.setVirtualButton('fly', false);
  input.setVirtualButton('attack', true);
  frame();
  expect(component.currentState).toBe(PlayerState.STOMP);
  expect(component.stompLanded).toBe(false);
  for (let i = 0; i < 120 && !component.stompLanded; i++) frame();
  expect(component.stompLanded).toBe(true);
  expect(shake).toHaveBeenCalledTimes(2);
  expect(manager.getActiveObjects().filter(object => object.subType === 'dust')).toHaveLength(2);
});

test('ordinary landings do not emit the stomp effects', () => {
  const { player, manager, camera, frame } = scene();
  const shake = spyOn(camera, 'shake');
  for (let i = 0; i < 90; i++) frame();
  expect(player.touchingGround()).toBe(true);
  expect(shake).not.toHaveBeenCalled();
  expect(manager.getActiveObjects().filter(object => object.subType === 'dust')).toHaveLength(0);
});
