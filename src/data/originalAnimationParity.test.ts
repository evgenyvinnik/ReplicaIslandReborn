import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { createEnemyAnimations } from './enemyAnimations';
import { createObjectAnimation } from './objectAnimations';
import { EnemyAnimation } from '../entities/components/EnemyAnimationComponent';
import { NPCAnimation } from '../entities/components/NPCAnimationComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { createNpcAnimations } from './npcAnimations';
import { createPlayerAnimations, type PlayerAnimationName } from './playerAnimations';
import { HitType, type AnimationDefinition } from '../types';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';

// Read the reference, not another manually transcribed expected frame list.
// These selected factory methods use literal frames or named frame reuse; an
// unsupported expression fails explicitly instead of silently dropping a frame.
const source = readFileSync(new URL('../../Original/src/com/replica/replicaisland/GameObjectFactory.java', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const game = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
const assets = new Map([...game.matchAll(/name:\s*'([^']+)',\s*file:\s*'([^']+)'/g)]
  .map(match => [match[1], match[2]]));

interface OriginalFrame { resource: string; duration: number; attack: string; vulnerability: string }
interface OriginalAnimation { frames: OriginalFrame[]; loop: boolean }
interface VolumeDescriptor { shape: string; values: number[]; hitType: HitType }

function frameFrom(expression: string): OriginalFrame {
  const match = expression.match(/R\.drawable\.(\w+)\)\s*,\s*(?:Utils.framesToTime\((\d+),\s*(\d+)\)|([\d.]+)f)/);
  const volumes = expression.match(/,\s*(\w+),\s*(\w+)\s*\)?\s*$/);
  if (!match || !volumes) throw new Error(`Unsupported reference frame: ${expression}`);
  return {
    resource: match[1], duration: match[4] ? Number(match[4]) : Number(match[3]) / Number(match[2]),
    attack: volumes[1], vulnerability: volumes[2],
  };
}

function factoryBody(method: string): string {
  const start = source.indexOf(`public GameObject ${method}(`);
  if (start < 0) throw new Error(`Missing reference factory: ${method}`);
  const next = source.indexOf('public GameObject ', start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

function originalAnimations(method: string, endMarker?: string): Map<string, OriginalAnimation> {
  let body = factoryBody(method);
  if (endMarker) {
    const end = body.indexOf(endMarker);
    if (end < 0) throw new Error(`Missing animation boundary ${endMarker}`);
    body = body.slice(0, end);
  }
  const frames = new Map<string, OriginalFrame>();
  for (const match of body.matchAll(/AnimationFrame\s+(\w+)\s*=\s*new AnimationFrame\(([\s\S]*?)\);/g)) {
    frames.set(match[1], frameFrom(match[2]));
  }
  const animations = new Map<string, OriginalAnimation>();
  for (const match of body.matchAll(/SpriteAnimation\s+(\w+)\s*=\s*new SpriteAnimation\(/g)) {
    animations.set(match[1], { frames: [], loop: false });
  }
  for (const match of body.matchAll(/(\w+)\.addFrame\(([\s\S]*?)\);/g)) {
    const animation = animations.get(match[1]);
    if (!animation) throw new Error(`Unknown reference animation: ${match[1]}`);
    animation.frames.push(frames.get(match[2].trim()) ?? frameFrom(match[2]));
  }
  for (const match of body.matchAll(/(\w+)\.setLoop\((true|false)\)/g)) {
    const animation = animations.get(match[1]);
    if (!animation) throw new Error(`Unknown looping animation: ${match[1]}`);
    animation.loop = match[2] === 'true';
  }
  return animations;
}

function originalVolumes(method: string): Map<string, VolumeDescriptor[]> {
  const body = factoryBody(method);
  const heightMatch = body.match(/object.height\s*=\s*(\d+)/);
  if (!heightMatch) throw new Error(`Missing sprite height: ${method}`);
  const height = Number(heightMatch[1]);
  const volumes = new Map<string, VolumeDescriptor[]>();
  for (const match of body.matchAll(/FixedSizeArray<CollisionVolume>\s+(\w+)\s*=/g)) {
    volumes.set(match[1], []);
  }
  const named = new Map<string, VolumeDescriptor>();
  const parseVolume = (shape: string, argumentsText: string): VolumeDescriptor => {
    const args = argumentsText.split(',').map(value => value.trim());
    const type = args[args.length - 1].startsWith('HitType.') ? args.pop()!.slice('HitType.'.length) : 'INVALID';
    if (!(type in HitType)) throw new Error(`Unknown hit type: ${type}`);
    const values = args.map(value => Number(value.replace(/f$/, '')));
    if (!values.every(Number.isFinite)) throw new Error(`Nonliteral volume: ${argumentsText}`);
    if (shape === 'Sphere') values[2] = height - values[2];
    else values[1] = height - values[1] - values[3];
    return { shape, values, hitType: HitType[type as keyof typeof HitType] };
  };
  for (const match of body.matchAll(/(?:Sphere|AABox)CollisionVolume\s+(\w+)\s*=\s*new (Sphere|AABox)CollisionVolume\(([^)]+)\)/g)) {
    named.set(match[1], parseVolume(match[2], match[3]));
  }
  for (const match of body.matchAll(/(\w+)\.setHitType\(HitType\.(\w+)\)/g)) {
    const volume = named.get(match[1]);
    if (!volume || !(match[2] in HitType)) throw new Error(`Unknown named volume: ${match[0]}`);
    volume.hitType = HitType[match[2] as keyof typeof HitType];
  }
  // Walk inline and shared-volume additions together, preserving frame order.
  for (const match of body.matchAll(/(\w+)\.add\((?:new (Sphere|AABox)CollisionVolume\(([^)]+)\)|(\w+))\)/g)) {
    const volume = match[2] ? parseVolume(match[2], match[3]) : named.get(match[4]);
    if (!volume) {
      if (volumes.has(match[1])) throw new Error(`Unresolved volume addition: ${match[0]}`);
      continue; // Other static-data/component arrays are not volumes.
    }
    const group = volumes.get(match[1]) ?? [];
    group.push(volume);
    volumes.set(match[1], group);
  }
  for (const match of body.matchAll(/(\w+)\.get\((\d+)\)\.setHitType\(HitType\.(\w+)\)/g)) {
    const volume = volumes.get(match[1])?.[Number(match[2])];
    if (!volume || !(match[3] in HitType)) throw new Error(`Unknown typed volume: ${match[0]}`);
    volume.hitType = HitType[match[3] as keyof typeof HitType];
  }
  return volumes;
}

function describeVolumes(volumes: AnimationDefinition['frames'][number]['attackVolumes']): VolumeDescriptor[] | null {
  return volumes?.map(volume => {
    if (volume instanceof SphereCollisionVolume) {
      const center = volume.getCenter();
      return { shape: 'Sphere', values: [volume.getRadius(), center.x, center.y], hitType: volume.getHitType() };
    }
    if (volume instanceof AABoxCollisionVolume) {
      return { shape: 'AABox', values: [volume.getMinXPosition(null), volume.getMinYPosition(null), volume.getWidth(), volume.getHeight()], hitType: volume.getHitType() };
    }
    throw new Error('Unsupported web collision volume');
  }) ?? null;
}

function checkFrameVolumes(actual: AnimationDefinition, original: OriginalAnimation, method: string,
  offset = { x: 0, y: 0 }): void {
  const volumes = originalVolumes(method);
  const resolve = (name: string): VolumeDescriptor[] | null => {
    if (name === 'null') return null;
    const group = volumes.get(name);
    if (!group) throw new Error(`Unresolved reference volume ${method}.${name}`);
    return group.map(volume => {
      const values = [...volume.values];
      values[volume.shape === 'Sphere' ? 1 : 0] += offset.x;
      values[volume.shape === 'Sphere' ? 2 : 1] += offset.y;
      return { ...volume, values };
    });
  };
  for (const [index, frame] of actual.frames.entries()) {
    expect(describeVolumes(frame.attackVolumes), `${method} frame ${index} attack`)
      .toEqual(resolve(original.frames[index].attack));
    expect(describeVolumes(frame.vulnerabilityVolumes), `${method} frame ${index} vulnerability`)
      .toEqual(resolve(original.frames[index].vulnerability));
  }
}

function checkAnimation(actual: AnimationDefinition, original: OriginalAnimation): void {
  expect(original.frames.length).toBeGreaterThan(0);
  expect(actual.frames.map(frame => assets.get(frame.sprite!) ?? frame.sprite?.replace(/\.png$/, '')))
    .toEqual(original.frames.map(frame => frame.resource));
  expect(actual.frames).toHaveLength(original.frames.length);
  for (const [index, frame] of actual.frames.entries()) {
    expect(frame.duration).toBeCloseTo(original.frames[index].duration, 8);
    expect(existsSync(new URL(`../../public/assets/sprites/${original.frames[index].resource}.png`, import.meta.url))).toBe(true);
  }
  expect(actual.loop).toBe(original.loop);
  const sprite = new SpriteComponent();
  sprite.addAnimation('reference', actual);
  sprite.playAnimation('reference');
  let elapsed = 0;
  for (const frame of original.frames) {
    sprite.setCurrentAnimationTime(elapsed + frame.duration / 2);
    const drawn = sprite.getCurrentDraw()!.sprite;
    expect(assets.get(drawn) ?? drawn.replace(/\.png$/, '')).toBe(frame.resource);
    elapsed += frame.duration;
  }
  sprite.setCurrentAnimationTime(elapsed + 0.001);
  expect(sprite.animationFinished()).toBe(!original.loop);
}

const enemies = [
  ['bat', 'spawnEnemyBat'], ['sting', 'spawnEnemySting'],
  ['onion', 'spawnEnemyOnion'], ['brobot', 'spawnEnemyBrobot'],
  ['snailbomb', 'spawnEnemySnailBomb'], ['skeleton', 'spawnEnemySkeleton'],
  ['mudman', 'spawnEnemyMudman'], ['karaguin', 'spawnEnemyKaraguin'],
  ['pink_namazu', 'spawnEnemyPinkNamazu'], ['shadowslime', 'spawnEnemyShadowSlime'],
  ['turret', 'spawnObjectTurret'],
];
const states: Record<string, EnemyAnimation> = {
  idle: EnemyAnimation.IDLE, walk: EnemyAnimation.MOVE, wake: EnemyAnimation.MOVE,
  attack: EnemyAnimation.ATTACK, appear: EnemyAnimation.APPEAR, hidden: EnemyAnimation.HIDDEN,
};
test.each(enemies)('%s: every enemy frame, hold and loop matches %s', (type, method) => {
  const original = originalAnimations(method);
  const actual = createEnemyAnimations(type)!;
  expect(actual.size).toBe(original.size);
  for (const [name, animation] of original) {
    expect(states[name]).toBeDefined();
    checkAnimation(actual.get(states[name])!, animation);
    checkFrameVolumes(actual.get(states[name])!, animation, method);
  }
});

const playerStates: Record<string, PlayerAnimationName> = {
  idle: 'idle', angle: 'move', extremeAngle: 'move_fast', up: 'boost_up',
  boostAngle: 'boost_move', boostExtremeAngle: 'boost_move_fast', stomp: 'stomp',
  hitReactAnim: 'hit', deathAnim: 'dead', frozenAnim: 'frozen',
};
test.each(Object.entries(playerStates))('Andou %s: body art, timing and converted volumes match Android', (name, webName) => {
  // Only the body static-data block; jets, sparks and halo are separate sprites.
  const original = originalAnimations('spawnPlayer', 'setStaticData(GameObjectType.PLAYER, staticData)');
  expect([...original.keys()].sort()).toEqual(Object.keys(playerStates).sort());
  const actual = createPlayerAnimations().get(webName)!;
  const reference = original.get(name)!;
  if (reference.frames.length) checkAnimation(actual, reference);
  else {
    expect(actual.frames).toHaveLength(0);
    expect(actual.loop).toBe(reference.loop);
  }
  checkFrameVolumes(actual, reference, 'spawnPlayer', { x: -16, y: -16 });
});

test.each([
  ['coin', '', 'spawnCoin'], ['ruby', '', 'spawnRuby'], ['diary', '', 'spawnDiary'],
  ['terminal', 'rokudou', 'spawnRokudouTerminal'],
  ['terminal', 'kabocha', 'spawnKabochaTerminal'], ['ghost', '', 'spawnPlayerGhost'],
])('%s %s: every object frame matches %s', (type, subType, method) => {
  const original = originalAnimations(method);
  expect(original.size).toBe(1);
  checkAnimation(createObjectAnimation(type, 64, 64, subType)!, original.get('idle')!);
});

const npcStates: Record<string, NPCAnimation> = {
  idle: NPCAnimation.IDLE, walk: NPCAnimation.WALK, fly: NPCAnimation.WALK,
  runStart: NPCAnimation.RUN_START, run: NPCAnimation.RUN,
  jumpStart: NPCAnimation.JUMP_START, jumpAir: NPCAnimation.JUMP_AIR,
  attack: NPCAnimation.SHOOT, shoot: NPCAnimation.SHOOT,
  hit: NPCAnimation.TAKE_HIT, surprised: NPCAnimation.SURPRISED, die: NPCAnimation.DEATH,
};
test.each([
  ['wanda', 'spawnEnemyWanda'], ['kyle', 'spawnEnemyKyle'], ['kabocha', 'spawnEnemyKabocha'],
  ['evil_kabocha', 'spawnEnemyEvilKabocha'], ['rokudou', 'spawnEnemyRokudou'],
])('%s: authored NPC animations match %s', (type, method) => {
  const original = originalAnimations(method);
  const actual = createNpcAnimations(type, 128, 128)!;
  expect(original.size).toBeGreaterThan(0);
  // The web controller also provides fallback states absent from the original.
  // Compare every authored state without treating those fallbacks as source data.
  for (const [name, animation] of original) {
    expect(npcStates[name]).toBeDefined();
    checkAnimation(actual.get(npcStates[name])!, animation);
    checkFrameVolumes(actual.get(npcStates[name])!, animation, method);
  }
});
